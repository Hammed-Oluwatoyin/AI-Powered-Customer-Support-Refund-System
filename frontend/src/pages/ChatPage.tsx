import { useMutation } from '@tanstack/react-query'
import { useId, useRef, useState, type FormEvent } from 'react'
import { submitRefund } from '../api/refunds.ts'
import type {
  CandidateOrder,
  DemoScenario,
  RefundRequestBody,
} from '../api/types.ts'
import { ChatThread, type ChatEntry } from '../components/ChatThread.tsx'
import { MessageComposer } from '../components/MessageComposer.tsx'
import { ScenarioChips } from '../components/ScenarioChips.tsx'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * The customer chat: enter an email, then describe the problem. Each message
 * is one refund request; the thread shows the reply and its decision badge.
 * The conversation lives in this component only and is gone on reload.
 */
export function ChatPage() {
  const [email, setEmail] = useState<string | null>(null)
  const [entries, setEntries] = useState<ChatEntry[]>([])
  const [draft, setDraft] = useState('')
  const nextId = useRef(0)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const refund = useMutation({ mutationFn: submitRefund })

  const newId = () => nextId.current++

  function send(body: RefundRequestBody, shownText: string, restoreDraft: boolean) {
    setEntries((prev) => [...prev, { id: newId(), kind: 'customer', text: shownText }])
    refund.mutate(body, {
      onSuccess: (response) =>
        setEntries((prev) => [
          ...prev,
          { id: newId(), kind: 'support', response, originalMessage: body.message },
        ]),
      onError: (error) => {
        setEntries((prev) => [...prev, { id: newId(), kind: 'error', text: error.message }])
        // Give the customer their text back so they can retry.
        if (restoreDraft) setDraft((current) => current || body.message)
      },
    })
  }

  function sendDraft() {
    if (email === null) return
    const message = draft.trim()
    setDraft('')
    send({ email, message }, message, true)
  }

  // Answering "which order?": resend the original message for the chosen order.
  function pickOrder(order: CandidateOrder, originalMessage: string) {
    if (email === null) return
    send(
      { email, message: originalMessage, orderId: order.id },
      `It's about order ${order.id}.`,
      false,
    )
  }

  function pickScenario(scenario: DemoScenario) {
    if (scenario.email !== email) setEntries([])
    setEmail(scenario.email)
    setDraft(scenario.message)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  function changeEmail() {
    setEmail(null)
    setEntries([])
    setDraft('')
  }

  return (
    <div className="mx-auto grid w-full max-w-4xl grid-cols-[minmax(0,1fr)] gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Customer support</h1>
        <p className="mt-1 text-slate-600">
          Ask for a refund in your own words. We check your order and our refund
          policy and reply straight away.
        </p>
      </div>

      <ScenarioChips onPick={pickScenario} />

      <section className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
        {email === null ? (
          <EmailForm onSubmit={setEmail} />
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 text-sm">
              <span className="truncate text-slate-600">
                Chatting as <span className="font-medium text-slate-900">{email}</span>
              </span>
              <button
                type="button"
                onClick={changeEmail}
                disabled={refund.isPending}
                className="shrink-0 text-slate-600 underline-offset-2 hover:underline disabled:opacity-50"
              >
                Change email
              </button>
            </div>
            <ChatThread
              entries={entries}
              pending={refund.isPending}
              onPickOrder={pickOrder}
            />
            <MessageComposer
              value={draft}
              onChange={setDraft}
              onSend={sendDraft}
              pending={refund.isPending}
              inputRef={inputRef}
            />
          </>
        )}
      </section>
    </div>
  )
}

function EmailForm({ onSubmit }: { onSubmit: (email: string) => void }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const errorId = useId()

  function submit(event: FormEvent) {
    event.preventDefault()
    const email = value.trim()
    if (!EMAIL_PATTERN.test(email)) {
      setError('Please enter a valid email address.')
      return
    }
    onSubmit(email)
  }

  return (
    <form onSubmit={submit} className="grid gap-3 p-6" noValidate>
      <label htmlFor="email" className="text-sm font-medium text-slate-700">
        The email address you ordered with
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
            setError(null)
          }}
          aria-invalid={error !== null}
          aria-describedby={error ? errorId : undefined}
          placeholder="you@example.com"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
        />
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Start chat
        </button>
      </div>
      {error && (
        <p id={errorId} className="text-sm text-red-700">
          {error}
        </p>
      )}
    </form>
  )
}
