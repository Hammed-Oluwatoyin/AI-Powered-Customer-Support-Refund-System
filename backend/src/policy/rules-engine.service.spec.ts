import {
  REFUND_FREQUENCY_WINDOW_DAYS,
  REFUND_REASONS,
  type RefundReason,
} from '../config/policy.constants.js';
import { DEMO_CUSTOMERS, PAST_REFUNDS } from '../demo/fixtures.js';
import { DEMO_SCENARIOS } from '../demo/scenarios.js';
import { itemId } from '../demo/seed.js';
import {
  RULE,
  type PolicyInput,
  type PolicyItem,
  type PolicyOrder,
} from './policy.types.js';
import { RulesEngineService } from './rules-engine.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-06-15T12:00:00.000Z');
const daysAgo = (days: number): Date => new Date(NOW.getTime() - days * DAY_MS);

const engine = new RulesEngineService();

// ---- Building inputs from the seed fixtures --------------------------------

function fixtureOrder(orderId: string): PolicyOrder {
  for (const customer of DEMO_CUSTOMERS) {
    const order = customer.orders.find((o) => o.id === orderId);
    if (!order) continue;
    return {
      id: order.id,
      customerEmail: customer.email,
      status: order.status,
      deliveredAt:
        order.deliveredDaysAgo === null
          ? null
          : daysAgo(order.deliveredDaysAgo),
      items: order.items.map((item, index) => ({
        id: itemId(order.id, index),
        name: item.name,
        unitPriceCents: Math.round(item.unitPrice * 100),
        quantity: item.quantity ?? 1,
        isFinalSale: item.isFinalSale ?? false,
        refunded: item.refunded ?? false,
      })),
    };
  }
  throw new Error(`No fixture order ${orderId}`);
}

function recentRefundCount(email: string): number {
  return PAST_REFUNDS.filter(
    (r) => r.email === email && r.daysAgo <= REFUND_FREQUENCY_WINDOW_DAYS,
  ).length;
}

/**
 * What the extraction step would return for each scenario. Scenario 11 (Kemi)
 * is NEEDS_INFO before the engine runs, because the message names no order;
 * here the customer has answered and picked ORD-1012.
 */
const SCENARIO_INPUTS: Record<
  number,
  {
    orderId: string;
    reason: RefundReason;
    confidence: number;
    injectionSuspected?: boolean;
  }
> = {
  1: { orderId: 'ORD-1001', reason: 'damaged', confidence: 0.95 },
  2: { orderId: 'ORD-1003', reason: 'wrong_item', confidence: 0.9 },
  3: { orderId: 'ORD-1004', reason: 'changed_mind', confidence: 0.9 },
  4: { orderId: 'ORD-1005', reason: 'changed_mind', confidence: 0.9 },
  5: { orderId: 'ORD-1006', reason: 'damaged', confidence: 0.95 },
  6: { orderId: 'ORD-1007', reason: 'damaged', confidence: 0.9 },
  7: { orderId: 'ORD-1008', reason: 'damaged', confidence: 0.9 },
  8: { orderId: 'ORD-1009', reason: 'changed_mind', confidence: 0.9 },
  9: {
    orderId: 'ORD-1010',
    reason: 'other',
    confidence: 0.5,
    injectionSuspected: true,
  },
  10: { orderId: 'ORD-1001', reason: 'damaged', confidence: 0.9 },
  11: { orderId: 'ORD-1012', reason: 'damaged', confidence: 0.9 },
  12: { orderId: 'ORD-1014', reason: 'not_received', confidence: 0.9 },
  13: { orderId: 'ORD-1015', reason: 'not_as_described', confidence: 0.9 },
  14: { orderId: 'ORD-1016', reason: 'other', confidence: 0.3 },
  15: { orderId: 'ORD-1017', reason: 'damaged', confidence: 0.9 },
};

function scenarioInput(scenarioId: number): PolicyInput {
  const scenario = DEMO_SCENARIOS.find((s) => s.id === scenarioId);
  if (!scenario) throw new Error(`No scenario ${scenarioId}`);
  const { orderId, reason, confidence, injectionSuspected } =
    SCENARIO_INPUTS[scenarioId];
  return {
    now: NOW,
    requesterEmail: scenario.email,
    order: fixtureOrder(orderId),
    recentRefundCount: recentRefundCount(scenario.email),
    intent: { reason, confidence },
    injectionSuspected: injectionSuspected ?? false,
  };
}

// ---- A plain, approvable request to vary one thing at a time ---------------

function item(overrides: Partial<PolicyItem> = {}): PolicyItem {
  return {
    id: 'ORD-1-1',
    name: 'Kettle',
    unitPriceCents: 80_00,
    quantity: 1,
    isFinalSale: false,
    refunded: false,
    ...overrides,
  };
}

