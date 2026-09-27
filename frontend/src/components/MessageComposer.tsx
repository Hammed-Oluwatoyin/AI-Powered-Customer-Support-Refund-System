import type { FormEvent, KeyboardEvent, RefObject } from 'react'
import { characterCount } from '../lib/format.ts'

/** Matches the backend's limit (CreateRefundRequestDto). */
export const MAX_MESSAGE_LENGTH = 1000

interface MessageComposerProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  pending: boolean
  inputRef: RefObject<HTMLTextAreaElement | null>
}

export function MessageComposer({
  value,
  onChange,
  onSend,
  pending,
  inputRef,
}: MessageComposerProps) {
  const length = characterCount(value)
  const tooLong = length > MAX_MESSAGE_LENGTH
  const canSend = !pending && value.trim().length > 0 && !tooLong

  function submit(event: FormEvent) {
    event.preventDefault()
    if (canSend) onSend()
  }

  // Enter sends; Shift+Enter adds a new line.
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      if (canSend) onSend()
    }
  }

  return (
    <form onSubmit={submit} className="border-t border-slate-200 p-3">
      <label htmlFor="message" className="sr-only">
        Your message
      </label>
      <textarea
        id="message"
        ref={inputRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        rows={3}
        placeholder="Describe the problem with your order…"
        aria-describedby="message-count"
        aria-invalid={tooLong}
        className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <span
          id="message-count"
          className={`text-xs ${tooLong ? 'font-medium text-red-700' : 'text-slate-500'}`}
        >
          {length} / {MAX_MESSAGE_LENGTH}
          {tooLong && ' (too long)'}
        </span>
        <button
          type="submit"
          disabled={!canSend}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {pending ? 'Sending…' : 'Send'}
        </button>
      </div>
    </form>
  )
}
