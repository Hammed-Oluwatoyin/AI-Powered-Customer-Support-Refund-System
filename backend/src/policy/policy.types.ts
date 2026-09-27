import type { RefundReason } from '../config/policy.constants.js';
import type { Decision, OrderStatus } from '../generated/prisma/enums.js';

/** Stable identifiers stored in `RefundRequest.rulesFired`. Never shown to customers. */
export const RULE = {
  P7_OWNERSHIP: 'P7_OWNERSHIP',
  AI_EXTRACTION_FAILED: 'AI_EXTRACTION_FAILED',
  P8_PROMPT_INJECTION: 'P8_PROMPT_INJECTION',
  DATA_INCONSISTENCY: 'DATA_INCONSISTENCY',
  P4_ALREADY_REFUNDED: 'P4_ALREADY_REFUNDED',
  P2_FINAL_SALE: 'P2_FINAL_SALE',
  P1_REFUND_WINDOW: 'P1_REFUND_WINDOW',
  P5_DELIVERY_STATUS: 'P5_DELIVERY_STATUS',
  P8_REFUND_FREQUENCY: 'P8_REFUND_FREQUENCY',
  P9_LOW_CONFIDENCE: 'P9_LOW_CONFIDENCE',
  P3_HUMAN_REVIEW_THRESHOLD: 'P3_HUMAN_REVIEW_THRESHOLD',
  P6_QUALIFYING_REASON: 'P6_QUALIFYING_REASON',
} as const;

export type RuleId = (typeof RULE)[keyof typeof RULE];

export interface PolicyItem {
  id: string;
  name: string;
  /** Integer cents, so the engine never does floating-point money arithmetic. */
  unitPriceCents: number;
  quantity: number;
  isFinalSale: boolean;
  refunded: boolean;
}

/** An order as verified against the database, never as claimed by the customer. */
export interface PolicyOrder {
  id: string;
  /** Email of the customer who owns the order. */
  customerEmail: string;
  status: OrderStatus;
  deliveredAt: Date | null;
  items: PolicyItem[];
}

/** The parts of the AI extraction the policy uses. */
export interface PolicyIntent {
  reason: RefundReason;
  /** 0 to 1. */
  confidence: number;
}

export interface PolicyInput {
  /** Evaluation time, passed in so the engine stays pure and testable. */
  now: Date;
  requesterEmail: string;
  order: PolicyOrder;
  /** The requester's approved refunds in the last REFUND_FREQUENCY_WINDOW_DAYS. */
  recentRefundCount: number;
  /** null when AI extraction failed (error, timeout or invalid output). */
  intent: PolicyIntent | null;
  /** Combined verdict of the model's flag and the heuristic injection detector. */
  injectionSuspected: boolean;
}

export interface PolicyDecision {
  decision: Decision;
  /** Rules that determined the decision or changed the amount, in evaluation order. */
  rulesFired: RuleId[];
  /** Plain-English explanations for staff, in evaluation order. Internal only. */
  reasons: string[];
  /**
   * Eligible amount in cents: the refund for APPROVED, or the amount at stake
   * for ESCALATED once it has been worked out. null for DENIED, and for
   * escalations that happen before the items are assessed.
   */
  refundAmountCents: number | null;
  /** Items the amount covers. Empty whenever refundAmountCents is null. */
  eligibleItemIds: string[];
}
