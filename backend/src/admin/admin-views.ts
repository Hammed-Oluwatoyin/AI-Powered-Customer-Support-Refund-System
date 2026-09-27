import type { Prisma } from '../generated/prisma/client.js';
import type {
  AuditStep,
  Decision,
  OrderStatus,
  RefundStatus,
} from '../generated/prisma/enums.js';

const PREVIEW_LENGTH = 140;

export const REQUEST_DETAIL = {
  include: {
    auditEvents: { orderBy: { id: 'asc' } },
    order: { include: { items: { orderBy: { id: 'asc' } } } },
  },
} satisfies Prisma.RefundRequestDefaultArgs;

type RequestRow = Prisma.RefundRequestGetPayload<true>;
type RequestDetailRow = Prisma.RefundRequestGetPayload<typeof REQUEST_DETAIL>;

export interface RequestSummary {
  id: string;
  createdAt: string;
  customerEmail: string;
  orderId: string | null;
  decision: Decision | null;
  status: RefundStatus;
  /** Dollars: the refund if approved, otherwise the amount at stake. */
  refundAmount: number | null;
  rulesFired: string[];
  messagePreview: string;
}

export interface RequestDetail extends Omit<RequestSummary, 'messagePreview'> {
  message: string;
  extractedIntent: Prisma.JsonValue;
  reasons: string[];
  aiReply: string | null;
  order: {
    id: string;
    status: OrderStatus;
    orderedAt: string;
    deliveredAt: string | null;
    items: Array<{
      id: string;
      name: string;
      unitPrice: number;
      quantity: number;
      isFinalSale: boolean;
      refunded: boolean;
    }>;
  } | null;
  auditEvents: Array<{
    id: number;
    step: AuditStep;
    payload: Prisma.JsonValue;
    createdAt: string;
  }>;
}

export interface PagedRequests {
  items: RequestSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface RequestStats {
  total: number;
  /** Escalated or needs-info requests that no admin has resolved yet. */
  awaitingReview: number;
  byDecision: Record<Decision | 'NONE', number>;
  byStatus: Record<RefundStatus, number>;
}

const dollars = (amount: Prisma.Decimal | null): number | null =>
  amount === null ? null : amount.toNumber();

const strings = (value: Prisma.JsonValue): string[] =>
  Array.isArray(value) ? value.map(String) : [];

/** The fields shared by the list and detail views. */
function baseFields(row: RequestRow): Omit<RequestSummary, 'messagePreview'> {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    customerEmail: row.customerEmail,
    orderId: row.orderId,
    decision: row.decision,
    status: row.status,
    refundAmount: dollars(row.refundAmount),
    rulesFired: strings(row.rulesFired),
  };
}

export function toSummary(row: RequestRow): RequestSummary {
  return {
    ...baseFields(row),
    messagePreview:
      row.message.length > PREVIEW_LENGTH
        ? `${row.message.slice(0, PREVIEW_LENGTH)}…`
        : row.message,
  };
}

export function toDetail(row: RequestDetailRow): RequestDetail {
  return {
    ...baseFields(row),
    message: row.message,
    extractedIntent: row.extractedIntent,
    reasons: strings(row.reasons),
    aiReply: row.aiReply,
    order: row.order && {
      id: row.order.id,
      status: row.order.status,
      orderedAt: row.order.orderedAt.toISOString(),
      deliveredAt: row.order.deliveredAt?.toISOString() ?? null,
      items: row.order.items.map((item) => ({
        id: item.id,
        name: item.name,
        unitPrice: item.unitPrice.toNumber(),
        quantity: item.quantity,
        isFinalSale: item.isFinalSale,
        refunded: item.refunded,
      })),
    },
    auditEvents: row.auditEvents.map((event) => ({
      id: event.id,
      step: event.step,
      payload: event.payload,
      createdAt: event.createdAt.toISOString(),
    })),
  };
}
