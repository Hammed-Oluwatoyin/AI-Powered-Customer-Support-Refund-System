import { randomUUID } from 'node:crypto';
import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { AiService, type ExtractionResult } from '../ai/ai.service.js';
import type { ReplyContext } from '../ai/llm-provider.js';
import { NOT_FOUND_REPLY, templateReply } from '../ai/reply-templates.js';
import { AuditService, type AuditTrail } from '../audit/audit.service.js';
import { toJson } from '../common/json.js';
import { REFUND_FREQUENCY_WINDOW_DAYS } from '../config/policy.constants.js';
import {
  CustomersService,
  candidateOrders,
  type CustomerWithOrders,
  type VerifiedOrder,
} from '../customers/customers.service.js';
import type { Decision, RefundStatus } from '../generated/prisma/enums.js';
import { RULE, type PolicyInput } from '../policy/policy.types.js';
import { RulesEngineService } from '../policy/rules-engine.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { customerExplanations } from './customer-explanations.js';
import type { CreateRefundRequestDto } from './dto/create-refund-request.dto.js';
import {
  centsToDecimal,
  toCandidateOrder,
  toOrderSummary,
  toPolicyOrder,
} from './refund.mappers.js';
import type { RefundResponse } from './refund-response.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Recorded when an AI reply fails and the request is escalated instead. */
export const AI_REPLY_FAILED = 'AI_REPLY_FAILED';

/** Evaluate-and-save attempts, in case another request refunds the same items meanwhile. */
const MAX_SAVE_ATTEMPTS = 2;

interface IncomingRequest {
  id: string;
  receivedAt: Date;
  email: string;
  requestedOrderId: string | null;
  message: string;
}

/** Everything that gets saved for a request, and what the customer is told. */
interface Outcome {
  status: RefundStatus;
  decision: Decision | null;
  /** Only set once the order has been verified to exist. */
  orderId: string | null;
  rulesFired: string[];
  reasons: string[];
  /** The refund for APPROVED, or the amount at stake for ESCALATED. */
  refundAmountCents: number | null;
  /** Items to mark refunded; only for APPROVED. */
  itemIdsToRefund: string[];
  candidateOrders: VerifiedOrder[];
  reply: string;
}

type OrderResolution =
  | {
      kind: 'found';
      order: VerifiedOrder;
      source: 'request' | 'message' | 'only_candidate';
    }
  | { kind: 'not_found'; orderId: string | null }
  | { kind: 'ambiguous'; candidates: VerifiedOrder[] };

class ItemsAlreadyRefundedError extends Error {}

/**
 * Orchestrates a refund request. The AI extracts and communicates; it never
 * decides:
 *
 *   RECEIVED -> EXTRACTED (AI) -> VERIFIED (database) -> EVALUATED (rules
 *   engine) -> REPLIED (AI), then everything is saved in one transaction.
 *
 * Every step is recorded in the audit trail, and any AI failure ends in
 * ESCALATED.
 */
@Injectable()
export class RefundsService {
  private readonly logger = new Logger(RefundsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly customers: CustomersService,
    private readonly ai: AiService,
    private readonly rulesEngine: RulesEngineService,
    private readonly audit: AuditService,
  ) {}

  async submit(dto: CreateRefundRequestDto): Promise<RefundResponse> {
    const request: IncomingRequest = {
      id: randomUUID(),
      receivedAt: new Date(),
      email: dto.email,
      requestedOrderId: dto.orderId ?? null,
      message: dto.message,
    };
    const trail = this.audit.startTrail(request.id);
    trail.record('RECEIVED', {
      email: request.email,
      requestedOrderId: request.requestedOrderId,
      messageLength: request.message.length,
    });

    let customer = await this.customers.findByEmail(request.email);
    if (!customer) {
      // No AI call: nothing to assess, and the reply must not reveal
      // whether the email exists.
      trail.record('VERIFIED', { customerFound: false });
      return this.save(
        request,
        trail,
        null,
        this.notFound(trail, 'No customer with this email.'),
      );
    }

    const extraction = await this.ai.extractIntent(
      request.message,
      customer.orders.map(toOrderSummary),
    );
    trail.record('EXTRACTED', extractionRecord(extraction));
    if (!extraction.ok) {
      trail.record('ERROR', {
        stage: 'extraction',
        ...extraction.failure,
        provider: extraction.provider,
        attempts: extraction.attempts,
      });
    }

    for (let attempt = 1; ; attempt++) {
      const attemptTrail = trail.fork();
      const outcome = await this.decide(
        request,
        customer,
        extraction,
        attemptTrail,
      );
      try {
        return await this.save(request, attemptTrail, extraction, outcome);
      } catch (error) {
        if (!(error instanceof ItemsAlreadyRefundedError)) throw error;
        if (attempt >= MAX_SAVE_ATTEMPTS) {
          throw new ConflictException(
            'This order was updated while your request was processed. Please try again.',
          );
        }
        // Another request refunded some of these items first: decide again
        // from fresh data, which the policy will now see as refunded.
        this.logger.warn('Items were refunded concurrently; re-evaluating', {
          requestId: request.id,
        });
        customer =
          (await this.customers.findByEmail(request.email)) ?? customer;
      }
    }
  }

