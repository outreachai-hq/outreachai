'use client'

// Plan 9 follow-up — public dashboard viewer. No auth, no edit affordance,
// "Powered by OutreachAI" footer. Each WidgetCard takes a `tokenBase` prop so
// it fetches data from the token-scoped endpoint instead of the owner one.

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import type { Tab, Widget } from '@/lib/widgets/catalog'
import { KpiNumber }       from '@/components/widgets/KpiNumber'
import { LineChart }       from '@/components/widgets/LineChart'
import { FunnelLead }      from '@/components/widgets/FunnelLead'
import { TableHotLeads }   from '@/components/widgets/TableHotLeads'
import { TableRecentReplies } from '@/components/widgets/TableRecentReplies'

type Dashboard = {
  id:          string
  name:        string
  description: string | null
  tabs:        Tab[]
}

function PublicWidgetCard({ token, widget }: { token: string; widget: Widget }) {
  const [data, setData] = useState<unknown>(null)
  const [loading, setLoad] = useState(true)
  const [error, setError]  = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoad(true); setError(null)
    fetch(`/api/public/dashboards/${token}/widgets/${widget.id}/data`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`)
        return j.data
      })
      .then((d) => { if (!cancelled) setData(d) })
      .catch((e: Error) => { if (!cancelled) setError(e.message) })
      .finally(()  => { if (!cancelled) setLoad(false) })
    return () => { cancelled = true }
  }, [token, widget.id])

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
        {widget.title}
      </h3>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-8">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : error ? (
        <p className="text-xs text-red-600 dark:text-red-400 py-4">{error}</p>
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
        <p className="text-xs text-gray-400 italic">Unknown widget type.</p>
      )}
    </div>
  )
}

export default function PublicDashboardPage() {
  const params = useParams()
  const token = params.token as string
  const [dash, setDash]       = useState<Dashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    fetch(`/api/public/dashboards/${token}`)
      .then(async (r) => {
        if (r.status === 404) { setNotFound(true); return null }
        if (!r.ok) return null
        return r.json()
      })
      .then((j) => { if (j?.dashboard) setDash(j.dashboard) })
      .finally(() => setLoading(false))
  }, [token])

  if (loading) {
    return <div className="p-12 text-center text-sm text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
  }
  if (notFound || !dash) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-gray-950 px-6 text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Dashboard not found</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">The share link may have been revoked or rotated.</p>
      </div>
    )
  }

  const tab = dash.tabs[0]
  const widgets = (tab?.widgets ?? []).slice().sort((a, b) => a.position - b.position)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-6xl mx-auto p-6 md:p-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{dash.name}</h1>
          {dash.description && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{dash.description}</p>
          )}
        </header>

        {dash.tabs.length > 1 && (
          <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 mb-5 text-xs text-gray-400">
            {dash.tabs.map((t) => (
              <span key={t.id} className="px-3 py-2">{t.name}</span>
            ))}
            <span className="ml-auto px-3 py-2 italic">read-only · viewing first tab</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {widgets.map((w) => (
            <PublicWidgetCard key={w.id} token={token} widget={w} />
          ))}
          {widgets.length === 0 && (
            <p className="col-span-full text-center py-12 text-sm text-gray-400">This dashboard is empty.</p>
          )}
        </div>

        <footer className="mt-10 pt-6 border-t border-gray-200 dark:border-gray-800 text-xs text-gray-400 text-center">
          Powered by{' '}
          <Link href="/" className="text-blue-600 hover:underline">OutreachAI</Link>
          {' · '}
          <Link href="/signup" className="hover:underline">Build your own free dashboard</Link>
        </footer>
      </div>
    </div>
  )
}
