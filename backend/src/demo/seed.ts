import type { PrismaClient } from '../generated/prisma/client.js';
import {
  DEMO_CUSTOMERS,
  PAST_REFUNDS,
  type ItemFixture,
  type OrderFixture,
} from './fixtures.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface SeedSummary {
  customers: number;
  orders: number;
  items: number;
  pastRefunds: number;
}

/**
 * Writes the demo fixtures. Idempotent: every fixture row has a stable key
 * (customer email, order ID, item ID, past-refund UUID) and is upserted, so
 * running it again:
 * - refreshes dates relative to `now`, so the scenarios keep working, and
 * - resets fixture state the app may have changed, such as `refunded` flags.
 *
 * Refund requests created by the app are left alone, so the admin history
 * survives a restart.
 */
export async function seedDemoData(
  prisma: PrismaClient,
  now: Date = new Date(),
): Promise<SeedSummary> {
  const daysAgo = (days: number): Date =>
    new Date(now.getTime() - days * DAY_MS);
  const summary: SeedSummary = {
    customers: 0,
    orders: 0,
    items: 0,
    pastRefunds: 0,
  };

  await prisma.$transaction(
    async (tx) => {
      for (const customer of DEMO_CUSTOMERS) {
        const { id: customerId } = await tx.customer.upsert({
          where: { email: customer.email },
          create: { name: customer.name, email: customer.email },
          update: { name: customer.name },
        });
        summary.customers++;

        for (const order of customer.orders) {
          const orderData = {
            customerId,
            status: order.status,
            orderedAt: daysAgo(order.orderedDaysAgo),
            deliveredAt:
              order.deliveredDaysAgo === null
                ? null
                : daysAgo(order.deliveredDaysAgo),
            total: orderTotal(order),
          };
          await tx.order.upsert({
            where: { id: order.id },
            create: { id: order.id, ...orderData },
            update: orderData,
          });
          summary.orders++;

          for (const [index, item] of order.items.entries()) {
            const id = itemId(order.id, index);
            const itemData = {
              orderId: order.id,
              name: item.name,
              unitPrice: item.unitPrice,
              quantity: item.quantity ?? 1,
              isFinalSale: item.isFinalSale ?? false,
              refunded: item.refunded ?? false,
            };
            await tx.orderItem.upsert({
              where: { id },
              create: { id, ...itemData },
              update: itemData,
            });
            summary.items++;
          }
        }
      }

      for (const refund of PAST_REFUNDS) {
        const refundData = {
          customerEmail: refund.email,
          orderId: refund.orderId,
          message: refund.message,
          decision: 'APPROVED' as const,
          status: 'DECIDED' as const,
          rulesFired: [],
          reasons: ['Seeded refund history'],
          refundAmount: refund.amount,
          createdAt: daysAgo(refund.daysAgo),
        };
        await tx.refundRequest.upsert({
          where: { id: refund.id },
          create: { id: refund.id, ...refundData },
          update: refundData,
        });
        summary.pastRefunds++;
      }
    },
    // Well above the few hundred milliseconds this takes, to allow for slow CI machines.
    { timeout: 30_000 },
  );

  return summary;
}

/** Item IDs are derived from the order so they stay stable across seeds, e.g. ORD-1015-2. */
export function itemId(orderId: string, index: number): string {
  return `${orderId}-${index + 1}`;
}

/** Sums in integer cents to avoid floating-point drift, then returns dollars. */
function orderTotal(order: OrderFixture): number {
  const cents = order.items.reduce(
    (sum, item: ItemFixture) =>
      sum + Math.round(item.unitPrice * 100) * (item.quantity ?? 1),
    0,
  );
  return cents / 100;
}
