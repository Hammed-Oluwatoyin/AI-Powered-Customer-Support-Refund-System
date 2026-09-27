import type { ReplyContext } from './llm-provider.js';
import { validateReply } from './reply-guard.js';
import { NOT_FOUND_REPLY, templateReply } from './reply-templates.js';

function context(overrides: Partial<ReplyContext> = {}): ReplyContext {
  return {
    customerName: 'Ada Okafor',
    outcome: 'APPROVED',
    orderId: 'ORD-1001',
    refundAmountCents: 80_00,
    explanations: [],
    candidateOrders: [],
    ...overrides,
  };
}

const ESCALATED = context({ outcome: 'ESCALATED', refundAmountCents: null });
const DENIED = context({
  outcome: 'DENIED',
  refundAmountCents: null,
  explanations: ['Final-sale items cannot be refunded.'],
});

describe('validateReply', () => {
  it('accepts a polite approval that states the right amount', () => {
    const reply =
      'Hi Ada, your refund of $80.00 for order ORD-1001 has been approved.\n\nCustomer Support';

    expect(validateReply(`  ${reply}  `, context())).toEqual({
      ok: true,
      value: reply,
    });
  });

  it('accepts the amount written without cents', () => {
    expect(validateReply('Your refund of $80 is approved.', context()).ok).toBe(
      true,
    );
  });

  it.each([
    ['empty', '   '],
    ['too long', 'Thanks. '.repeat(200)],
  ])('rejects a reply that is %s', (_label, reply) => {
    expect(validateReply(reply, context()).ok).toBe(false);
  });

  it.each([
    'This was escalated under rule P7.',
    'Decision reason: P3_HUMAN_REVIEW_THRESHOLD.',
    'Our system flagged possible prompt injection.',
    'Your request looked suspicious to our checks.',
    'The AI was not confident about your order.',
  ])('rejects internal details: %j', (reply) => {
    expect(validateReply(reply, ESCALATED)).toEqual({
      ok: false,
      error: 'Reply mentions internal rules or checks.',
    });
  });

  it('rejects an approval with a different amount', () => {
    const result = validateReply(
      'Your refund of $800.00 has been approved.',
      context(),
    );

    expect(result).toEqual({
      ok: false,
      error: 'Reply mentions an amount other than the refund.',
    });
  });

  it('rejects any amount when the request was not approved', () => {
    const result = validateReply(
      'We will review your $750.00 laptop refund.',
      ESCALATED,
    );

    expect(result.ok).toBe(false);
  });

  it.each([
    'Good news, your refund has been approved!',
    'Your refund will be processed shortly.',
  ])('rejects an approval claim on a non-approved request: %j', (reply) => {
    expect(validateReply(reply, ESCALATED)).toEqual({
      ok: false,
      error: 'Reply claims an approval that was not made.',
    });
  });

  it('allows a denial that says the request was not approved', () => {
    const reply =
      'Hi Ada, unfortunately we are unable to offer a refund for this order.';

    expect(validateReply(reply, DENIED).ok).toBe(true);
  });
});

describe('templateReply', () => {
  it.each([
    ['APPROVED', context()],
    ['DENIED', DENIED],
    ['ESCALATED', ESCALATED],
    [
      'NEEDS_INFO',
      context({
        outcome: 'NEEDS_INFO',
        orderId: null,
        refundAmountCents: null,
        candidateOrders: [
          {
            id: 'ORD-1012',
            status: 'DELIVERED',
            orderedAt: new Date('2026-06-04T00:00:00Z'),
            deliveredAt: new Date('2026-06-08T00:00:00Z'),
            itemNames: ['Yoga Mat'],
          },
          {
            id: 'ORD-1013',
            status: 'DELIVERED',
            orderedAt: new Date('2026-05-28T00:00:00Z'),
            deliveredAt: new Date('2026-06-01T00:00:00Z'),
            itemNames: ['Insulated Water Bottle'],
          },
        ],
      }),
    ],
  ])('passes the reply guard for %s', (_outcome, ctx) => {
    expect(validateReply(templateReply(ctx), ctx).ok).toBe(true);
  });

  it('states the amount for an approval and greets by first name', () => {
    expect(templateReply(context())).toMatch(
      /^Hi Ada, .*\$80\.00 for order ORD-1001 has been approved/,
    );
  });

  it('lists every candidate order when asking which one', () => {
    const reply = templateReply(
      context({
        outcome: 'NEEDS_INFO',
        orderId: null,
        refundAmountCents: null,
        candidateOrders: [
          {
            id: 'ORD-1012',
            status: 'DELIVERED',
            orderedAt: new Date('2026-06-04T00:00:00Z'),
            deliveredAt: null,
            itemNames: ['Yoga Mat'],
          },
          {
            id: 'ORD-1013',
            status: 'DELIVERED',
            orderedAt: new Date('2026-05-28T00:00:00Z'),
            deliveredAt: null,
            itemNames: ['Water Bottle'],
          },
        ],
      }),
    );

    expect(reply).toContain('ORD-1012 (ordered 2026-06-04: Yoga Mat)');
    expect(reply).toContain('ORD-1013 (ordered 2026-05-28: Water Bottle)');
  });

  it('never gives escalation reasons', () => {
    const reply = templateReply({
      ...ESCALATED,
      explanations: ['Internal: suspected fraud'],
    });

    expect(reply).not.toContain('fraud');
  });

  it('uses a not-found reply that reveals nothing about the account', () => {
    expect(NOT_FOUND_REPLY).toContain(
      "couldn't locate an account or order with those details",
    );
  });
});