function input(
  overrides: Partial<Omit<PolicyInput, 'order'>> & {
    order?: Partial<PolicyOrder>;
  } = {},
): PolicyInput {
  const { order, ...rest } = overrides;
  return {
    now: NOW,
    requesterEmail: 'customer@example.com',
    recentRefundCount: 0,
    intent: { reason: 'damaged', confidence: 0.9 },
    injectionSuspected: false,
    ...rest,
    order: {
      id: 'ORD-1',
      customerEmail: 'customer@example.com',
      status: 'DELIVERED',
      deliveredAt: daysAgo(5),
      items: [item()],
      ...order,
    },
  };
}

// ---- Tests -----------------------------------------------------------------

describe('RulesEngineService', () => {
  describe('seed scenarios', () => {
    const cases = DEMO_SCENARIOS.filter((s) => s.id !== 11);

    it.each(cases)(
      'scenario $id ($title): $expected.decision',
      ({ id, expected }) => {
        const result = engine.evaluate(scenarioInput(id));

        expect(result.decision).toBe(expected.decision);
        if (expected.decision === 'APPROVED') {
          expect(result.refundAmountCents).toBe(
            (expected.refundAmount ?? 0) * 100,
          );
        }
        if (expected.rule) {
          expect(result.rulesFired.at(-1)).toMatch(
            new RegExp(`^${expected.rule}_`),
          );
        } else {
          expect(result.rulesFired).toEqual([]);
        }
      },
    );

    it('scenario 11 (Kemi): once an order is chosen, the damaged item is approved', () => {
      const result = engine.evaluate(scenarioInput(11));

      expect(result).toMatchObject({
        decision: 'APPROVED',
        refundAmountCents: 35_00,
        eligibleItemIds: ['ORD-1012-1'],
      });
    });

    it('scenario 13 (Musa): refunds only the regular item of a mixed order', () => {
      const result = engine.evaluate(scenarioInput(13));

      expect(result).toMatchObject({
        decision: 'APPROVED',
        rulesFired: [RULE.P2_FINAL_SALE],
        refundAmountCents: 70_00,
        eligibleItemIds: ['ORD-1015-2'],
      });
    });

    it('scenario 5 (Emeka): reports the amount at stake for the reviewer', () => {
      const result = engine.evaluate(scenarioInput(5));

      expect(result.refundAmountCents).toBe(750_00);
    });
  });

  describe('boundaries', () => {
    it('allows a request exactly 30 days after delivery', () => {
      const result = engine.evaluate(
        input({ order: { deliveredAt: daysAgo(30) } }),
      );

      expect(result.decision).toBe('APPROVED');
    });

    it('denies a request one millisecond past 30 days', () => {
      const result = engine.evaluate(
        input({
          order: { deliveredAt: new Date(daysAgo(30).getTime() - 1) },
        }),
      );

      expect(result).toMatchObject({
        decision: 'DENIED',
        rulesFired: [RULE.P1_REFUND_WINDOW],
        refundAmountCents: null,
        eligibleItemIds: [],
      });
    });

    it('approves exactly $500 without review', () => {
      const result = engine.evaluate(
        input({ order: { items: [item({ unitPriceCents: 500_00 })] } }),
      );

      expect(result).toMatchObject({
        decision: 'APPROVED',
        refundAmountCents: 500_00,
      });
    });

    it('escalates $500.01', () => {
      const result = engine.evaluate(
        input({ order: { items: [item({ unitPriceCents: 500_01 })] } }),
      );

      expect(result).toMatchObject({
        decision: 'ESCALATED',
        rulesFired: [RULE.P3_HUMAN_REVIEW_THRESHOLD],
        refundAmountCents: 500_01,
      });
    });

    it('applies the $500 threshold to the eligible amount, not the order total', () => {
      const result = engine.evaluate(
        input({
          order: {
            items: [
              item({ id: 'a', unitPriceCents: 400_00, isFinalSale: true }),
              item({ id: 'b', unitPriceCents: 300_00 }),
            ],
          },
        }),
      );

      expect(result).toMatchObject({
        decision: 'APPROVED',
        refundAmountCents: 300_00,
      });
    });

    it('accepts a confidence of exactly 0.6', () => {
      const result = engine.evaluate(
        input({ intent: { reason: 'damaged', confidence: 0.6 } }),
      );

      expect(result.decision).toBe('APPROVED');
    });

    it('escalates a confidence just below 0.6', () => {
      const result = engine.evaluate(
        input({ intent: { reason: 'damaged', confidence: 0.599 } }),
      );

      expect(result).toMatchObject({
        decision: 'ESCALATED',
        rulesFired: [RULE.P9_LOW_CONFIDENCE],
      });
    });

    it('treats a non-numeric confidence as low', () => {
      const result = engine.evaluate(
        input({ intent: { reason: 'damaged', confidence: Number.NaN } }),
      );

      expect(result.rulesFired).toEqual([RULE.P9_LOW_CONFIDENCE]);
    });

    it('escalates at exactly 3 recent refunds but not at 2', () => {
      expect(engine.evaluate(input({ recentRefundCount: 3 }))).toMatchObject({
        decision: 'ESCALATED',
        rulesFired: [RULE.P8_REFUND_FREQUENCY],
      });
      expect(engine.evaluate(input({ recentRefundCount: 2 })).decision).toBe(
        'APPROVED',
      );
    });
  });

  describe('P7 ownership', () => {
    it('escalates when the order belongs to someone else', () => {
      const result = engine.evaluate(
        input({ requesterEmail: 'someone.else@example.com' }),
      );

      expect(result).toMatchObject({
        decision: 'ESCALATED',
        rulesFired: [RULE.P7_OWNERSHIP],
        refundAmountCents: null,
        eligibleItemIds: [],
      });
    });

    it('compares emails case-insensitively and ignores surrounding spaces', () => {
      const result = engine.evaluate(
        input({ requesterEmail: '  Customer@Example.COM ' }),
      );

      expect(result.decision).toBe('APPROVED');
    });
  });

  describe('P4 and P2 exclusions', () => {
    it('refunds the remaining items when some were already refunded', () => {
      const result = engine.evaluate(
        input({
          order: {
            items: [
              item({ id: 'a', name: 'Kettle', refunded: true }),
              item({ id: 'b', name: 'Toaster', unitPriceCents: 45_00 }),
            ],
          },
        }),
      );

      expect(result).toMatchObject({
        decision: 'APPROVED',
        rulesFired: [RULE.P4_ALREADY_REFUNDED],
        refundAmountCents: 45_00,
        eligibleItemIds: ['b'],
      });
      expect(result.reasons[0]).toContain('Kettle');
    });

    it('denies when refunded and final-sale items leave nothing to refund', () => {
      const result = engine.evaluate(
        input({
          order: {
            items: [
              item({ id: 'a', refunded: true }),
              item({ id: 'b', isFinalSale: true }),
            ],
          },
        }),
      );

      expect(result).toMatchObject({
        decision: 'DENIED',
        rulesFired: [RULE.P4_ALREADY_REFUNDED, RULE.P2_FINAL_SALE],
        refundAmountCents: null,
      });
    });

    it('multiplies unit price by quantity', () => {
      const result = engine.evaluate(
        input({
          order: { items: [item({ unitPriceCents: 9_00, quantity: 2 })] },
        }),
      );

      expect(result.refundAmountCents).toBe(18_00);
    });
  });

  describe('P5 delivery status', () => {
    it.each(['PROCESSING', 'SHIPPED'] as const)(
      'escalates every reason on a %s order',
      (status) => {
        for (const reason of REFUND_REASONS) {
          const result = engine.evaluate(
            input({
              order: { status, deliveredAt: null },
              intent: { reason, confidence: 0.9 },
            }),
          );

          expect(result.decision).toBe('ESCALATED');
          expect(result.rulesFired).toEqual([RULE.P5_DELIVERY_STATUS]);
        }
      },
    );

    it("escalates 'not received' on a delivered order", () => {
      const result = engine.evaluate(
        input({ intent: { reason: 'not_received', confidence: 0.9 } }),
      );

      expect(result.rulesFired).toEqual([RULE.P5_DELIVERY_STATUS]);
    });
  });

  describe('P6 qualifying reasons', () => {
    it.each([
      'damaged',
      'wrong_item',
      'not_as_described',
      'changed_mind',
    ] as const)('approves %s within the window', (reason) => {
      const result = engine.evaluate(
        input({ intent: { reason, confidence: 0.9 } }),
      );

      expect(result.decision).toBe('APPROVED');
    });

    it("escalates a reason the policy doesn't cover", () => {
      const result = engine.evaluate(
        input({ intent: { reason: 'other', confidence: 0.9 } }),
      );

      expect(result).toMatchObject({
        decision: 'ESCALATED',
        rulesFired: [RULE.P6_QUALIFYING_REASON],
        refundAmountCents: 80_00,
      });
    });
  });

  describe('evaluation order', () => {
    it('checks ownership before anything else', () => {
      const result = engine.evaluate(
        input({
          requesterEmail: 'someone.else@example.com',
          intent: null,
          injectionSuspected: true,
        }),
      );

      expect(result.rulesFired).toEqual([RULE.P7_OWNERSHIP]);
    });

    it('escalates an AI failure even when a later rule would deny', () => {
      const result = engine.evaluate(
        input({ intent: null, order: { deliveredAt: daysAgo(45) } }),
      );

      expect(result).toMatchObject({
        decision: 'ESCALATED',
        rulesFired: [RULE.AI_EXTRACTION_FAILED],
      });
    });

    it('escalates suspected injection before final-sale and window denials', () => {
      const result = engine.evaluate(
        input({
          injectionSuspected: true,
          order: {
            deliveredAt: daysAgo(45),
            items: [item({ isFinalSale: true })],
          },
        }),
      );

      expect(result.rulesFired).toEqual([RULE.P8_PROMPT_INJECTION]);
    });

    it('denies a final-sale item before checking the window', () => {
      const result = engine.evaluate(
        input({
          order: {
            deliveredAt: daysAgo(45),
            items: [item({ isFinalSale: true })],
          },
        }),
      );

      expect(result.rulesFired).toEqual([RULE.P2_FINAL_SALE]);
    });

    it('denies outside the window before checking status conflicts', () => {
      const result = engine.evaluate(
        input({
          order: { deliveredAt: daysAgo(45) },
          intent: { reason: 'not_received', confidence: 0.9 },
        }),
      );

      expect(result.rulesFired).toEqual([RULE.P1_REFUND_WINDOW]);
    });

    it('applies P5, then P8 frequency, then P9, then P3, then P6', () => {
      const everything = {
        recentRefundCount: 5,
        intent: { reason: 'other' as const, confidence: 0.1 },
        order: { items: [item({ unitPriceCents: 900_00 })] },
      };

      expect(
        engine.evaluate(
          input({
            ...everything,
            order: {
              ...everything.order,
              status: 'SHIPPED',
              deliveredAt: null,
            },
          }),
        ).rulesFired,
      ).toEqual([RULE.P5_DELIVERY_STATUS]);
      expect(engine.evaluate(input(everything)).rulesFired).toEqual([
        RULE.P8_REFUND_FREQUENCY,
      ]);
      expect(
        engine.evaluate(input({ ...everything, recentRefundCount: 0 }))
          .rulesFired,
      ).toEqual([RULE.P9_LOW_CONFIDENCE]);
      expect(
        engine.evaluate(
          input({
            ...everything,
            recentRefundCount: 0,
            intent: { reason: 'other', confidence: 0.9 },
          }),
        ).rulesFired,
      ).toEqual([RULE.P3_HUMAN_REVIEW_THRESHOLD]);
      expect(
        engine.evaluate(
          input({
            recentRefundCount: 0,
            intent: { reason: 'other', confidence: 0.9 },
          }),
        ).rulesFired,
      ).toEqual([RULE.P6_QUALIFYING_REASON]);
    });
  });

  describe('data problems escalate rather than guess', () => {
    it('escalates an order with no items', () => {
      const result = engine.evaluate(input({ order: { items: [] } }));

      expect(result.rulesFired).toEqual([RULE.DATA_INCONSISTENCY]);
    });

    it('escalates a DELIVERED order without a delivery date', () => {
      const result = engine.evaluate(input({ order: { deliveredAt: null } }));

      expect(result.rulesFired).toEqual([RULE.DATA_INCONSISTENCY]);
    });
  });

  describe('safety properties', () => {
    it('never approves when AI extraction failed, for any scenario', () => {
      for (const { id } of DEMO_SCENARIOS) {
        const result = engine.evaluate({ ...scenarioInput(id), intent: null });

        expect(result.decision).toBe('ESCALATED');
      }
    });

    it('never approves suspected injection, for any scenario', () => {
      for (const { id } of DEMO_SCENARIOS) {
        const result = engine.evaluate({
          ...scenarioInput(id),
          injectionSuspected: true,
        });

        expect(result.decision).toBe('ESCALATED');
      }
    });
  });

  describe('purity', () => {
    it('returns the same decision for the same input and does not mutate it', () => {
      const request = scenarioInput(13);
      const snapshot = structuredClone(request);

      const first = engine.evaluate(request);
      const second = engine.evaluate(request);

      expect(second).toEqual(first);
      expect(request).toEqual(snapshot);
    });

    it('does not read the clock: the decision depends only on `now`', () => {
      const lateRequest = input({ order: { deliveredAt: daysAgo(31) } });

      expect(engine.evaluate(lateRequest).decision).toBe('DENIED');
      expect(
        engine.evaluate({
          ...lateRequest,
          now: new Date(NOW.getTime() - 2 * DAY_MS),
        }).decision,
      ).toBe('APPROVED');
    });
  });
});
