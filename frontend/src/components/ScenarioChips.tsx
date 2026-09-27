import { useQuery } from '@tanstack/react-query'
import { fetchScenarios } from '../api/demo.ts'
import type { DemoScenario } from '../api/types.ts'
import { formatMoney } from '../lib/format.ts'
import { OUTCOME_STYLES, outcomeOf } from '../lib/outcome.ts'

function expectedLabel({ expected }: DemoScenario): string {
  const { label } = OUTCOME_STYLES[outcomeOf(expected)]
  return expected.refundAmount === null
    ? label
    : `${label} (${formatMoney(expected.refundAmount)})`
}

/** Demo shortcuts: each chip fills in a scenario's email and message. */
export function ScenarioChips({
  onPick,
}: {
  onPick: (scenario: DemoScenario) => void
}) {
  const scenarios = useQuery({
    queryKey: ['demo-scenarios'],
    queryFn: fetchScenarios,
    staleTime: Infinity,
  })

  if (scenarios.isError) {
    return (
      <p className="text-sm text-slate-500">
        Demo scenarios are unavailable right now.
      </p>
    )
  }

  return (
    <section aria-labelledby="scenarios-heading">
      <h2
        id="scenarios-heading"
        className="mb-2 text-sm font-medium text-slate-700"
      >
        Try a scenario
      </h2>
      {scenarios.isPending ? (
        <p className="text-sm text-slate-500">Loading scenarios…</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {scenarios.data.map((scenario) => (
            <li key={scenario.id}>
              <button
                type="button"
                onClick={() => onPick(scenario)}
                title={`${scenario.customerName}: expected ${expectedLabel(scenario)}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                <span
                  aria-hidden="true"
                  className={`h-2 w-2 rounded-full ${OUTCOME_STYLES[outcomeOf(scenario.expected)].dot}`}
                />
                {scenario.id}. {scenario.title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
