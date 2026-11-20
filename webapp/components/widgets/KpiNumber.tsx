'use client'

export function KpiNumber({ data }: { data: { value: number } | null }) {
  const v = data?.value ?? 0
  return (
    <div className="py-4">
      <p className="text-4xl font-extrabold text-gray-900 dark:text-white tabular-nums">
        {Number.isFinite(v) ? v.toLocaleString() : '—'}
      </p>
    </div>
  )
}
