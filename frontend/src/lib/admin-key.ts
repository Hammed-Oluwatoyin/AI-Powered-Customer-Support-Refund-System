import { createContext, useContext } from 'react'

export interface AdminKeyState {
  adminKey: string | null
  setAdminKey: (key: string | null) => void
}

/**
 * The admin API key, held in React state only: it survives moving between
 * pages but is never written to storage, so a reload forgets it.
 */
export const AdminKeyContext = createContext<AdminKeyState | null>(null)

export function useAdminKey(): AdminKeyState {
  const state = useContext(AdminKeyContext)
  if (!state) throw new Error('useAdminKey must be used inside AdminKeyProvider')
  return state
}
