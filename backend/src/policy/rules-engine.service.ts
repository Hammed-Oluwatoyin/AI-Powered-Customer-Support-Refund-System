import { Injectable } from '@nestjs/common';
import {
  HUMAN_REVIEW_THRESHOLD_CENTS,
  ITEM_CONDITION_REASONS,
  MIN_EXTRACTION_CONFIDENCE,
  QUALIFYING_REASONS,
  REFUND_FREQUENCY_LIMIT,
  REFUND_FREQUENCY_WINDOW_DAYS,
  REFUND_WINDOW_DAYS,
} from '../config/policy.constants.js';
import type { Decision } from '../generated/prisma/enums.js';
import { formatCents } from './money.js';
import {
  RULE,
  type PolicyDecision,
  type PolicyInput,
  type PolicyItem,
  type RuleId,
} from './policy.types.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The refund policy (docs/refund-policy.md) as a deterministic, pure
 * function: no database, no AI and no clock, so every decision can be
 * reproduced from its input.
 *
 * Rules run in a fixed order and the first rule that denies or escalates
 * decides. P4 and P2 can also exclude items without deciding, which is how
 * partial refunds work.
 */
@Injectable()
export class RulesEngineService {
  evaluate(input: PolicyInput): PolicyDecision {
    const { order, intent } = input;
    const trail = new DecisionTrail();

    // P7 Ownership: never assess an order on behalf of someone else.
    if (
      normaliseEmail(order.customerEmail) !==
      normaliseEmail(input.requesterEmail)
    ) {
      return trail.escalate(
        RULE.P7_OWNERSHIP,
        `Order ${order.id} belongs to a different customer than the requester (suspicious).`,
      );
    }

    // AI failure: without a trustworthy extraction, a human must decide.
    if (intent === null) {
      return trail.escalate(
        RULE.AI_EXTRACTION_FAILED,
        'AI extraction failed, so the request cannot be assessed automatically.',
      );
    }

    // P8 Suspected prompt injection.
    if (input.injectionSuspected) {
      return trail.escalate(
        RULE.P8_PROMPT_INJECTION,
        'The message appears to contain instructions aimed at the AI (suspected prompt injection).',
      );
    }

    if (order.items.length === 0) {
      return trail.escalate(
        RULE.DATA_INCONSISTENCY,
        `Order ${order.id} has no items.`,
      );
    }

    // P4 One refund per item: exclude items that were already refunded.
    let eligible = order.items;
    const alreadyRefunded = eligible.filter((item) => item.refunded);
    if (alreadyRefunded.length > 0) {
      eligible = eligible.filter((item) => !item.refunded);
      if (eligible.length === 0) {
        return trail.deny(
          RULE.P4_ALREADY_REFUNDED,
          `Every item on order ${order.id} has already been refunded.`,
        );
      }
      trail.note(
        RULE.P4_ALREADY_REFUNDED,
        `Excluded already-refunded item(s): ${itemNames(alreadyRefunded)}.`,
      );
    }

    // P2 Final sale: exclude final-sale items, refunding the rest.
    const finalSale = eligible.filter((item) => item.isFinalSale);
    if (finalSale.length > 0) {
      eligible = eligible.filter((item) => !item.isFinalSale);
      if (eligible.length === 0) {
        return trail.deny(
          RULE.P2_FINAL_SALE,
          `No refundable items remain; final sale: ${itemNames(finalSale)}.`,
        );
      }
      trail.note(
        RULE.P2_FINAL_SALE,
        `Excluded final-sale item(s): ${itemNames(finalSale)}.`,
      );
    }

    const amountCents = trail.setEligible(eligible);

    // P1 Refund window. It is measured from delivery, so it only applies to
    // delivered orders; undelivered ones are handled by P5 below.
    if (order.status === 'DELIVERED') {
      if (order.deliveredAt === null) {
        return trail.escalate(
          RULE.DATA_INCONSISTENCY,
          `Order ${order.id} is marked DELIVERED but has no delivery date.`,
        );
      }
      const elapsedMs = input.now.getTime() - order.deliveredAt.getTime();
      if (elapsedMs > REFUND_WINDOW_DAYS * DAY_MS) {
        return trail.deny(
          RULE.P1_REFUND_WINDOW,
          `Delivered ${Math.floor(elapsedMs / DAY_MS)} days ago; refunds must be requested within ${REFUND_WINDOW_DAYS} days of delivery.`,
        );
      }
    }

    // P5 Delivery status: the claim must be consistent with the order status.
    if (order.status === 'DELIVERED' && intent.reason === 'not_received') {
      return trail.escalate(
        RULE.P5_DELIVERY_STATUS,
        `Customer says the order was not received, but order ${order.id} is marked DELIVERED.`,
      );
    }
    if (order.status !== 'DELIVERED') {
      const detail = ITEM_CONDITION_REASONS.includes(intent.reason)
        ? `Customer reports '${intent.reason}', which conflicts with the order not being delivered yet`
        : 'The order has not been delivered yet, so a refund needs human review';
      return trail.escalate(
        RULE.P5_DELIVERY_STATUS,
        `${detail} (status ${order.status}).`,
      );
    }

    // P8 Refund frequency.
    if (input.recentRefundCount >= REFUND_FREQUENCY_LIMIT) {
      return trail.escalate(
        RULE.P8_REFUND_FREQUENCY,
        `Customer has ${input.recentRefundCount} approved refunds in the last ${REFUND_FREQUENCY_WINDOW_DAYS} days (review from ${REFUND_FREQUENCY_LIMIT}).`,
      );
    }

    // P9 Low confidence. A non-numeric confidence counts as low.
    const confident =
      Number.isFinite(intent.confidence) &&
      intent.confidence >= MIN_EXTRACTION_CONFIDENCE;
    if (!confident) {
      return trail.escalate(
        RULE.P9_LOW_CONFIDENCE,
        `AI extraction confidence ${intent.confidence} is below the ${MIN_EXTRACTION_CONFIDENCE} threshold.`,
      );
    }

    // P3 Human review threshold.
    if (amountCents > HUMAN_REVIEW_THRESHOLD_CENTS) {
      return trail.escalate(
        RULE.P3_HUMAN_REVIEW_THRESHOLD,
        `Refund of ${formatCents(amountCents)} exceeds the ${formatCents(HUMAN_REVIEW_THRESHOLD_CENTS)} human review threshold.`,
      );
    }

    // P6 Qualifying reason. Anything the policy does not cover goes to a human.
    if (!QUALIFYING_REASONS.includes(intent.reason)) {
      return trail.escalate(
        RULE.P6_QUALIFYING_REASON,
        `Reason '${intent.reason}' is not a qualifying refund reason.`,
      );
    }

    return trail.approve(
      `Reason '${intent.reason}' qualifies; refunding ${formatCents(amountCents)} for ${itemNames(eligible)}.`,
    );
  }
}

