import { OUTCOME_STYLES, type Outcome } from '../lib/outcome.ts'

export function DecisionBadge({ outcome }: { outcome: Outcome }) {
  const style = OUTCOME_STYLES[outcome]
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${style.badge}`}
    >
      {style.label}
    </span>
  )
}
