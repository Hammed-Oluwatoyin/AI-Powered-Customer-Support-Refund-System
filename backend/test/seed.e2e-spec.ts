import { seedDemoData } from '../src/demo/seed.js';
import { DEMO_CUSTOMERS, PAST_REFUNDS } from '../src/demo/fixtures.js';
import { DEMO_SCENARIOS } from '../src/demo/scenarios.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { createTestPrismaClient, truncateAll } from './database.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-06-15T12:00:00.000Z');

const expectedOrders = DEMO_CUSTOMERS.flatMap((c) => c.orders);
const expectedItemCount = expectedOrders.reduce(
  (sum, o) => sum + o.items.length,
  0,
);

async function rowCounts(prisma: PrismaClient) {
  return {
    customers: await prisma.customer.count(),
    orders: await prisma.order.count(),
    items: await prisma.orderItem.count(),
    refundRequests: await prisma.refundRequest.count(),
  };
}

describe('seedDemoData (e2e, real Postgres)', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = createTestPrismaClient();
  });

  beforeEach(async () => {
    await truncateAll(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates every fixture customer, order, item and past refund', async () => {
    const summary = await seedDemoData(prisma, NOW);

    expect(summary).toEqual({
      customers: DEMO_CUSTOMERS.length,
      orders: expectedOrders.length,
      items: expectedItemCount,
      pastRefunds: PAST_REFUNDS.length,
    });
    expect(await rowCounts(prisma)).toEqual({
      customers: DEMO_CUSTOMERS.length,
      orders: expectedOrders.length,
      items: expectedItemCount,
      refundRequests: PAST_REFUNDS.length,
    });
  });

  it('seeds a customer for every scenario email', async () => {
    await seedDemoData(prisma, NOW);

    const emails = (await prisma.customer.findMany()).map((c) => c.email);
    for (const scenario of DEMO_SCENARIOS) {
      expect(emails).toContain(scenario.email);
    }
  });

  it('computes dates relative to the given time', async () => {
    await seedDemoData(prisma, NOW);

    const ada = await prisma.order.findUniqueOrThrow({
      where: { id: 'ORD-1001' },
    });
    const grace = await prisma.order.findUniqueOrThrow({
      where: { id: 'ORD-1008' },
    });

    expect(ada.deliveredAt).toEqual(new Date(NOW.getTime() - 5 * DAY_MS));
    expect(ada.orderedAt).toEqual(new Date(NOW.getTime() - 9 * DAY_MS));
    expect(grace.deliveredAt).toBeNull();
  });

  it('stores money as exact decimals, with order totals summed from items', async () => {
    await seedDemoData(prisma, NOW);

    const musa = await prisma.order.findUniqueOrThrow({
      where: { id: 'ORD-1015' },
      include: { items: { orderBy: { id: 'asc' } } },
    });
    const ada = await prisma.order.findUniqueOrThrow({
      where: { id: 'ORD-1002' },
    });

    expect(musa.total.toFixed(2)).toBe('110.00');
    expect(
      musa.items.map((i) => [i.id, i.unitPrice.toFixed(2), i.isFinalSale]),
    ).toEqual([
      ['ORD-1015-1', '40.00', true],
      ['ORD-1015-2', '70.00', false],
    ]);
    // 2 x $9 tea towels
    expect(ada.total.toFixed(2)).toBe('18.00');
  });

  it('is idempotent: seeding twice leaves the same rows', async () => {
    await seedDemoData(prisma, NOW);
    const first = await rowCounts(prisma);

    await seedDemoData(prisma, NOW);

    expect(await rowCounts(prisma)).toEqual(first);
  });

  it('restores fixture state and refreshes dates when re-seeded', async () => {
    await seedDemoData(prisma, NOW);
    // Simulate the app approving Ada's refund.
    await prisma.orderItem.update({
      where: { id: 'ORD-1001-1' },
      data: { refunded: true },
    });

    const later = new Date(NOW.getTime() + 10 * DAY_MS);
    await seedDemoData(prisma, later);

    const item = await prisma.orderItem.findUniqueOrThrow({
      where: { id: 'ORD-1001-1' },
    });
    const order = await prisma.order.findUniqueOrThrow({
      where: { id: 'ORD-1001' },
    });
    expect(item.refunded).toBe(false);
    expect(order.deliveredAt).toEqual(new Date(later.getTime() - 5 * DAY_MS));
  });

  it('keeps refund requests created by the app', async () => {
    await seedDemoData(prisma, NOW);
    const created = await prisma.refundRequest.create({
      data: {
        customerEmail: 'ada.okafor@example.com',
        orderId: 'ORD-1001',
        message: 'My mugs arrived cracked.',
        decision: 'APPROVED',
        status: 'DECIDED',
      },
    });

    await seedDemoData(prisma, NOW);

    await expect(
      prisma.refundRequest.findUnique({ where: { id: created.id } }),
    ).resolves.not.toBeNull();
  });

  it('gives Obinna three approved refunds in the last 60 days', async () => {
    await seedDemoData(prisma, NOW);

    const recentApproved = await prisma.refundRequest.count({
      where: {
        customerEmail: 'obinna.kalu@example.com',
        decision: 'APPROVED',
        createdAt: { gte: new Date(NOW.getTime() - 60 * DAY_MS) },
      },
    });
    expect(recentApproved).toBe(3);
  });
});
