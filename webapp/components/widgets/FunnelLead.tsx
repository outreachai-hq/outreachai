'use client'

// Horizontal funnel — one row per stage, bar width proportional to the max
// stage count so visual proportions feel right even when later stages are
// tiny (e.g. 200 pending → 5 replied).

const COLORS: Record<string, string> = {
  Pending:     'bg-gray-400',
  'In progress': 'bg-blue-500',
  Completed:   'bg-violet-500',
  Replied:     'bg-green-500',
}

export function FunnelLead({ data }: { data: Array<{ stage: string; value: number }> }) {
  if (!data || data.length === 0) {
    return <p className="text-xs text-gray-400 italic py-6">No leads.</p>
  }
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="space-y-1.5">
      {data.map((d) => {
        const pct = (d.value / max) * 100
        return (
          <div key={d.stage} className="flex items-center gap-2">
            <div className="w-24 text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">{d.stage}</div>
            <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded h-5 overflow-hidden">
              <div
                className={`${COLORS[d.stage] ?? 'bg-gray-400'} h-5 transition-all`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="w-12 text-right text-xs font-medium text-gray-700 dark:text-gray-300 tabular-nums flex-shrink-0">
              {d.value.toLocaleString()}
            </div>
          </div>
        )
      })}
    </div>
  )
}
