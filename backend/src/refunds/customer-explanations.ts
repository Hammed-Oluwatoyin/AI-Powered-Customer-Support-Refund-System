import { REFUND_WINDOW_DAYS } from '../config/policy.constants.js';
import { RULE, type PolicyDecision } from '../policy/policy.types.js';

/**
 * Turns a policy decision into explanations the customer may see.
 *
 * Denials and partial refunds are explained in customer-friendly terms.
 * Escalations are never explained, so a customer cannot learn which check
 * (fraud, injection, frequency) caught them. Internal rule names never
 * leave this function.
 */
export function customerExplanations(decision: PolicyDecision): string[] {
  if (decision.decision === 'ESCALATED') return [];

  const denied = decision.decision === 'DENIED';
  const explanations: string[] = [];
  for (const rule of decision.rulesFired) {
    switch (rule) {
      case RULE.P1_REFUND_WINDOW:
        explanations.push(
          `Refunds must be requested within ${REFUND_WINDOW_DAYS} days of delivery, and this order was delivered more than ${REFUND_WINDOW_DAYS} days ago.`,
        );
        break;
      case RULE.P2_FINAL_SALE:
        explanations.push(
          denied
            ? 'Items marked as final sale cannot be refunded.'
            : 'Final-sale items on the order are not included in the refund.',
        );
        break;
      case RULE.P4_ALREADY_REFUNDED:
        explanations.push(
          denied
            ? 'The items on this order have already been refunded.'
            : 'Items that were already refunded are not included.',
        );
        break;
      default:
        break;
    }
  }
  return explanations;
}
