import { apiRequest } from './client.ts'
import type {
  AdminRequestDetail,
  PagedRequests,
  RequestFilters,
  RequestStats,
} from './types.ts'

export const ADMIN_PAGE_SIZE = 10

const withKey = (adminKey: string) => ({ 'x-admin-key': adminKey })

export function fetchStats(adminKey: string): Promise<RequestStats> {
  return apiRequest('/admin/stats', { headers: withKey(adminKey) })
}

export function fetchRequests(
  adminKey: string,
  filters: RequestFilters,
): Promise<PagedRequests> {
  const params = new URLSearchParams({
    page: String(filters.page),
    pageSize: String(ADMIN_PAGE_SIZE),
  })
  if (filters.decision) params.set('decision', filters.decision)
  if (filters.status) params.set('status', filters.status)
  return apiRequest(`/admin/requests?${params}`, { headers: withKey(adminKey) })
}

export function fetchRequest(
  adminKey: string,
  id: string,
): Promise<AdminRequestDetail> {
  return apiRequest(`/admin/requests/${encodeURIComponent(id)}`, {
    headers: withKey(adminKey),
  })
}

export function overrideDecision(
  adminKey: string,
  id: string,
  body: { decision: 'APPROVED' | 'DENIED'; note: string },
): Promise<AdminRequestDetail> {
  return apiRequest(`/admin/requests/${encodeURIComponent(id)}/decision`, {
    method: 'PATCH',
    headers: withKey(adminKey),
    body: JSON.stringify(body),
  })
}
