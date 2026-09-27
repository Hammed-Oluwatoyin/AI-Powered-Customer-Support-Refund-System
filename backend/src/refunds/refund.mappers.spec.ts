import { Prisma } from '../generated/prisma/client.js';
import { centsToDecimal, toCents } from './refund.mappers.js';

describe('money mapping', () => {
  it.each([
    ['80.00', 8_000],
    ['0.10', 10],
    ['19.99', 1_999],
    ['500.01', 500_01],
  ])('converts %s dollars to %i cents exactly', (dollars, cents) => {
    expect(toCents(new Prisma.Decimal(dollars))).toBe(cents);
    expect(centsToDecimal(cents)).toBe(dollars);
  });
});
