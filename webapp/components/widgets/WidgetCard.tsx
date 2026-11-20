'use client'

// Plan 9 — single widget shell. Handles loading, error, and dispatching to
// type-specific renderers. The detail page renders one <WidgetCard /> per
// widget in the active tab.

import { useEffect, useState } from 'react'
import { Loader2, AlertCircle, X } from 'lucide-react'
import type { Widget } from '@/lib/widgets/catalog'
import { KpiNumber }       from './KpiNumber'
import { LineChart }       from './LineChart'
import { FunnelLead }      from './FunnelLead'
import { TableHotLeads }   from './TableHotLeads'
import { TableRecentReplies } from './TableRecentReplies'

export function WidgetCard(props: {
  dashboardId: string
  widget:      Widget
  editing?:    boolean
  onRemove?:   () => void
}) {
  const { dashboardId, widget, editing, onRemove } = props
  const [data, setData]     = useState<unknown>(null)
  const [loading, setLoad]  = useState(true)
  const [error, setError]   = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoad(true); setError(null)
    fetch(`/api/dashboards/${dashboardId}/widgets/${widget.id}/data`)
      .then(async (r) => {
        const json = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(json.error ?? `HTTP ${r.status}`)
        return json.data
      })
      .then((d) => { if (!cancelled) setData(d) })
      .catch((e: Error) => { if (!cancelled) setError(e.message) })
      .finally(()  => { if (!cancelled) setLoad(false) })
    return () => { cancelled = true }
  }, [dashboardId, widget.id])

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 relative overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          {widget.title}
        </h3>
        {editing && onRemove && (
          <button
            onClick={onRemove}
            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 rounded transition-colors"
            aria-label="Remove widget"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-8">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : error ? (
        <div className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400 py-4">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Widget query failed</p>
            <p className="text-red-500">{error}</p>
          </div>
        </div>
      ) : widget.type === 'kpi.number' ? (
        <KpiNumber data={data as { value: number }} />
      ) : widget.type === 'chart.line' ? (
        <LineChart data={data as Array<{ bucket: string; value: number }>} />
      ) : widget.type === 'funnel.lead' ? (
        <FunnelLead data={data as Array<{ stage: string; value: number }>} />
      ) : widget.type === 'table.hot_leads' ? (
        <TableHotLeads data={data as Array<{ id: string; name: string; company: string | null; score: number; status: string }>} />
      ) : widget.type === 'table.recent_replies' ? (
        <TableRecentReplies data={data as Array<{ id: string; participantName: string; channel: string; lastMessage: string; at: string }>} />
      ) : (
        <p className="text-xs text-gray-400 italic">Unknown widget type: {widget.type}</p>
      )}
    </div>
  )
}
