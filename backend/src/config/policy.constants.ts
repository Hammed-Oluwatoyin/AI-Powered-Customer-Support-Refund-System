/**
 * The refund policy's numbers, mirrored from docs/refund-policy.md.
 *
 * These are business rules, not deployment config (Twelve-Factor III), so
 * they live in code and change through code review rather than per
 * environment.
 */

/** P1: refunds must be requested within this many days of delivery (inclusive). */
export const REFUND_WINDOW_DAYS = 30;

/** P3: refunds above this amount (strictly greater) go to a human. $500.00. */
export const HUMAN_REVIEW_THRESHOLD_CENTS = 500_00;

/** P8: this many approved refunds or more within the lookback window escalates. */
export const REFUND_FREQUENCY_LIMIT = 3;

/** P8: lookback window for counting a customer's recent approved refunds. */
export const REFUND_FREQUENCY_WINDOW_DAYS = 60;

/** P9: extraction confidence below this (strictly less) escalates. */
export const MIN_EXTRACTION_CONFIDENCE = 0.6;

/** Every reason the AI extraction may return. */
export const REFUND_REASONS = [
  'damaged',
  'wrong_item',
  'not_as_described',
  'changed_mind',
  'not_received',
  'other',
] as const;

export type RefundReason = (typeof REFUND_REASONS)[number];

/** P6: reasons that qualify for a refund within the window. */
export const QUALIFYING_REASONS: readonly RefundReason[] = [
  'damaged',
  'wrong_item',
  'not_as_described',
  'changed_mind',
];

/**
 * P5: claims about the condition of the item, which only make sense once the
 * order has been delivered.
 */
export const ITEM_CONDITION_REASONS: readonly RefundReason[] = [
  'damaged',
  'wrong_item',
  'not_as_described',
];
