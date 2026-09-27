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
