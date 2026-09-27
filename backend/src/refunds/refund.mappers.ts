import type { CustomerOrderSummary } from '../ai/llm-provider.js';
import type { VerifiedOrder } from '../customers/customers.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { PolicyOrder } from '../policy/policy.types.js';
import type { CandidateOrder } from './refund-response.js';

/** Converts a Decimal(10, 2) amount from the database to integer cents. */
export function toCents(amount: Prisma.Decimal): number {
  return Math.round(amount.mul(100).toNumber());
}

/** Converts integer cents to a string Prisma stores exactly as Decimal(10, 2). */
export function centsToDecimal(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** The verified order in the shape the rules engine takes. */
export function toPolicyOrder(order: VerifiedOrder): PolicyOrder {
  return {
    id: order.id,
    customerEmail: order.customer.email,
    status: order.status,
    deliveredAt: order.deliveredAt,
    items: order.items.map((item) => ({
      id: item.id,
      name: item.name,
      unitPriceCents: toCents(item.unitPrice),
      quantity: item.quantity,
      isFinalSale: item.isFinalSale,
      refunded: item.refunded,
    })),
  };
}

/** The order as shown to the model and in "which order?" replies. */
export function toOrderSummary(order: VerifiedOrder): CustomerOrderSummary {
  return {
    id: order.id,
    status: order.status,
    orderedAt: order.orderedAt,
    deliveredAt: order.deliveredAt,
    itemNames: order.items.map((item) => item.name),
  };
}

export function toCandidateOrder(order: VerifiedOrder): CandidateOrder {
  return {
    id: order.id,
    orderedAt: order.orderedAt.toISOString(),
    items: order.items.map((item) => item.name),
  };
}
