// Mirrors of the backend's response shapes (backend/src/refunds, demo).

export type Decision = 'APPROVED' | 'DENIED' | 'ESCALATED'
export type RefundStatus = 'DECIDED' | 'NEEDS_INFO' | 'RESOLVED_BY_ADMIN'

export interface CandidateOrder {
  id: string
  orderedAt: string
  items: string[]
}

export interface RefundRequestBody {
  email: string
  message: string
  orderId?: string
}

export interface RefundResponse {
  requestId: string
  decision: Decision | null
  status: RefundStatus
  reply: string
  refundAmount: number | null
  candidateOrders: CandidateOrder[]
}

export interface DemoScenario {
  id: number
  title: string
  customerName: string
  email: string
  message: string
  expected: {
    decision: Decision | null
    status: RefundStatus
    refundAmount: number | null
  }
}

/** The backend's standard error body (AllExceptionsFilter). */
export interface ApiErrorBody {
  statusCode: number
  error: string
  message: string | string[]
}

// ---- Admin API (backend/src/admin/admin-views.ts) ---------------------------

export type AuditStep =
  | 'RECEIVED'
  | 'EXTRACTED'
  | 'VERIFIED'
  | 'EVALUATED'
  | 'REPLIED'
  | 'ADMIN_OVERRIDE'
  | 'ERROR'

export interface AdminRequestSummary {
  id: string
  createdAt: string
  customerEmail: string
  orderId: string | null
  decision: Decision | null
  status: RefundStatus
  /** The refund if approved, otherwise the amount at stake. */
  refundAmount: number | null
  rulesFired: string[]
  messagePreview: string
}

/** What the refund flow stores as the request's extracted intent. */
export interface ExtractionRecord {
  ok: boolean
  provider: string
  attempts: number
  intent?: {
    orderId: string | null
    reason: string
    summary: string
    confidence: number
    injectionSuspected: boolean
  }
  failure?: { kind: string; message: string }
  injection: {
    suspected: boolean
    heuristicMatches: string[]
    modelFlagged: boolean | null
  }
}

export interface AdminRequestDetail
  extends Omit<AdminRequestSummary, 'messagePreview'> {
  message: string
  extractedIntent: ExtractionRecord | null
  reasons: string[]
  aiReply: string | null
  order: {
    id: string
    status: string
    orderedAt: string
    deliveredAt: string | null
    items: Array<{
      id: string
      name: string
      unitPrice: number
      quantity: number
      isFinalSale: boolean
      refunded: boolean
    }>
  } | null
  auditEvents: Array<{
    id: number
    step: AuditStep
    payload: unknown
    createdAt: string
  }>
}

export interface PagedRequests {
  items: AdminRequestSummary[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface RequestStats {
  total: number
  awaitingReview: number
  byDecision: Record<Decision | 'NONE', number>
  byStatus: Record<RefundStatus, number>
}

export interface RequestFilters {
  decision: Decision | ''
  status: RefundStatus | ''
  page: number
}
