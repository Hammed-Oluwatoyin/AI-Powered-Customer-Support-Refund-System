import { apiRequest } from './client.ts'
import type { RefundRequestBody, RefundResponse } from './types.ts'

export function submitRefund(body: RefundRequestBody): Promise<RefundResponse> {
  return apiRequest<RefundResponse>('/refunds', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}
