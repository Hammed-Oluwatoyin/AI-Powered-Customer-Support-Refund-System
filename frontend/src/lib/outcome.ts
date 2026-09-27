import type { Decision, RefundStatus } from '../api/types.ts'

export type Outcome = Decision | 'NEEDS_INFO'

/** What to show for a request: NEEDS_INFO has no decision yet. */
export function outcomeOf(result: {
  decision: Decision | null
  status: RefundStatus
}): Outcome {
  return result.status === 'NEEDS_INFO' || result.decision === null
    ? 'NEEDS_INFO'
    : result.decision
}

/** Green approved, red denied, amber escalated, blue needs info. */
export const OUTCOME_STYLES: Record<
  Outcome,
  { label: string; badge: string; dot: string }
> = {
  APPROVED: {
    label: 'Approved',
    badge: 'bg-green-100 text-green-800 ring-green-600/20',
    dot: 'bg-green-500',
  },
  DENIED: {
    label: 'Denied',
    badge: 'bg-red-100 text-red-800 ring-red-600/20',
    dot: 'bg-red-500',
  },
  ESCALATED: {
    label: 'Escalated',
    badge: 'bg-amber-100 text-amber-800 ring-amber-600/20',
    dot: 'bg-amber-500',
  },
  NEEDS_INFO: {
    label: 'Needs info',
    badge: 'bg-blue-100 text-blue-800 ring-blue-600/20',
    dot: 'bg-blue-500',
  },
}
