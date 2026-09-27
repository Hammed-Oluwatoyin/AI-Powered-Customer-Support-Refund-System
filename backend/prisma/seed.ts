/**
 * One-off admin process (Twelve-Factor XII): seeds the demo scenarios.
 *
 *   docker compose run --rm backend npm run seed
 *
 * Safe to run any number of times; see seedDemoData for what re-seeding does.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { seedDemoData } from '../src/demo/seed.js';
import { PrismaClient } from '../src/generated/prisma/client.js';

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
  try {
    const summary = await seedDemoData(prisma);
    // Same JSON-lines shape as the app's logger (Twelve-Factor XI).
    console.log(
      JSON.stringify({
        level: 'log',
        timestamp: Date.now(),
        context: 'Seed',
        message: 'Demo data seeded',
        ...summary,
      }),
    );
  } finally {
    await prisma.$disconnect();
  }
}

await main();