  /** VERIFIED, EVALUATED and REPLIED: works out the outcome without saving it. */
  private async decide(
    request: IncomingRequest,
    customer: CustomerWithOrders,
    extraction: ExtractionResult,
    trail: AuditTrail,
  ): Promise<Outcome> {
    const resolution = await this.resolveOrder(request, customer, extraction);
    const recentRefundCount = await this.countRecentApprovedRefunds(request);
    trail.record('VERIFIED', {
      customerFound: true,
      requestedOrderId: request.requestedOrderId,
      extractedOrderId: extraction.ok ? extraction.intent.orderId : null,
      resolution: resolution.kind,
      ...(resolution.kind === 'found' && {
        orderId: resolution.order.id,
        orderSource: resolution.source,
        orderOwnedByRequester:
          resolution.order.customer.email === request.email,
      }),
      ...(resolution.kind === 'not_found' && { orderId: resolution.orderId }),
      ...(resolution.kind === 'ambiguous' && {
        candidateOrderIds: resolution.candidates.map((o) => o.id),
      }),
      recentRefundCount,
    });

    if (resolution.kind !== 'found' && !extraction.ok) {
      // No order to evaluate and no trustworthy extraction: a human decides.
      return this.withReply(
        trail,
        {
          status: 'DECIDED',
          decision: 'ESCALATED',
          orderId: null,
          rulesFired: [RULE.AI_EXTRACTION_FAILED],
          reasons: [
            'AI extraction failed and the order could not be identified without it.',
          ],
          refundAmountCents: null,
          itemIdsToRefund: [],
          candidateOrders: [],
        },
        this.replyContext(customer, 'ESCALATED', null),
      );
    }

    if (resolution.kind === 'not_found') {
      return this.notFound(
        trail,
        resolution.orderId
          ? `Order ${resolution.orderId} does not exist.`
          : 'The customer has no orders with refundable items.',
      );
    }

    if (resolution.kind === 'ambiguous') {
      return this.withReply(
        trail,
        {
          status: 'NEEDS_INFO',
          decision: null,
          orderId: null,
          rulesFired: [],
          reasons: [
            `No order specified and ${resolution.candidates.length} orders could match; asked the customer which one.`,
          ],
          refundAmountCents: null,
          itemIdsToRefund: [],
          candidateOrders: resolution.candidates,
        },
        {
          ...this.replyContext(customer, 'NEEDS_INFO', null),
          candidateOrders: resolution.candidates.map(toOrderSummary),
        },
      );
    }

    const { order } = resolution;
    const input: PolicyInput = {
      now: request.receivedAt,
      requesterEmail: request.email,
      order: toPolicyOrder(order),
      recentRefundCount,
      intent: extraction.ok
        ? {
            reason: extraction.intent.reason,
            confidence: extraction.intent.confidence,
          }
        : null,
      injectionSuspected: extraction.injection.suspected,
    };
    const decision = this.rulesEngine.evaluate(input);
    // The input is stored with the decision so it can be reproduced exactly.
    trail.record('EVALUATED', { input, ...decision });

    const approved = decision.decision === 'APPROVED';
    return this.withReply(
      trail,
      {
        status: 'DECIDED',
        decision: decision.decision,
        orderId: order.id,
        rulesFired: decision.rulesFired,
        reasons: decision.reasons,
        refundAmountCents: decision.refundAmountCents,
        itemIdsToRefund: approved ? decision.eligibleItemIds : [],
        candidateOrders: [],
      },
      {
        ...this.replyContext(customer, decision.decision, order.id),
        refundAmountCents: approved ? decision.refundAmountCents : null,
        explanations: customerExplanations(decision),
      },
    );
  }

  /**
   * Which order the request is about. An order ID in the request wins over
   * one found in the message; without either, the customer's only order
   * with refundable items is used, and several mean we have to ask.
   */
  private async resolveOrder(
    request: IncomingRequest,
    customer: CustomerWithOrders,
    extraction: ExtractionResult,
  ): Promise<OrderResolution> {
    const extractedOrderId = extraction.ok ? extraction.intent.orderId : null;
    const orderId = request.requestedOrderId ?? extractedOrderId;
    if (orderId) {
      // Looked up whoever owns it, so the policy can check ownership (P7).
      const order = await this.customers.findOrder(orderId);
      return order
        ? {
            kind: 'found',
            order,
            source: request.requestedOrderId ? 'request' : 'message',
          }
        : { kind: 'not_found', orderId };
    }

    const candidates = candidateOrders(customer);
    if (candidates.length === 1) {
      return { kind: 'found', order: candidates[0], source: 'only_candidate' };
    }
    return candidates.length === 0
      ? { kind: 'not_found', orderId: null }
      : { kind: 'ambiguous', candidates };
  }

