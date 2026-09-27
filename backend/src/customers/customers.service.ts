import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

const ORDER_WITH_ITEMS = {
  include: {
    items: { orderBy: { id: 'asc' } },
    customer: { select: { id: true, name: true, email: true } },
  },
} satisfies Prisma.OrderDefaultArgs;

/** An order with its items and owner, as the refund flow verifies it. */
export type VerifiedOrder = Prisma.OrderGetPayload<typeof ORDER_WITH_ITEMS>;

const CUSTOMER_WITH_ORDERS = {
  include: {
    orders: {
      orderBy: { orderedAt: 'desc' },
      include: ORDER_WITH_ITEMS.include,
    },
  },
} satisfies Prisma.CustomerDefaultArgs;

export type CustomerWithOrders = Prisma.CustomerGetPayload<
  typeof CUSTOMER_WITH_ORDERS
>;

/**
 * Read-only lookups for customers and their orders. Everything the refund
 * flow decides on comes from here, never from what the customer claims.
 */
@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Emails are stored lowercase, so pass a normalised email. */
  findByEmail(email: string): Promise<CustomerWithOrders | null> {
    return this.prisma.customer.findUnique({
      where: { email },
      ...CUSTOMER_WITH_ORDERS,
    });
  }

  /** Looks an order up by ID whoever owns it, so ownership can be checked (P7). */
  findOrder(orderId: string): Promise<VerifiedOrder | null> {
    return this.prisma.order.findUnique({
      where: { id: orderId },
      ...ORDER_WITH_ITEMS,
    });
  }
}

/**
 * Orders a request without an order ID could be about: those that still have
 * an item that has not been refunded. Newest first.
 */
export function candidateOrders(customer: CustomerWithOrders): VerifiedOrder[] {
  return customer.orders.filter((order) =>
    order.items.some((item) => !item.refunded),
  );
}
