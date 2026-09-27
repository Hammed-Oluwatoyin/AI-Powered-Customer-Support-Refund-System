import type { Prisma } from '../generated/prisma/client.js';

/**
 * Serialises a value to plain JSON as Postgres will store it (Dates become
 * ISO strings), typed for a Prisma Json column.
 */
export function toJson(value: object): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
