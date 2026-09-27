import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useState } from 'react'
import { fetchRequest, fetchRequests, fetchStats } from '../api/admin.ts'
import { ApiError } from '../api/client.ts'
import type { RequestFilters } from '../api/types.ts'
import { AdminKeyForm } from '../components/admin/AdminKeyForm.tsx'
import { RequestDetailPanel } from '../components/admin/RequestDetailPanel.tsx'
import { RequestsTable } from '../components/admin/RequestsTable.tsx'
import { StatsRow } from '../components/admin/StatsRow.tsx'
import { useAdminKey } from '../lib/admin-key.ts'

const isUnauthorised = (error: unknown) =>
  error instanceof ApiError && error.status === 401

/** A wrong key will not start working on a retry. */
const retryUnlessUnauthorised = (failures: number, error: Error) =>
  !isUnauthorised(error) && failures < 1

/**
 * Staff view: stats, a filterable list of requests, and the full trace of
 * the selected one, with approve/deny for requests awaiting review.
 */
export function AdminDashboard() {
  const { adminKey, setAdminKey } = useAdminKey()
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<RequestFilters>({
    decision: '',
    status: '',
    page: 1,
  })
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const key = adminKey ?? ''
  const enabled = adminKey !== null
  const stats = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => fetchStats(key),
    enabled,
    retry: retryUnlessUnauthorised,
  })
  const requests = useQuery({
    queryKey: ['admin', 'requests', filters],
    queryFn: () => fetchRequests(key, filters),
    enabled,
    retry: retryUnlessUnauthorised,
    placeholderData: keepPreviousData,
  })
  const detail = useQuery({
    queryKey: ['admin', 'request', selectedId],
    queryFn: () => fetchRequest(key, selectedId ?? ''),
    enabled: enabled && selectedId !== null,
    retry: retryUnlessUnauthorised,
  })

  /** Switches to a different key (or none), dropping everything cached for the old one. */
  function switchKey(value: string | null) {
    queryClient.removeQueries({ queryKey: ['admin'] })
    setSelectedId(null)
    setAdminKey(value)
  }

  const rejected = [stats.error, requests.error, detail.error].some(
    isUnauthorised,
  )
  if (adminKey === null || rejected) {
    return (
      <AdminKeyForm
        error={rejected ? 'That admin key was not accepted.' : null}
        onSubmit={switchKey}
      />
    )
  }

  const loadError = [stats.error, requests.error, detail.error].find(
    (error) => error && !isUnauthorised(error),
  )

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Admin dashboard</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() =>
              queryClient.invalidateQueries({ queryKey: ['admin'] })
            }
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => switchKey(null)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            Lock
          </button>
        </div>
      </div>

      {loadError && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
          {loadError.message}
        </p>
      )}

      {stats.data ? (
        <StatsRow stats={stats.data} />
      ) : (
        <p className="text-sm text-slate-500">Loading stats…</p>
      )}

      {/* minmax(0, ...) lets the columns shrink below the table's width. */}
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <RequestsTable
          data={requests.data}
          loading={requests.isFetching}
          filters={filters}
          onFiltersChange={setFilters}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        <div aria-live="polite">
          {selectedId === null ? (
            <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
              Select a request to see its full trace.
            </p>
          ) : detail.data ? (
            <RequestDetailPanel request={detail.data} />
          ) : (
            <p className="p-8 text-center text-sm text-slate-500">
              Loading request…
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