/** Collects the rules that fired and builds the final decision. */
class DecisionTrail {
  private readonly rulesFired: RuleId[] = [];
  private readonly reasons: string[] = [];
  private eligible: PolicyItem[] | null = null;

  /** Records a rule that changed the outcome without deciding it. */
  note(rule: RuleId, reason: string): void {
    this.rulesFired.push(rule);
    this.reasons.push(reason);
  }

  /** Fixes the items the refund would cover and returns their total in cents. */
  setEligible(items: PolicyItem[]): number {
    this.eligible = items;
    return totalCents(items);
  }

  deny(rule: RuleId, reason: string): PolicyDecision {
    this.note(rule, reason);
    return this.finish('DENIED');
  }

  escalate(rule: RuleId, reason: string): PolicyDecision {
    this.note(rule, reason);
    return this.finish('ESCALATED');
  }

  approve(reason: string): PolicyDecision {
    this.reasons.push(reason);
    return this.finish('APPROVED');
  }

  private finish(decision: Decision): PolicyDecision {
    const items = decision === 'DENIED' ? null : this.eligible;
    return {
      decision,
      rulesFired: this.rulesFired,
      reasons: this.reasons,
      refundAmountCents: items === null ? null : totalCents(items),
      eligibleItemIds: items === null ? [] : items.map((item) => item.id),
    };
  }
}

function totalCents(items: PolicyItem[]): number {
  return items.reduce(
    (sum, item) => sum + item.unitPriceCents * item.quantity,
    0,
  );
}

function itemNames(items: PolicyItem[]): string {
  return items.map((item) => item.name).join(', ');
}

function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}
