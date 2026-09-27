import { useEffect, useState } from 'react'
import { fetchHealth } from './api/health.ts'

type BackendState = 'checking' | 'online' | 'offline'

const backendBadge: Record<BackendState, { label: string; className: string }> = {
  checking: { label: 'Checking backend…', className: 'bg-slate-100 text-slate-600' },
  online: { label: 'Backend online', className: 'bg-green-100 text-green-800' },
  offline: { label: 'Backend unreachable', className: 'bg-red-100 text-red-800' },
}

function App() {
  const [backend, setBackend] = useState<BackendState>('checking')

  useEffect(() => {
    const controller = new AbortController()
    fetchHealth(controller.signal)
      .then(() => setBackend('online'))
      .catch(() => {
        if (!controller.signal.aborted) setBackend('offline')
      })
    return () => controller.abort()
  }, [])

  const badge = backendBadge[backend]

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Refund Support</h1>
        <p className="mt-2 text-slate-600">
          AI-assisted refund requests with a deterministic policy engine. The
          customer chat and admin dashboard are coming in later phases.
        </p>
        <p
          role="status"
          className={`mt-6 inline-flex rounded-full px-3 py-1 text-sm font-medium ${badge.className}`}
        >
          {badge.label}
        </p>
      </section>
    </main>
  )
}

export default App
