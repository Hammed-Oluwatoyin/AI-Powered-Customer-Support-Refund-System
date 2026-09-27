import { useEffect, useRef } from 'react'
import type { CandidateOrder, RefundResponse } from '../api/types.ts'
import { formatDate, formatMoney } from '../lib/format.ts'
import { outcomeOf } from '../lib/outcome.ts'
import { DecisionBadge } from './DecisionBadge.tsx'

export type ChatEntry =
  | { id: number; kind: 'customer'; text: string }
  | {
      id: number
      kind: 'support'
      response: RefundResponse
      /** The message this answers, resent when the customer picks an order. */
      originalMessage: string
    }
  | { id: number; kind: 'error'; text: string }

interface ChatThreadProps {
  entries: ChatEntry[]
  pending: boolean
  onPickOrder: (order: CandidateOrder, originalMessage: string) => void
}

export function ChatThread({ entries, pending, onPickOrder }: ChatThreadProps) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [entries.length, pending])

  return (
    <div
      className="flex min-h-64 flex-col gap-3 overflow-y-auto p-4"
      role="log"
      aria-live="polite"
      aria-label="Conversation"
    >
      {entries.length === 0 && !pending && (
        <p className="m-auto max-w-sm text-center text-sm text-slate-500">
          Tell us what went wrong with your order. Include the order ID (for
          example ORD-1001) if you have it.
        </p>
      )}

      {entries.map((entry) => {
        switch (entry.kind) {
          case 'customer':
            return <CustomerBubble key={entry.id} text={entry.text} />
          case 'support':
            return (
              <SupportBubble
                key={entry.id}
                response={entry.response}
                pending={pending}
                onPickOrder={(order) => onPickOrder(order, entry.originalMessage)}
              />
            )
          case 'error':
            return <ErrorBubble key={entry.id} text={entry.text} />
        }
      })}

      {pending && <TypingIndicator />}
      <div ref={endRef} />
    </div>
  )
}

function CustomerBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[80%] whitespace-pre-line break-words rounded-2xl rounded-br-sm bg-slate-900 px-4 py-2 text-sm text-white">
        {text}
      </p>
    </div>
  )
}

function SupportBubble({
  response,
  pending,
  onPickOrder,
}: {
  response: RefundResponse
  pending: boolean
  onPickOrder: (order: CandidateOrder) => void
}) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="font-medium text-slate-700">Customer Support</span>
          <DecisionBadge outcome={outcomeOf(response)} />
          {response.refundAmount !== null && (
            <span className="text-xs font-medium text-green-800">
              Refund: {formatMoney(response.refundAmount)}
            </span>
          )}
        </div>
        <p className="whitespace-pre-line break-words text-slate-800">
          {response.reply}
        </p>

        {response.candidateOrders.length > 0 && (
          <div className="mt-3 flex flex-col gap-2">
            <p className="text-xs text-slate-500">Choose the order:</p>
            {response.candidateOrders.map((order) => (
              <button
                key={order.id}
                type="button"
                disabled={pending}
                onClick={() => onPickOrder(order)}
                className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-left text-sm text-blue-900 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="font-medium">{order.id}</span>
                <span className="text-blue-800">
                  {' '}
                  · {order.items.join(', ')} · ordered {formatDate(order.orderedAt)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ErrorBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-start" role="alert">
      <p className="max-w-[80%] rounded-2xl rounded-bl-sm border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
        Your message wasn't processed: {text}
      </p>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
        <span className="flex gap-1" aria-hidden="true">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
        </span>
        Support is reviewing your request…
      </div>
    </div>
  )
}
