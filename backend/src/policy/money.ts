/** Formats integer cents as US dollars, e.g. 8000 -> "$80.00". */
export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
