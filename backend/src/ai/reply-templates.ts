import { formatCents } from '../policy/money.js';
import type { ReplyContext } from './llm-provider.js';
import { firstName } from './prompts/reply.prompt.js';

const SIGN_OFF = 'Customer Support';

/**
 * Sent when no account or order matches. Deliberately identical whether the
 * email exists or not, so it cannot be used to discover customers.
 */
export const NOT_FOUND_REPLY = `Hello, thank you for getting in touch. We couldn't locate an account or order with those details. Please check the email address and order ID and try again.\n\n${SIGN_OFF}`;

/**
 * Deterministic replies, used by the mock provider and as the fallback when
 * an AI-written reply fails or does not pass the reply guard.
 */
export function templateReply(context: ReplyContext): string {
  const name = firstName(context.customerName);
  const greeting = name ? `Hi ${name},` : 'Hello,';
  const order = context.orderId ? ` for order ${context.orderId}` : '';
  const explanations = context.explanations.join(' ');

  switch (context.outcome) {
    case 'APPROVED': {
      const amount =
        context.refundAmountCents === null
          ? 'your refund'
          : `your refund of ${formatCents(context.refundAmountCents)}`;
      return join(
        `${greeting} good news: ${amount}${order} has been approved.`,
        explanations,
        'Thank you for shopping with us.',
      );
    }
    case 'DENIED':
      return join(
        `${greeting} thank you for contacting us about your refund request${order}.`,
        `Unfortunately we're unable to offer a refund.`,
        explanations,
        'If you have any questions, just reply to this message.',
      );
    case 'ESCALATED':
      return join(
        `${greeting} thank you for contacting us about your refund request${order}.`,
        'A member of our team will review it and get back to you.',
      );
    case 'NEEDS_INFO': {
      const options = context.candidateOrders
        .map(
          (o) =>
            `${o.id} (ordered ${o.orderedAt.toISOString().slice(0, 10)}: ${o.itemNames.join(', ')})`,
        )
        .join('; ');
      return join(
        `${greeting} we'd be happy to help with your refund request.`,
        `Which order is it about? Your recent orders are ${options}.`,
        'Please reply with the order ID.',
      );
    }
  }
}

function join(...sentences: string[]): string {
  return `${sentences.filter(Boolean).join(' ')}\n\n${SIGN_OFF}`;
}