  /** P8 input: approved refunds (by the policy or an admin) in the lookback window. */
  private countRecentApprovedRefunds(
    request: IncomingRequest,
  ): Promise<number> {
    const since = new Date(
      request.receivedAt.getTime() - REFUND_FREQUENCY_WINDOW_DAYS * DAY_MS,
    );
    return this.prisma.refundRequest.count({
      where: {
        customerEmail: request.email,
        decision: 'APPROVED',
        createdAt: { gte: since },
      },
    });
  }

  /**
   * Adds the customer-facing reply. If the AI reply fails, the request is
   * escalated with a safe template reply: a person then makes sure the
   * customer gets a correct answer, and nothing is refunded automatically.
   */
  private async withReply(
    trail: AuditTrail,
    outcome: Omit<Outcome, 'reply'>,
    context: ReplyContext,
  ): Promise<Outcome> {
    const result = await this.ai.composeReply(context);
    if (result.ok) {
      trail.record('REPLIED', {
        source: 'ai',
        provider: result.provider,
        attempts: result.attempts,
      });
      return { ...outcome, reply: result.reply };
    }

    trail.record('ERROR', {
      stage: 'reply',
      ...result.failure,
      provider: result.provider,
      attempts: result.attempts,
    });
    const reply = templateReply({
      ...context,
      outcome: 'ESCALATED',
      refundAmountCents: null,
      explanations: [],
      candidateOrders: [],
    });
    trail.record('REPLIED', { source: 'template', template: 'ESCALATED' });
    return {
      ...outcome,
      status: 'DECIDED',
      decision: 'ESCALATED',
      rulesFired: [...outcome.rulesFired, AI_REPLY_FAILED],
      reasons: [
        ...outcome.reasons,
        `The AI reply failed (${result.failure.kind}), so the request was escalated instead of ${outcome.decision ?? outcome.status}.`,
      ],
      itemIdsToRefund: [],
      candidateOrders: [],
      reply,
    };
  }

  /** The generic reply that reveals nothing about which details were wrong. */
  private notFound(trail: AuditTrail, reason: string): Outcome {
    trail.record('REPLIED', { source: 'template', template: 'NOT_FOUND' });
    return {
      status: 'NEEDS_INFO',
      decision: null,
      orderId: null,
      rulesFired: [],
      reasons: [reason],
      refundAmountCents: null,
      itemIdsToRefund: [],
      candidateOrders: [],
      reply: NOT_FOUND_REPLY,
    };
  }

  private replyContext(
    customer: CustomerWithOrders,
    outcome: ReplyContext['outcome'],
    orderId: string | null,
  ): ReplyContext {
    return {
      customerName: customer.name,
      outcome,
      orderId,
      refundAmountCents: null,
      explanations: [],
      candidateOrders: [],
    };
  }

  /**
   * Saves the request, its audit trail and (for approvals) the refunded
   * items in one transaction. Items are only marked refunded if they still
   * aren't, so two concurrent requests can never refund the same item.
   */
  private async save(
    request: IncomingRequest,
    trail: AuditTrail,
    extraction: ExtractionResult | null,
    outcome: Outcome,
  ): Promise<RefundResponse> {
    await this.prisma.$transaction(async (tx) => {
      if (outcome.itemIdsToRefund.length > 0) {
        const { count } = await tx.orderItem.updateMany({
          where: { id: { in: outcome.itemIdsToRefund }, refunded: false },
          data: { refunded: true },
        });
        if (count !== outcome.itemIdsToRefund.length) {
          throw new ItemsAlreadyRefundedError();
        }
      }

      await tx.refundRequest.create({
        data: {
          id: request.id,
          customerEmail: request.email,
          orderId: outcome.orderId,
          message: request.message,
          extractedIntent: extraction
            ? toJson(extractionRecord(extraction))
            : undefined,
          decision: outcome.decision,
          status: outcome.status,
          rulesFired: outcome.rulesFired,
          reasons: outcome.reasons,
          refundAmount:
            outcome.refundAmountCents === null
              ? null
              : centsToDecimal(outcome.refundAmountCents),
          aiReply: outcome.reply,
          createdAt: request.receivedAt,
        },
      });
      await this.audit.writeTrail(tx, trail);
    });

    this.logger.log('Refund request saved', {
      requestId: request.id,
      status: outcome.status,
      decision: outcome.decision,
    });

    const approved = outcome.decision === 'APPROVED';
    return {
      requestId: request.id,
      decision: outcome.decision,
      status: outcome.status,
      reply: outcome.reply,
      refundAmount:
        approved && outcome.refundAmountCents !== null
          ? outcome.refundAmountCents / 100
          : null,
      candidateOrders: outcome.candidateOrders.map(toCandidateOrder),
    };
  }
}

/** What is stored as the request's extracted intent (and in the EXTRACTED event). */
function extractionRecord(extraction: ExtractionResult) {
  return {
    ok: extraction.ok,
    provider: extraction.provider,
    attempts: extraction.attempts,
    ...(extraction.ok
      ? { intent: extraction.intent }
      : { failure: extraction.failure }),
    injection: extraction.injection,
  };
}
