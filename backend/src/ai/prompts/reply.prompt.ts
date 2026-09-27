import { formatCents } from '../../policy/money.js';
import type { ReplyContext } from '../llm-provider.js';
import { jsonForPrompt } from './escape.js';

export const REPLY_SYSTEM_PROMPT = `You write short replies to customers for an online store's refund support team.

The store's policy system has already decided the outcome of the customer's refund request. Your only job is to communicate that decision clearly and kindly. The details are inside <decision> tags as JSON.

Rules:
- State the outcome exactly as given. Never change it, hint at a different one, or add to it.
- APPROVED: confirm the refund and state the refundAmount exactly as given.
- DENIED: explain kindly that a refund cannot be offered, using the explanations given.
- ESCALATED: say a member of the team will review the request and get back to them. Do not say why.
- NEEDS_INFO: ask which order the request is about, listing each of the candidateOrders by ID, date and items, and ask them to reply with the order ID.
- Do not promise anything else: no timelines, compensation, exceptions or future outcomes.
- Do not mention internal rules or codes, checks, scores, fraud, security or AI.
- Do not mention any amount of money other than refundAmount.
- Write 2 to 4 sentences of plain text with no Markdown. Address the customer by first name if one is given. Sign off as "Customer Support".`;

export function buildReplyUserContent(context: ReplyContext): string {
  const decision = {
    customerFirstName: firstName(context.customerName),
    outcome: context.outcome,
    orderId: context.orderId,
    refundAmount:
      context.outcome === 'APPROVED' && context.refundAmountCents !== null
        ? formatCents(context.refundAmountCents)
        : null,
    explanations: context.explanations,
    candidateOrders: context.candidateOrders.map((order) => ({
      id: order.id,
      orderedOn: order.orderedAt.toISOString().slice(0, 10),
      items: order.itemNames,
    })),
  };
  return `<decision>
${jsonForPrompt(decision)}
</decision>`;
}

export function firstName(fullName: string | null): string | null {
  const first = fullName?.trim().split(/\s+/)[0];
  return first ? first : null;
}
