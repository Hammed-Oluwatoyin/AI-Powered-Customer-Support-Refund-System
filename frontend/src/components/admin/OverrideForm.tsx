import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { overrideDecision } from '../../api/admin.ts'
import type { AdminRequestDetail } from '../../api/types.ts'
import { useAdminKey } from '../../lib/admin-key.ts'

/** Approve or deny an escalated or needs-info request, with a note for the audit trail. */
export function OverrideForm({ request }: { request: AdminRequestDetail }) {
  const { adminKey } = useAdminKey()
  const queryClient = useQueryClient()
  const [note, setNote] = useState('')

  const override = useMutation({
    mutationFn: (decision: 'APPROVED' | 'DENIED') =>
      overrideDecision(adminKey ?? '', request.id, {
        decision,
        note: note.trim(),
      }),
    onSuccess: async () => {
      setNote('')
      // The stats, the list and this request have all changed.
      await queryClient.invalidateQueries({ queryKey: ['admin'] })
    },
  })

  const canSubmit = note.trim().length > 0 && !override.isPending

  return (
    <section
      aria-labelledby="override-heading"
      className="rounded-lg border border-amber-200 bg-amber-50 p-4"
    >
      <h3 id="override-heading" className="text-sm font-semibold text-amber-900">
        Needs a decision
      </h3>
      <p className="mt-1 text-xs text-amber-900">
        {request.order
          ? `Approving refunds whatever on ${request.order.id} can still be refunded (final-sale and already-refunded items stay excluded).`
          : 'No order was identified, so approving records the decision without a refund.'}
      </p>
      <label
        htmlFor="override-note"
        className="mt-3 block text-xs font-medium text-amber-900"
      >
        Note (required, kept in the audit trail)
      </label>
      <textarea
        id="override-note"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        rows={2}
        maxLength={1000}
        className="mt-1 w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
      />
      {override.isError && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {override.error.message}
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => override.mutate('APPROVED')}
          className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:bg-slate-300"
        >
          Approve
        </button>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => override.mutate('DENIED')}
          className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:bg-slate-300"
        >
          Deny
        </button>
        {override.isPending && (
          <span className="self-center text-xs text-amber-900">Saving…</span>
        )}
      </div>
    </section>
  )
}
