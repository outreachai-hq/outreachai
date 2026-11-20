'use client'

// Tiny inline SVG line chart — no library dep. Computes bounds from data,
// renders a smooth polyline + a faint area under the curve, and dots
// per-point. Designed for ~30 buckets max; falls back to "no data" when empty.

export function LineChart({ data }: { data: Array<{ bucket: string; value: number }> }) {
  if (!data || data.length === 0) {
    return <p className="text-xs text-gray-400 italic py-6">No data in this window.</p>
  }

  const W = 320, H = 100, PAD = 6
  const xs = data.map((_, i) => i)
  const ys = data.map((d) => d.value)
  const maxY = Math.max(1, ...ys)
  const x = (i: number) => PAD + (i * (W - 2 * PAD)) / Math.max(1, xs.length - 1)
  const y = (v: number) => H - PAD - ((v / maxY) * (H - 2 * PAD))

  const points = data.map((d, i) => `${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(' ')
  const area   = `${PAD},${H - PAD} ${points} ${(W - PAD).toFixed(1)},${H - PAD}`

  const total = ys.reduce((a, b) => a + b, 0)
  const recentBucket = data[data.length - 1]?.bucket

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{total.toLocaleString()}</p>
        <p className="text-[10px] text-gray-400">{data.length} buckets · last {recentBucket}</p>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-24">
        <polygon points={area} fill="rgb(59 130 246 / 0.10)" />
        <polyline points={points} fill="none" stroke="rgb(59 130 246)" strokeWidth={1.5} strokeLinejoin="round" />
        {data.map((d, i) => (
          <circle key={i} cx={x(i)} cy={y(d.value)} r={1.6} fill="rgb(59 130 246)" />
        ))}
      </svg>
    </div>
  )
}
