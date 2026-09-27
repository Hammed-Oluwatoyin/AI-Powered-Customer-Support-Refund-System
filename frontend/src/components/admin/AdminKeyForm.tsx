import { useState, type FormEvent } from 'react'

export function AdminKeyForm({
  onSubmit,
  error,
}: {
  onSubmit: (key: string) => void
  error: string | null
}) {
  const [value, setValue] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    if (value.trim()) onSubmit(value.trim())
  }

  return (
    <form
      onSubmit={submit}
      className="mx-auto mt-10 grid max-w-md gap-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <h1 className="text-lg font-semibold">Admin sign-in</h1>
      <p className="text-sm text-slate-600">
        Enter the admin API key. It is kept in memory only and forgotten when
        you reload the page.
      </p>
      <label htmlFor="admin-key" className="text-sm font-medium text-slate-700">
        Admin API key
      </label>
      <input
        id="admin-key"
        type="password"
        autoComplete="off"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        aria-invalid={error !== null}
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
      />
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={!value.trim()}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:bg-slate-300"
      >
        Open dashboard
      </button>
    </form>
  )
}
