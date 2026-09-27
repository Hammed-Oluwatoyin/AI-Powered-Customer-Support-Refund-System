import type { RequestStats } from '../../api/types.ts'

export function StatsRow({ stats }: { stats: RequestStats }) {
  const cards = [
    { label: 'Total requests', value: stats.total, accent: 'text-slate-900' },
    {
      label: 'Awaiting review',
      value: stats.awaitingReview,
      accent: 'text-amber-700',
    },
    {
      label: 'Approved',
      value: stats.byDecision.APPROVED,
      accent: 'text-green-700',
    },
    { label: 'Denied', value: stats.byDecision.DENIED, accent: 'text-red-700' },
    {
      label: 'Escalated',
      value: stats.byDecision.ESCALATED,
      accent: 'text-amber-700',
    },
    {
      label: 'Needs info',
      value: stats.byStatus.NEEDS_INFO,
      accent: 'text-blue-700',
    },
    {
      label: 'Resolved by admin',
      value: stats.byStatus.RESOLVED_BY_ADMIN,
      accent: 'text-slate-700',
    },
  ]

  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
        >
          <dt className="text-xs font-medium text-slate-500">{card.label}</dt>
          <dd className={`mt-1 text-2xl font-semibold ${card.accent}`}>
            {card.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
