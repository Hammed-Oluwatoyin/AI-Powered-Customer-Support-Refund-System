import { RULE, type PolicyDecision } from '../policy/policy.types.js';
import { customerExplanations } from './customer-explanations.js';

function decision(overrides: Partial<PolicyDecision>): PolicyDecision {
  return {
    decision: 'APPROVED',
    rulesFired: [],
    reasons: [],
    refundAmountCents: null,
    eligibleItemIds: [],
    ...overrides,
  };
}

describe('customerExplanations', () => {
  it('explains each denial reason in plain language', () => {
    expect(
      customerExplanations(
        decision({ decision: 'DENIED', rulesFired: [RULE.P1_REFUND_WINDOW] }),
      ),
    ).toEqual([
      'Refunds must be requested within 30 days of delivery, and this order was delivered more than 30 days ago.',
    ]);
    expect(
      customerExplanations(
        decision({ decision: 'DENIED', rulesFired: [RULE.P2_FINAL_SALE] }),
      ),
    ).toEqual(['Items marked as final sale cannot be refunded.']);
    expect(
      customerExplanations(
        decision({
          decision: 'DENIED',
          rulesFired: [RULE.P4_ALREADY_REFUNDED],
        }),
      ),
    ).toEqual(['The items on this order have already been refunded.']);
  });

  it('notes excluded items on a partial approval', () => {
    expect(
      customerExplanations(decision({ rulesFired: [RULE.P2_FINAL_SALE] })),
    ).toEqual([
      'Final-sale items on the order are not included in the refund.',
    ]);
  });

  it('never explains an escalation', () => {
    for (const rule of Object.values(RULE)) {
      expect(
        customerExplanations(
          decision({
            decision: 'ESCALATED',
            rulesFired: [RULE.P2_FINAL_SALE, rule],
          }),
        ),
      ).toEqual([]);
    }
  });

  it('says nothing extra for a plain approval', () => {
    expect(customerExplanations(decision({}))).toEqual([]);
  });
});
