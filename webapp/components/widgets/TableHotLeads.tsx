'use client'

export function TableHotLeads({ data }: {
  data: Array<{ id: string; name: string; company: string | null; score: number; status: string }>
}) {
  if (!data || data.length === 0) {
    return <p className="text-xs text-gray-400 italic py-6">No leads scored yet.</p>
  }
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-gray-400 text-left">
            <th className="pl-1 pb-1">Lead</th>
            <th className="pb-1">Company</th>
            <th className="pb-1 text-right pr-1">Score</th>
          </tr>
        </thead>
        <tbody>
          {data.map((r) => (
            <tr key={r.id} className="border-t border-gray-100 dark:border-gray-800">
              <td className="pl-1 py-1.5 font-medium text-gray-900 dark:text-white truncate">{r.name}</td>
              <td className="py-1.5 text-gray-500 dark:text-gray-400 truncate">{r.company ?? '—'}</td>
              <td className="py-1.5 text-right pr-1 font-mono tabular-nums text-gray-700 dark:text-gray-300">{r.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
