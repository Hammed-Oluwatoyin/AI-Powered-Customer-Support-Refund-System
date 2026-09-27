import type { RefundReason } from '../../config/policy.constants.js';
import type { ExtractedIntent } from '../extracted-intent.schema.js';
import type { InjectionDetector } from '../injection-detector.js';
import type {
  CustomerOrderSummary,
  LlmProvider,
  ReplyContext,
} from '../llm-provider.js';
import { templateReply } from '../reply-templates.js';

/**
 * Keyword rules, checked in order. "Not received" comes first so that
 * "never arrived" is not mistaken for an item-condition complaint.
 */
const REASON_KEYWORDS: ReadonlyArray<[RefundReason, RegExp]> = [
  [
    'not_received',
    /\b(?:never|not|didn't|did not|haven't|have not|hasn't|has not) (?:received|arrived|got|come|turned up)\b|\bnever (?:came|showed up)\b/i,
  ],
  [
    'damaged',
    /\b(?:damaged|broken|broke|cracked|chipped|snapped|shattered|defective|faulty|dented|torn|stopped working|won't turn on|doesn't work|does not work)\b/i,
  ],
  [
    'wrong_item',
    /\bwrong (?:size|item|colou?r|product|model)\b|\bsent (?:me )?the wrong\b|\bnot what I ordered\b/i,
  ],
  [
    'not_as_described',
    /\bnot as described\b|\b(?:doesn't|does not) match the description\b|\bdifferent from the (?:description|listing|pictures?|photos?)\b|\bmisleading\b/i,
  ],
  [
    'changed_mind',
    /\bchanged my mind\b|\bchange of mind\b|\bno longer (?:want|need)\b|\b(?:don't|do not) (?:want|need) it\b/i,
  ],
];

const ORDER_ID_IN_TEXT = /\bORD-\d+\b/i;

/**
 * Deterministic stand-in for a real model, so the whole system runs without
 * an API key and the tests can make exact assertions. It returns raw JSON
 * just like a model would, so its output goes through the same parsing and
 * validation.
 */
export class MockProvider implements LlmProvider {
  readonly name = 'mock' as const;

  constructor(private readonly injectionDetector: InjectionDetector) {}

  extractIntent(
    message: string,
    customerOrders: CustomerOrderSummary[],
  ): Promise<string> {
    const orderId = findOrderId(message, customerOrders);
    const reason = classifyReason(message);
    const intent: ExtractedIntent = {
      orderId,
      reason,
      summary: `Customer requests a refund (${reason}) for ${orderId ?? 'an unspecified order'}.`,
      confidence: reason === 'other' ? 0.3 : 0.9,
      injectionSuspected: this.injectionDetector.detect(message).suspected,
    };
    return Promise.resolve(JSON.stringify(intent));
  }

  composeReply(context: ReplyContext): Promise<string> {
    return Promise.resolve(templateReply(context));
  }
}

function classifyReason(message: string): RefundReason {
  const match = REASON_KEYWORDS.find(([, pattern]) => pattern.test(message));
  return match ? match[0] : 'other';
}

/** An explicit order ID, or the one order whose item the message names. */
function findOrderId(
  message: string,
  customerOrders: CustomerOrderSummary[],
): string | null {
  const explicit = ORDER_ID_IN_TEXT.exec(message);
  if (explicit) return explicit[0].toUpperCase();

  const text = message.toLowerCase();
  const named = customerOrders.filter((order) =>
    order.itemNames.some((item) => text.includes(item.toLowerCase())),
  );
  return named.length === 1 ? named[0].id : null;
}
