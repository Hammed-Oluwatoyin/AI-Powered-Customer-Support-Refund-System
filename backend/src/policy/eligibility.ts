/** The item fields that decide whether an item can still be refunded. */
export interface RefundableCandidate {
  refunded: boolean;
  isFinalSale: boolean;
}

/**
 * P4 and P2 exclusions: items that were already refunded or are final sale
 * can never be refunded. Used when an admin approves an escalated request,
 * applied to the order as it is at that moment.
 */
export function refundableItems<T extends RefundableCandidate>(
  items: T[],
): T[] {
  return items.filter((item) => !item.refunded && !item.isFinalSale);
}
