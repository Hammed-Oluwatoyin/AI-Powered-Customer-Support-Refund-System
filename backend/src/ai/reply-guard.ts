import type { Validated } from './intent-parser.js';
import type { ReplyContext } from './llm-provider.js';

export const MAX_REPLY_LENGTH = 1_000;

/** Rule codes such as P7 or P7_OWNERSHIP, and other internal identifiers. */
const INTERNAL_IDENTIFIER = /\bP[1-9]\b|\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/;

/** Internal concepts the customer must not see. */
const INTERNAL_TERMS =
  /\b(?:prompt injection|injection|rules? engine|policy engine|policy system|confidence|fraud|suspicious|flagged|language model|artificial intelligence|AI)\b/i;

/** Claims that a refund went through, which only an approval may make. */
const APPROVAL_CLAIM =
  /\b(?:has been|is|was|been) approved\b|\brefund (?:has been|was|will be) (?:issued|processed|sent)\b/i;

const MONEY_AMOUNT = /\$\s?(\d[\d,]*(?:\.\d{1,2})?)/g;

/**
 * Last line of defence on AI-written replies: rejects anything that leaks
 * internals or promises more than the decision. A rejected reply counts as
 * invalid AI output, which escalates the request.
 */
export function validateReply(
  raw: string,
  context: ReplyContext,
): Validated<string> {
  const reply = raw.trim();

  if (reply.length === 0) {
    return { ok: false, error: 'Reply is empty.' };
  }
  if (reply.length > MAX_REPLY_LENGTH) {
    return {
      ok: false,
      error: `Reply is longer than ${MAX_REPLY_LENGTH} characters.`,
    };
  }
  if (INTERNAL_IDENTIFIER.test(reply) || INTERNAL_TERMS.test(reply)) {
    return { ok: false, error: 'Reply mentions internal rules or checks.' };
  }

  const amounts = [...reply.matchAll(MONEY_AMOUNT)].map((match) =>
    Math.round(Number(match[1].replaceAll(',', '')) * 100),
  );
  if (context.outcome === 'APPROVED') {
    if (amounts.some((cents) => cents !== context.refundAmountCents)) {
      return {
        ok: false,
        error: 'Reply mentions an amount other than the refund.',
      };
    }
  } else {
    if (amounts.length > 0) {
      return {
        ok: false,
        error: 'Reply mentions money for a request that was not approved.',
      };
    }
    if (APPROVAL_CLAIM.test(reply)) {
      return {
        ok: false,
        error: 'Reply claims an approval that was not made.',
      };
    }
  }

  return { ok: true, value: reply };
}
