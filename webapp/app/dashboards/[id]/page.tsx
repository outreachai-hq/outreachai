'use client'

// Plan 9 — Dashboard detail. Tabs across the top, widgets in a grid below.
// Iter 4 will add the edit toggle + add-widget modal + remove buttons.

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, Edit3, Plus, Share2, Copy, Check, X as XIcon } from 'lucide-react'
import type { Tab, Widget, WidgetType } from '@/lib/widgets/catalog'
import { CATALOG, METRIC_LABELS, makeId } from '@/lib/widgets/catalog'
import { WidgetCard } from '@/components/widgets/WidgetCard'

type Dashboard = {
  id:          string
  name:        string
  description: string | null
  tabs:        Tab[]
  filters:     Record<string, unknown>
  position:    number
  shareToken?: string | null
}

export default function DashboardDetailPage() {
  const { status } = useSession()
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [dash, setDash]       = useState<Dashboard | null>(null)
  const [activeTab, setTab]   = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [copied, setCopied]   = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login')
  }, [status, router])

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/dashboards/${id}`)
    if (res.ok) {
      const { dashboard } = await res.json()
      setDash(dashboard)
      if (dashboard.tabs?.[0]?.id) setTab((prev) => prev || dashboard.tabs[0].id)
    } else if (res.status === 404) {
      router.replace('/dashboards')
    }
    setLoading(false)
  }, [id, router])

  useEffect(() => {
    if (status === 'authenticated') load()
  }, [status, load])

  async function persistTabs(next: Tab[]) {
    if (!dash) return
    setDash({ ...dash, tabs: next })
    await fetch(`/api/dashboards/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tabs: next }),
    })
  }

  function addWidget(type: WidgetType) {
    if (!dash) return
    const tab = dash.tabs.find((t) => t.id === activeTab)
    if (!tab) return
    const entry = CATALOG[type]
    const w: Widget = {
      id:       makeId(),
      type,
      title:    entry.label,
      config:   { ...entry.defaults },
      position: (tab.widgets ?? []).length,
    }
    const nextTabs = dash.tabs.map((t) => t.id === tab.id ? { ...t, widgets: [...(t.widgets ?? []), w] } : t)
    persistTabs(nextTabs)
    setAddOpen(false)
  }

  const shareUrl = dash?.shareToken
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/share/dashboard/${dash.shareToken}`
    : ''

  async function enableShare() {
    const res = await fetch(`/api/dashboards/${id}/share`, { method: 'POST' })
    if (res.ok) {
      const { shareToken } = await res.json()
      if (dash) setDash({ ...dash, shareToken })
    }
  }
  async function revokeShare() {
    const res = await fetch(`/api/dashboards/${id}/share`, { method: 'DELETE' })
    if (res.ok && dash) setDash({ ...dash, shareToken: null })
  }
  function copyShare() {
    if (!shareUrl) return
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  function removeWidget(widgetId: string) {
    if (!dash) return
    const nextTabs = dash.tabs.map((t) =>
      t.id === activeTab ? { ...t, widgets: (t.widgets ?? []).filter((w) => w.id !== widgetId) } : t,
    )
    persistTabs(nextTabs)
  }

  if (loading || !dash) {
    return (
      <div className="p-12 text-center text-sm text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3" />
        Loading dashboard…
      </div>
    )
  }

  const tab = dash.tabs.find((t) => t.id === activeTab) ?? dash.tabs[0]
  const widgets = (tab?.widgets ?? []).slice().sort((a, b) => a.position - b.position)

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-8">
      {/* Header */}
      <div className="mb-5">
        <Link href="/dashboards" className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 mb-3">
          <ArrowLeft className="w-3.5 h-3.5" /> Dashboards
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{dash.name}</h1>
            {dash.description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{dash.description}</p>}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShareOpen(true)}
              className={`inline-flex items-center gap-1.5 text-sm font-medium rounded-lg px-3 py-1.5 border ${
                dash.shareToken
                  ? 'border-green-300 bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-200'
                  : 'border-gray-200 dark:border-gray-700 text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <Share2 className="w-3.5 h-3.5" /> {dash.shareToken ? 'Shared' : 'Share'}
            </button>
            <button
              onClick={() => setEditing((e) => !e)}
              className={`inline-flex items-center gap-1.5 text-sm font-medium rounded-lg px-3 py-1.5 border ${
                editing
                  ? 'border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-200'
                  : 'border-gray-200 dark:border-gray-700 text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" /> {editing ? 'Done' : 'Edit'}
            </button>
          </div>
        </div>
      </div>

      {/* Share dialog */}
      {shareOpen && dash && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/40" onClick={() => setShareOpen(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl p-5 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Share dashboard</h3>
              <button onClick={() => setShareOpen(false)} className="p-1 text-gray-400 hover:text-gray-600" aria-label="Close">
                <XIcon className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Anyone with the link can view this dashboard in read-only mode. Revoke any time to invalidate the link.
            </p>
            {dash.shareToken ? (
              <>
                <div className="flex items-center gap-2 mb-3 p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <code className="flex-1 text-xs font-mono text-gray-700 dark:text-gray-300 truncate">{shareUrl}</code>
                  <button onClick={copyShare} className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700">
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div className="flex gap-2">
                  <button onClick={enableShare} className="text-xs font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800">
                    Rotate link
                  </button>
                  <button onClick={revokeShare} className="text-xs font-medium text-red-700 border border-red-200 dark:border-red-800 rounded px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-950">
                    Revoke
                  </button>
                </div>
              </>
            ) : (
              <button
                onClick={enableShare}
                className="w-full inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg py-2"
              >
                <Share2 className="w-4 h-4" /> Create share link
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      {dash.tabs.length > 1 && (
        <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 mb-5">
          {dash.tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === t.id
                  ? 'border-blue-600 text-blue-700 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}

      {/* Widgets grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {widgets.map((w) => (
          <WidgetCard
            key={w.id}
            dashboardId={dash.id}
            widget={w}
            editing={editing}
            onRemove={editing ? () => removeWidget(w.id) : undefined}
          />
        ))}
        {editing && (
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center justify-center gap-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 border border-dashed border-blue-300 dark:border-blue-800 rounded-xl p-6 min-h-[140px]"
          >
            <Plus className="w-4 h-4" /> Add widget
          </button>
        )}
        {widgets.length === 0 && !editing && (
          <div className="col-span-full text-center py-16 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
            <p className="text-sm text-gray-400 mb-2">No widgets in this tab.</p>
            <button onClick={() => setEditing(true)} className="text-sm text-blue-600 hover:underline">
              Switch to edit mode to add some →
            </button>
          </div>
        )}
      </div>

      {/* Add-widget modal */}
      {addOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/40" onClick={() => setAddOpen(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl p-5 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-3">Add widget</h3>
            <ul className="space-y-1.5">
              {(Object.keys(CATALOG) as WidgetType[]).map((t) => (
                <li key={t}>
                  <button
                    onClick={() => addWidget(t)}
                    className="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
                  >
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{CATALOG[t].label}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{CATALOG[t].desc}</p>
                    {CATALOG[t].metrics && (
                      <p className="text-[10px] text-gray-400 mt-1">
                        Defaults to {METRIC_LABELS[(CATALOG[t].defaults as { metric: keyof typeof METRIC_LABELS }).metric] ?? '—'}
                      </p>
                    )}
                  </button>
                </li>
              ))}
            </ul>
            <button onClick={() => setAddOpen(false)} className="w-full mt-3 text-xs text-gray-500 hover:underline">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
