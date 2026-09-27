import { formatCents } from './money.js';

describe('formatCents', () => {
  it.each([
    [0, '$0.00'],
    [8_000, '$80.00'],
    [500_01, '$500.01'],
    [7, '$0.07'],
  ])('formats %i cents as %s', (cents, expected) => {
    expect(formatCents(cents)).toBe(expected);
  });
});
