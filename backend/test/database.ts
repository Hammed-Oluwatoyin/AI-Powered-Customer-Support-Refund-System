import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { TEST_DATABASE_URL } from './test-env.js';

export function createTestPrismaClient(): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: TEST_DATABASE_URL }),
  });
}

/** Empties every table so each test file starts from a known state. */
export async function truncateAll(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRaw`TRUNCATE "AuditEvent", "RefundRequest", "OrderItem", "Order", "Customer" RESTART IDENTITY CASCADE`;
}
