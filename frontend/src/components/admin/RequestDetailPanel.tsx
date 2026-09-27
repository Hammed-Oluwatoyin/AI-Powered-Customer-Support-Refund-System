import type { ReactNode } from 'react'
import type { AdminRequestDetail, ExtractionRecord } from '../../api/types.ts'
import { formatDateTime, formatMoney } from '../../lib/format.ts'
import { awaitingReview, outcomeOf } from '../../lib/outcome.ts'
import { DecisionBadge } from '../DecisionBadge.tsx'
import { OverrideForm } from './OverrideForm.tsx'

/** Everything about one request, from the customer's message to the audit trail. */
export function RequestDetailPanel({
  request,
}: {
  request: AdminRequestDetail
}) {
  const approved = request.decision === 'APPROVED'

  return (
    <article className="grid gap-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <DecisionBadge outcome={outcomeOf(request)} />
          {request.status === 'RESOLVED_BY_ADMIN' && (
            <span className="text-xs text-slate-500">resolved by admin</span>
          )}
          {request.refundAmount !== null && (
            <span className="text-sm font-medium text-slate-700">
              {approved ? 'Refund' : 'At stake'}:{' '}
              {formatMoney(request.refundAmount)}
            </span>
          )}
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-slate-500">Customer</dt>
          <dd className="break-all">{request.customerEmail}</dd>
          <dt className="text-slate-500">Order</dt>
          <dd className="font-mono text-xs leading-5">
            {request.orderId ?? 'not identified'}
          </dd>
          <dt className="text-slate-500">Received</dt>
          <dd>{formatDateTime(request.createdAt)}</dd>
          <dt className="text-slate-500">Request ID</dt>
          <dd className="break-all font-mono text-xs leading-5">{request.id}</dd>
        </dl>
      </header>

      {awaitingReview(request) && <OverrideForm request={request} />}

      <Section title="Customer message">
        <p className="whitespace-pre-line break-words rounded-lg bg-slate-50 p-3 text-sm">
          {request.message}
        </p>
      </Section>

      <Section title="AI extraction">
        <Extraction record={request.extractedIntent} />
      </Section>

      <Section title="Policy decision">
        {request.rulesFired.length > 0 ? (
          <ul className="mb-2 flex flex-wrap gap-1.5">
            {request.rulesFired.map((rule) => (
              <li
                key={rule}
                className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700"
              >
                {rule}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-2 text-sm text-slate-500">No rules fired.</p>
        )}
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
          {request.reasons.map((reason, index) => (
            <li key={index}>{reason}</li>
          ))}
        </ul>
      </Section>

      <Section title="Reply sent to the customer">
        <p className="whitespace-pre-line break-words rounded-lg bg-slate-50 p-3 text-sm">
          {request.aiReply ?? 'No reply recorded.'}
        </p>
      </Section>

      {request.order && (
        <Section title={`Order ${request.order.id} (${request.order.status})`}>
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="py-1 font-medium">Item</th>
                <th className="py-1 text-right font-medium">Price</th>
                <th className="py-1 text-right font-medium">Qty</th>
                <th className="py-1 pl-3 font-medium">Flags</th>
              </tr>
            </thead>
            <tbody>
              {request.order.items.map((item) => (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="py-1">{item.name}</td>
                  <td className="py-1 text-right tabular-nums">
                    {formatMoney(item.unitPrice)}
                  </td>
                  <td className="py-1 text-right tabular-nums">{item.quantity}</td>
                  <td className="py-1 pl-3 text-xs text-slate-600">
                    {[
                      item.isFinalSale && 'final sale',
                      item.refunded && 'refunded',
                    ]
                      .filter(Boolean)
                      .join(', ') || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      <Section title="Audit timeline">
        <ol className="relative grid gap-3 border-l border-slate-200 pl-4">
          {request.auditEvents.map((event) => (
            <li key={event.id} className="relative">
              <span
                aria-hidden="true"
                className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ${
                  event.step === 'ERROR'
                    ? 'bg-red-500'
                    : event.step === 'ADMIN_OVERRIDE'
                      ? 'bg-slate-900'
                      : 'bg-slate-400'
                }`}
              />
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-mono text-xs font-semibold">
                  {event.step}
                </span>
                <span className="text-xs text-slate-500">
                  {formatDateTime(event.createdAt)}
                </span>
              </div>
              <Json value={event.payload} />
            </li>
          ))}
        </ol>
      </Section>
    </article>
  )
}

function Extraction({ record }: { record: ExtractionRecord | null }) {
  if (!record) {
    return (
      <p className="text-sm text-slate-500">
        Not run: no matching customer, so the AI was not called.
      </p>
    )
  }
  const { intent, failure, injection } = record
  return (
    <div className="grid gap-2 text-sm">
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="text-slate-500">Provider</dt>
        <dd>
          {record.provider} · {record.attempts} attempt
          {record.attempts === 1 ? '' : 's'}
        </dd>
        {intent && (
          <>
            <dt className="text-slate-500">Reason</dt>
            <dd className="font-mono text-xs leading-5">{intent.reason}</dd>
            <dt className="text-slate-500">Order</dt>
            <dd className="font-mono text-xs leading-5">
              {intent.orderId ?? 'none'}
            </dd>
            <dt className="text-slate-500">Confidence</dt>
            <dd>{Math.round(intent.confidence * 100)}%</dd>
            <dt className="text-slate-500">Summary</dt>
            <dd>{intent.summary}</dd>
          </>
        )}
        {failure && (
          <>
            <dt className="text-red-700">Failed</dt>
            <dd className="text-red-700">
              {failure.kind}: {failure.message}
            </dd>
          </>
        )}
        <dt className="text-slate-500">Injection</dt>
        <dd className={injection.suspected ? 'font-medium text-red-700' : ''}>
          {injection.suspected ? 'Suspected' : 'Not detected'}
          {injection.heuristicMatches.length > 0 &&
            ` · heuristics: ${injection.heuristicMatches.join(', ')}`}
          {injection.modelFlagged !== null &&
            ` · model: ${injection.modelFlagged ? 'flagged' : 'clean'}`}
        </dd>
      </dl>
      <Json value={record} label="Raw extraction" />
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h3>
      {children}
    </section>
  )
}

function Json({ value, label = 'Details' }: { value: unknown; label?: string }) {
  return (
    <details className="mt-1 text-xs">
      <summary className="cursor-pointer text-slate-500 hover:text-slate-700">
        {label}
      </summary>
      <pre className="mt-1 max-h-72 overflow-auto rounded bg-slate-900 p-3 text-slate-100">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  )
}
