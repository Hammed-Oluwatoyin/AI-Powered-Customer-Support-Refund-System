import type { Decision, RefundStatus } from '../generated/prisma/enums.js';

export interface CandidateOrder {
  id: string;
  orderedAt: string;
  items: string[];
}

/**
 * What the customer gets back. It never includes internal reasoning: no rule
 * names, reasons or amounts at stake.
 */
export interface RefundResponse {
  requestId: string;
  decision: Decision | null;
  status: RefundStatus;
  reply: string;
  /** Dollars refunded; only set when the request is approved. */
  refundAmount: number | null;
  /** For NEEDS_INFO: the orders the customer can pick from; otherwise empty. */
  candidateOrders: CandidateOrder[];
}
