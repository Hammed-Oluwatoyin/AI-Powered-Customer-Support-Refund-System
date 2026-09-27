import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import {
  Decision,
  RefundStatus,
  type Decision as DecisionValue,
  type RefundStatus as RefundStatusValue,
} from '../generated/prisma/enums.js';
import { refundableItems } from '../policy/eligibility.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { centsToDecimal, toCents } from '../refunds/refund.mappers.js';
import {
  REQUEST_DETAIL,
  toDetail,
  toSummary,
  type PagedRequests,
  type RequestDetail,
  type RequestStats,
} from './admin-views.js';
import {
  DEFAULT_PAGE_SIZE,
  type ListRequestsQueryDto,
} from './dto/list-requests-query.dto.js';
import type { OverrideDecisionDto } from './dto/override-decision.dto.js';

/** Requests an admin may still decide: escalated or needs-info, and not yet resolved. */
const AWAITING_REVIEW = {
  status: { not: RefundStatus.RESOLVED_BY_ADMIN },
  OR: [{ decision: Decision.ESCALATED }, { status: RefundStatus.NEEDS_INFO }],
} satisfies Prisma.RefundRequestWhereInput;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListRequestsQueryDto): Promise<PagedRequests> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const where: Prisma.RefundRequestWhereInput = {
      decision: query.decision,
      status: query.status,
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.refundRequest.count({ where }),
      this.prisma.refundRequest.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return {
      items: rows.map(toSummary),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async detail(id: string): Promise<RequestDetail> {
    const row = await this.prisma.refundRequest.findUnique({
      where: { id },
      ...REQUEST_DETAIL,
    });
    if (!row) {
      throw new NotFoundException(`Refund request ${id} was not found.`);
    }
    return toDetail(row);
  }

  async stats(): Promise<RequestStats> {
    const [byDecision, byStatus, awaitingReview] = await Promise.all([
      this.prisma.refundRequest.groupBy({ by: ['decision'], _count: true }),
      this.prisma.refundRequest.groupBy({ by: ['status'], _count: true }),
      this.prisma.refundRequest.count({ where: AWAITING_REVIEW }),
    ]);

    const decisions = { APPROVED: 0, DENIED: 0, ESCALATED: 0, NONE: 0 };
    for (const group of byDecision) {
      decisions[group.decision ?? 'NONE'] = group._count;
    }
    const statuses = { DECIDED: 0, NEEDS_INFO: 0, RESOLVED_BY_ADMIN: 0 };
    for (const group of byStatus) {
      statuses[group.status] = group._count;
    }

    return {
      total: Object.values(statuses).reduce((sum, n) => sum + n, 0),
      awaitingReview,
      byDecision: decisions,
      byStatus: statuses,
    };
  }

  /**
   * An admin resolves an escalated or needs-info request. Approving refunds
   * whatever on the order can still be refunded (P4 and P2 still apply),
   * using the order as it is now. A needs-info request with no order is
   * resolved without a refund.
   */
  async overrideDecision(
    id: string,
    dto: OverrideDecisionDto,
  ): Promise<RequestDetail> {
    await this.prisma.$transaction(async (tx) => {
      const request = await tx.refundRequest.findUnique({
        where: { id },
        include: { order: { include: { items: true } } },
      });
      if (!request) {
        throw new NotFoundException(`Refund request ${id} was not found.`);
      }
      if (!awaitingReview(request.decision, request.status)) {
        throw new ConflictException(
          'Only escalated or needs-info requests that have not been resolved can be overridden.',
        );
      }

      let refundedItemIds: string[] = [];
      let refundAmount: string | null = null;
      if (dto.decision === 'APPROVED' && request.order) {
        const items = refundableItems(request.order.items);
        if (items.length === 0) {
          throw new ConflictException(
            'Nothing on this order can still be refunded. Deny the request instead.',
          );
        }
        refundedItemIds = items.map((item) => item.id);
        const { count } = await tx.orderItem.updateMany({
          where: { id: { in: refundedItemIds }, refunded: false },
          data: { refunded: true },
        });
        if (count !== refundedItemIds.length) {
          throw new ConflictException(
            'Some of these items were refunded meanwhile. Reload and try again.',
          );
        }
        refundAmount = centsToDecimal(
          items.reduce(
            (sum, item) => sum + toCents(item.unitPrice) * item.quantity,
            0,
          ),
        );
      }

      // The status condition stops two admins resolving the same request.
      const { count } = await tx.refundRequest.updateMany({
        where: { id, status: { not: RefundStatus.RESOLVED_BY_ADMIN } },
        data: {
          decision: dto.decision,
          status: RefundStatus.RESOLVED_BY_ADMIN,
          refundAmount,
        },
      });
      if (count !== 1) {
        throw new ConflictException('This request has already been resolved.');
      }

      await this.audit.record(tx, id, 'ADMIN_OVERRIDE', {
        actor: 'admin-api-key',
        previousDecision: request.decision,
        previousStatus: request.status,
        decision: dto.decision,
        note: dto.note,
        refundedItemIds,
        refundAmount,
      });
    });

    return this.detail(id);
  }
}

function awaitingReview(
  decision: DecisionValue | null,
  status: RefundStatusValue,
): boolean {
  return (
    status !== RefundStatus.RESOLVED_BY_ADMIN &&
    (decision === Decision.ESCALATED || status === RefundStatus.NEEDS_INFO)
  );
}
