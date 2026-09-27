import type { LlmProviderName } from '../config/env.validation.js';
import type { Decision, OrderStatus } from '../generated/prisma/enums.js';

/** Nest injection token for the configured LlmProvider. */
export const LLM_PROVIDER = Symbol('LLM_PROVIDER');

/** A customer's order as shown to the model, so it can match "my mug set" to an ID. */
export interface CustomerOrderSummary {
  id: string;
  status: OrderStatus;
  orderedAt: Date;
  deliveredAt: Date | null;
  itemNames: string[];
}

/**
 * Everything the reply step may know. It carries the decision that has
 * already been made and customer-safe explanations only: never the
 * customer's raw message or internal reasons, so there is nothing in it to
 * inject into.
 */
export interface ReplyContext {
  customerName: string | null;
  outcome: Decision | 'NEEDS_INFO';
  orderId: string | null;
  /** Only set when the outcome is APPROVED. */
  refundAmountCents: number | null;
  explanations: string[];
  /** For NEEDS_INFO: the orders the customer can choose between. */
  candidateOrders: CustomerOrderSummary[];
}

/**
 * The seam between the app and a language model. Implementations only make
 * the call and return raw text; AiService adds the timeout, the retry and
 * the validation, so every provider gets the same safety handling.
 */
export interface LlmProvider {
  readonly name: LlmProviderName;

  /** Returns the model's raw output, which should be the ExtractedIntent JSON. */
  extractIntent(
    message: string,
    customerOrders: CustomerOrderSummary[],
    signal: AbortSignal,
  ): Promise<string>;

  /** Returns the customer-facing reply text for an already-made decision. */
  composeReply(context: ReplyContext, signal: AbortSignal): Promise<string>;
}

/** A provider failure, flagged with whether retrying could help. */
export class LlmProviderError extends Error {
  readonly retryable: boolean;

  constructor(
    message: string,
    options: { retryable: boolean; cause?: unknown },
  ) {
    super(message, { cause: options.cause });
    this.name = 'LlmProviderError';
    this.retryable = options.retryable;
  }
}
