import { useMemo, useState, type ReactNode } from 'react'
import { AdminKeyContext } from '../lib/admin-key.ts'

export function AdminKeyProvider({ children }: { children: ReactNode }) {
  const [adminKey, setAdminKey] = useState<string | null>(null)
  const value = useMemo(() => ({ adminKey, setAdminKey }), [adminKey])
  return <AdminKeyContext value={value}>{children}</AdminKeyContext>
}
