import type {
  AdminRequestSummary,
  Decision,
  PagedRequests,
  RefundStatus,
  RequestFilters,
} from '../../api/types.ts'
import {
  formatDateTime,
  formatMoney,
  formatShortDateTime,
} from '../../lib/format.ts'
import { awaitingReview, outcomeOf } from '../../lib/outcome.ts'
import { DecisionBadge } from '../DecisionBadge.tsx'

const DECISION_OPTIONS: Array<[Decision | '', string]> = [
  ['', 'All decisions'],
  ['APPROVED', 'Approved'],
  ['DENIED', 'Denied'],
  ['ESCALATED', 'Escalated'],
]

const STATUS_OPTIONS: Array<[RefundStatus | '', string]> = [
  ['', 'All statuses'],
  ['DECIDED', 'Decided'],
  ['NEEDS_INFO', 'Needs info'],
  ['RESOLVED_BY_ADMIN', 'Resolved by admin'],
]

interface RequestsTableProps {
  data: PagedRequests | undefined
  loading: boolean
  filters: RequestFilters
  onFiltersChange: (filters: RequestFilters) => void
  selectedId: string | null
  onSelect: (id: string) => void
}

export function RequestsTable({
  data,
  loading,
  filters,
  onFiltersChange,
  selectedId,
  onSelect,
}: RequestsTableProps) {
  return (
    <section
      aria-label="Refund requests"
      className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm"
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-3">
        <label className="sr-only" htmlFor="decision-filter">
          Filter by decision
        </label>
        <select
          id="decision-filter"
          value={filters.decision}
          onChange={(event) =>
            onFiltersChange({
              ...filters,
              decision: event.target.value as Decision | '',
              page: 1,
            })
          }
          className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
        >
          {DECISION_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="status-filter">
          Filter by status
        </label>
        <select
          id="status-filter"
          value={filters.status}
          onChange={(event) =>
            onFiltersChange({
              ...filters,
              status: event.target.value as RefundStatus | '',
              page: 1,
            })
          }
          className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
        >
          {STATUS_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {loading && <span className="text-xs text-slate-500">Loading…</span>}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Received</th>
              <th className="px-3 py-2 font-medium">Customer</th>
              <th className="px-3 py-2 font-medium">Order</th>
              <th className="px-3 py-2 font-medium">Outcome</th>
              <th className="px-3 py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((request) => (
              <Row
                key={request.id}
                request={request}
                selected={request.id === selectedId}
                onSelect={() => onSelect(request.id)}
              />
            ))}
            {data && data.items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                  No requests match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {data && (
        <div className="flex items-center justify-between border-t border-slate-200 px-3 py-2 text-sm text-slate-600">
          <span>
            {data.total} request{data.total === 1 ? '' : 's'} · page{' '}
            {data.page} of {data.totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={data.page <= 1}
              onClick={() =>
                onFiltersChange({ ...filters, page: filters.page - 1 })
              }
              className="rounded-md border border-slate-300 px-2 py-1 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={data.page >= data.totalPages}
              onClick={() =>
                onFiltersChange({ ...filters, page: filters.page + 1 })
              }
              className="rounded-md border border-slate-300 px-2 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

function Row({
  request,
  selected,
  onSelect,
}: {
  request: AdminRequestSummary
  selected: boolean
  onSelect: () => void
}) {
  return (
    <tr
      onClick={onSelect}
      className={`cursor-pointer border-t border-slate-100 ${
        selected ? 'bg-slate-100' : 'hover:bg-slate-50'
      }`}
    >
      <td className="whitespace-nowrap px-3 py-2 text-slate-600">
        {/* A real button, so rows can be opened with the keyboard too. */}
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onSelect()
          }}
          aria-pressed={selected}
          title={formatDateTime(request.createdAt)}
          className="text-left underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        >
          {formatShortDateTime(request.createdAt)}
        </button>
      </td>
      <td className="max-w-48 truncate px-3 py-2" title={request.messagePreview}>
        {request.customerEmail}
      </td>
      <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">
        {request.orderId ?? '—'}
      </td>
      <td className="whitespace-nowrap px-3 py-2">
        <span className="flex flex-col items-start gap-0.5">
          <DecisionBadge outcome={outcomeOf(request)} />
          {request.status === 'RESOLVED_BY_ADMIN' && (
            <span className="text-xs text-slate-500">by admin</span>
          )}
          {awaitingReview(request) && (
            <span className="text-xs font-medium text-amber-700">
              needs review
            </span>
          )}
        </span>
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
        {request.refundAmount === null ? '—' : formatMoney(request.refundAmount)}
      </td>
    </tr>
  )
}
