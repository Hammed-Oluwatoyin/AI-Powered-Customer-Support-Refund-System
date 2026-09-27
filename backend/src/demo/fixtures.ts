import type { OrderStatus } from '../generated/prisma/enums.js';

/**
 * Demo data written by the seed. Dates are day offsets from "now" so the
 * scenarios behave the same whenever the project is run. Each customer drives
 * one scenario in scenarios.ts; some have extra orders for realism.
 */

export interface ItemFixture {
  name: string;
  /** Dollars. */
  unitPrice: number;
  quantity?: number;
  isFinalSale?: boolean;
  refunded?: boolean;
}

export interface OrderFixture {
  id: string;
  status: OrderStatus;
  orderedDaysAgo: number;
  /** null while the order has not been delivered. */
  deliveredDaysAgo: number | null;
  items: ItemFixture[];
}

export interface CustomerFixture {
  name: string;
  email: string;
  orders: OrderFixture[];
}

/** A refund approved in the past, so frequency and duplicate rules have history to check. */
export interface PastRefundFixture {
  /** Fixed UUID so re-seeding updates the row instead of duplicating it. */
  id: string;
  email: string;
  orderId: string;
  message: string;
  /** Dollars. */
  amount: number;
  daysAgo: number;
}

export const DEMO_CUSTOMERS: CustomerFixture[] = [
  {
    name: 'Ada Okafor',
    email: 'ada.okafor@example.com',
    orders: [
      {
        id: 'ORD-1001',
        status: 'DELIVERED',
        orderedDaysAgo: 9,
        deliveredDaysAgo: 5,
        items: [{ name: 'Ceramic Mug Set', unitPrice: 80 }],
      },
      {
        id: 'ORD-1002',
        status: 'DELIVERED',
        orderedDaysAgo: 75,
        deliveredDaysAgo: 70,
        items: [{ name: 'Linen Tea Towels', unitPrice: 9, quantity: 2 }],
      },
    ],
  },
  {
    name: 'Ben Carter',
    email: 'ben.carter@example.com',
    orders: [
      {
        id: 'ORD-1003',
        status: 'DELIVERED',
        orderedDaysAgo: 14,
        deliveredDaysAgo: 10,
        items: [{ name: 'Running Shoes', unitPrice: 45 }],
      },
    ],
  },
  {
    name: 'Chioma Eze',
    email: 'chioma.eze@example.com',
    orders: [
      {
        id: 'ORD-1004',
        status: 'DELIVERED',
        orderedDaysAgo: 7,
        deliveredDaysAgo: 3,
        items: [
          { name: 'Silk Evening Dress', unitPrice: 60, isFinalSale: true },
        ],
      },
    ],
  },
  {
    name: 'David Mensah',
    email: 'david.mensah@example.com',
    orders: [
      {
        id: 'ORD-1005',
        status: 'DELIVERED',
        orderedDaysAgo: 50,
        deliveredDaysAgo: 45,
        items: [{ name: 'Wireless Headphones', unitPrice: 150 }],
      },
    ],
  },
  {
    name: 'Emeka Nwosu',
    email: 'emeka.nwosu@example.com',
    orders: [
      {
        id: 'ORD-1006',
        status: 'DELIVERED',
        orderedDaysAgo: 8,
        deliveredDaysAgo: 4,
        items: [{ name: '14-inch Laptop', unitPrice: 750 }],
      },
    ],
  },
  {
    name: 'Fatima Bello',
    email: 'fatima.bello@example.com',
    orders: [
      {
        id: 'ORD-1007',
        status: 'DELIVERED',
        orderedDaysAgo: 12,
        deliveredDaysAgo: 8,
        items: [{ name: 'Bluetooth Speaker', unitPrice: 55, refunded: true }],
      },
    ],
  },
  {
    name: 'Grace Lee',
    email: 'grace.lee@example.com',
    orders: [
      {
        id: 'ORD-1008',
        status: 'SHIPPED',
        orderedDaysAgo: 3,
        deliveredDaysAgo: null,
        items: [{ name: 'Table Lamp', unitPrice: 65 }],
      },
    ],
  },
  {
    name: 'Hassan Ali',
    email: 'hassan.ali@example.com',
    orders: [
      {
        id: 'ORD-1009',
        status: 'DELIVERED',
        orderedDaysAgo: 16,
        deliveredDaysAgo: 12,
        items: [{ name: 'Winter Jacket', unitPrice: 120 }],
      },
    ],
  },
  {
    name: 'Ifeoma Obi',
    email: 'ifeoma.obi@example.com',
    orders: [
      {
        id: 'ORD-1010',
        status: 'DELIVERED',
        orderedDaysAgo: 10,
        deliveredDaysAgo: 6,
        items: [{ name: 'Smart Watch', unitPrice: 220 }],
      },
    ],
  },
  {
    name: 'James Smith',
    email: 'james.smith@example.com',
    orders: [
      {
        id: 'ORD-1011',
        status: 'DELIVERED',
        orderedDaysAgo: 24,
        deliveredDaysAgo: 20,
        items: [{ name: 'Desk Organiser', unitPrice: 25 }],
      },
    ],
  },
  {
    name: 'Kemi Adeyemi',
    email: 'kemi.adeyemi@example.com',
    orders: [
      {
        id: 'ORD-1012',
        status: 'DELIVERED',
        orderedDaysAgo: 11,
        deliveredDaysAgo: 7,
        items: [{ name: 'Yoga Mat', unitPrice: 35 }],
      },
      {
        id: 'ORD-1013',
        status: 'DELIVERED',
        orderedDaysAgo: 18,
        deliveredDaysAgo: 14,
        items: [{ name: 'Insulated Water Bottle', unitPrice: 20 }],
      },
    ],
  },
  {
    name: 'Lola Martins',
    email: 'lola.martins@example.com',
    orders: [
      {
        id: 'ORD-1014',
        status: 'DELIVERED',
        orderedDaysAgo: 10,
        deliveredDaysAgo: 6,
        items: [{ name: 'Travel Backpack', unitPrice: 90 }],
      },
    ],
  },
  {
    name: 'Musa Ibrahim',
    email: 'musa.ibrahim@example.com',
    orders: [
      {
        id: 'ORD-1015',
        status: 'DELIVERED',
        orderedDaysAgo: 13,
        deliveredDaysAgo: 9,
        items: [
          { name: 'Clearance Wool Scarf', unitPrice: 40, isFinalSale: true },
          { name: 'Leather Wallet', unitPrice: 70 },
        ],
      },
    ],
  },
  {
    name: 'Ngozi Uche',
    email: 'ngozi.uche@example.com',
    orders: [
      {
        id: 'ORD-1016',
        status: 'DELIVERED',
        orderedDaysAgo: 9,
        deliveredDaysAgo: 5,
        items: [{ name: 'Throw Pillow', unitPrice: 30 }],
      },
    ],
  },
  {
    name: 'Obinna Kalu',
    email: 'obinna.kalu@example.com',
    orders: [
      {
        id: 'ORD-1017',
        status: 'DELIVERED',
        orderedDaysAgo: 7,
        deliveredDaysAgo: 3,
        items: [{ name: 'Coffee Grinder', unitPrice: 85 }],
      },
      {
        id: 'ORD-1018',
        status: 'DELIVERED',
        orderedDaysAgo: 55,
        deliveredDaysAgo: 50,
        items: [
          { name: 'French Press', unitPrice: 35, refunded: true },
          { name: 'Milk Frother', unitPrice: 25, refunded: true },
        ],
      },
      {
        id: 'ORD-1019',
        status: 'DELIVERED',
        orderedDaysAgo: 30,
        deliveredDaysAgo: 26,
        items: [{ name: 'Espresso Cups', unitPrice: 30, refunded: true }],
      },
    ],
  },
];

export const PAST_REFUNDS: PastRefundFixture[] = [
  {
    id: '5eed0000-0000-4000-8000-000000000001',
    email: 'fatima.bello@example.com',
    orderId: 'ORD-1007',
    message: 'The bluetooth speaker arrived with a cracked casing.',
    amount: 55,
    daysAgo: 6,
  },
  {
    id: '5eed0000-0000-4000-8000-000000000002',
    email: 'obinna.kalu@example.com',
    orderId: 'ORD-1018',
    message: 'The French press arrived with a broken glass beaker.',
    amount: 35,
    daysAgo: 45,
  },
  {
    id: '5eed0000-0000-4000-8000-000000000003',
    email: 'obinna.kalu@example.com',
    orderId: 'ORD-1018',
    message: 'The milk frother stopped working after one use.',
    amount: 25,
    daysAgo: 40,
  },
  {
    id: '5eed0000-0000-4000-8000-000000000004',
    email: 'obinna.kalu@example.com',
    orderId: 'ORD-1019',
    message: 'Two of the espresso cups were chipped.',
    amount: 30,
    daysAgo: 20,
  },
];
