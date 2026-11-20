'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Zap, Plus, X, ToggleLeft, ToggleRight, Trash2, ChevronDown, Globe } from 'lucide-react'

interface RecentVisit {
  id: string
  resolvedOrg: string | null
  matchedLeadId: string | null
  matchedContactId: string | null
  matchedCompanyId: string | null
  url: string | null
  ip: string | null
  visitedAt: string
}

const SIGNAL_TYPES = [
  { value: 'job_change',          label: 'Job change',          icon: '💼', desc: 'Prospect changes role or company' },
  { value: 'linkedin_engagement', label: 'LinkedIn engagement', icon: '👍', desc: 'Prospect likes or comments on posts' },
  { value: 'funding',             label: 'Funding alert',       icon: '💰', desc: 'Target company raises funding' },
  { value: 'hiring',              label: 'Hiring signal',       icon: '📋', desc: 'Company posts new job openings' },
  { value: 'website_visit',       label: 'Website visit',       icon: '🌐', desc: 'Prospect visits your website' },
  { value: 'custom',              label: 'Custom (API)',        icon: '⚡', desc: 'Trigger via webhook or API' },
]

interface Watchlist {
  id: string
  name: string
  signalType: string
  description: string | null
  active: boolean
  createdAt: string
  _count: { signals: number }
}

interface WatchlistSignal {
  id: string
  title: string
  body: string | null
  firedAt: string
  consumed: boolean
  watchlist?: { name: string; signalType: string }
}

function signalMeta(type: string) {
  return SIGNAL_TYPES.find((t) => t.value === type) ?? { icon: '⚡', label: type, desc: '' }
}

function formatRelTime(dateStr: string) {
  const d = new Date(dateStr)
  const now = Date.now()
  const diff = now - d.getTime()
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function SignalsPage() {
  const { status } = useSession()
  const router = useRouter()
  const [tab, setTab] = useState<'watchlists' | 'feed' | 'website'>('watchlists')
  const [watchlists, setWatchlists] = useState<Watchlist[]>([])
  const [signals, setSignals] = useState<WatchlistSignal[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', signalType: 'job_change', description: '' })
  const [expandedWl, setExpandedWl] = useState<string | null>(null)
  const [wlSignals, setWlSignals] = useState<Record<string, WatchlistSignal[]>>({})
  const [recentVisits, setRecentVisits] = useState<RecentVisit[]>([])
  const [visitsLoading, setVisitsLoading] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') { router.replace('/login') }
  }, [status, router])

  const fetchWatchlists = useCallback(async () => {
    const res = await fetch('/api/signals/watchlists')
    if (res.ok) {
      const d = await res.json()
      setWatchlists(d.watchlists ?? [])
    }
  }, [])

  const fetchFeed = useCallback(async () => {
    const res = await fetch('/api/signals/watchlists')
    if (!res.ok) return
    const { watchlists: wls } = await res.json()
    const all: WatchlistSignal[] = []
    for (const wl of (wls ?? []).slice(0, 5)) {
      const r = await fetch(`/api/signals/watchlists/${wl.id}/signals?limit=10`)
      if (r.ok) {
        const { signals: s } = await r.json()
        all.push(...(s ?? []).map((sig: WatchlistSignal) => ({ ...sig, watchlist: { name: wl.name, signalType: wl.signalType } })))
      }
    }
    all.sort((a, b) => new Date(b.firedAt).getTime() - new Date(a.firedAt).getTime())
    setSignals(all.slice(0, 50))
  }, [])

  const fetchRecentVisits = useCallback(async () => {
    setVisitsLoading(true)
    const res = await fetch('/api/track/visits?limit=5')
    if (res.ok) {
      const d = await res.json()
      setRecentVisits(d.visits ?? [])
    }
    setVisitsLoading(false)
  }, [])

  useEffect(() => {
    if (status !== 'authenticated') return
    setLoading(true)
    let work: Promise<unknown>
    if (tab === 'feed') {
      work = Promise.all([fetchWatchlists(), fetchFeed()])
    } else if (tab === 'website') {
      work = fetchRecentVisits()
    } else {
      work = fetchWatchlists()
    }
    Promise.resolve(work).finally(() => setLoading(false))
  }, [status, tab, fetchWatchlists, fetchFeed, fetchRecentVisits])

  const handleCreate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.signalType) return
    setCreating(true)
    const res = await fetch('/api/signals/watchlists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name, signalType: form.signalType, description: form.description || null }),
    })
    if (res.ok) {
      await fetchWatchlists()
      setShowCreate(false)
      setForm({ name: '', signalType: 'job_change', description: '' })
    }
    setCreating(false)
  }, [form, fetchWatchlists])

  const handleToggle = useCallback(async (wl: Watchlist) => {
    setWatchlists((prev) => prev.map((w) => w.id === wl.id ? { ...w, active: !w.active } : w))
    fetch(`/api/signals/watchlists/${wl.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !wl.active }),
    }).catch(() => {})
  }, [])

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Delete this watchlist and all its signals?')) return
    setWatchlists((prev) => prev.filter((w) => w.id !== id))
    fetch(`/api/signals/watchlists/${id}`, { method: 'DELETE' }).catch(() => {})
  }, [])

  const handleExpandSignals = useCallback(async (id: string) => {
    if (expandedWl === id) { setExpandedWl(null); return }
    setExpandedWl(id)
    if (!wlSignals[id]) {
      const r = await fetch(`/api/signals/watchlists/${id}/signals?limit=5`)
      if (r.ok) {
        const { signals: s } = await r.json()
        setWlSignals((prev) => ({ ...prev, [id]: s ?? [] }))
      }
    }
  }, [expandedWl, wlSignals])

  if (status === 'loading' || loading) {
    return <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
  }

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-purple-500" /> Signal Agents
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Get notified when prospects show buying intent
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> New watchlist
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 mb-6 w-fit">
        {(['watchlists', 'feed', 'website'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
            }`}
          >
            {t === 'watchlists' ? `Watchlists (${watchlists.length})` : t === 'feed' ? 'Signal feed' : 'Website'}
          </button>
        ))}
      </div>

      {/* Watchlists tab */}
      {tab === 'watchlists' && (
        watchlists.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center mb-4">
              <Zap className="w-8 h-8 text-purple-400" />
            </div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">No watchlists yet</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4 max-w-xs">
              Create a watchlist to start monitoring prospects for buying signals
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition-colors"
            >
              <Plus className="w-4 h-4" /> Create first watchlist
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {watchlists.map((wl) => {
              const meta = signalMeta(wl.signalType)
              return (
                <div key={wl.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl">
                  <div className="flex items-center gap-4 px-4 py-3.5">
                    <div className="text-2xl flex-shrink-0">{meta.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">{wl.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-900 text-purple-700 dark:text-purple-400 border border-purple-100 dark:border-purple-800">
                          {meta.label}
                        </span>
                        {!wl.active && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500">Paused</span>
                        )}
                      </div>
                      {wl.description && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">{wl.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs text-gray-400">{wl._count.signals} signals</span>
                      <button
                        onClick={() => handleExpandSignals(wl.id)}
                        className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 flex items-center gap-0.5"
                      >
                        Recent <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expandedWl === wl.id ? 'rotate-180' : ''}`} />
                      </button>
                      <button
                        onClick={() => handleToggle(wl)}
                        title={wl.active ? 'Pause' : 'Activate'}
                        className="text-gray-400 hover:text-purple-500 transition-colors"
                      >
                        {wl.active
                          ? <ToggleRight className="w-5 h-5 text-purple-500" />
                          : <ToggleLeft className="w-5 h-5" />}
                      </button>
                      <button
                        onClick={() => handleDelete(wl.id)}
                        className="text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {expandedWl === wl.id && (
                    <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-3">
                      {(wlSignals[wl.id] ?? []).length === 0 ? (
                        <p className="text-xs text-gray-400 dark:text-gray-500 italic">No signals fired yet</p>
                      ) : (
                        <div className="space-y-2">
                          {(wlSignals[wl.id] ?? []).map((sig) => (
                            <div key={sig.id} className="flex items-start gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-1.5 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{sig.title}</p>
                                {sig.body && <p className="text-xs text-gray-400 truncate">{sig.body}</p>}
                              </div>
                              <span className="text-[10px] text-gray-400 flex-shrink-0">{formatRelTime(sig.firedAt)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      )}

      {/* Signal feed tab */}
      {tab === 'feed' && (
        signals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Zap className="w-8 h-8 text-gray-200 dark:text-gray-700 mb-3" />
            <p className="text-sm text-gray-400 dark:text-gray-500">No signals fired yet</p>
            <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">
              Signals will appear here once your watchlists detect activity
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {signals.map((sig) => {
              const meta = sig.watchlist ? signalMeta(sig.watchlist.signalType) : { icon: '⚡', label: '' }
              return (
                <div key={sig.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl flex items-start gap-3 px-4 py-3">
                  <span className="text-xl flex-shrink-0 mt-0.5">{meta.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">{sig.title}</span>
                      {sig.watchlist && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500">
                          {sig.watchlist.name}
                        </span>
                      )}
                    </div>
                    {sig.body && <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{sig.body}</p>}
                  </div>
                  <span className="text-[10px] text-gray-400 flex-shrink-0 mt-1">{formatRelTime(sig.firedAt)}</span>
                </div>
              )
            })}
          </div>
        )
      )}

      {/* Website tab */}
      {tab === 'website' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Last 5 website visits</p>
            <a
              href="/signals/website"
              className="text-xs text-purple-600 dark:text-purple-400 hover:underline font-medium"
            >
              View all analytics →
            </a>
          </div>
          {visitsLoading ? (
            <div className="text-center py-10 text-sm text-gray-400">Loading…</div>
          ) : recentVisits.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mb-4">
                <Globe className="w-7 h-7 text-emerald-400" />
              </div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">No visits yet</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-4 max-w-xs">
                Install the tracking snippet on your website to start identifying visitors
              </p>
              <a
                href="/settings#website-tracking"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
              >
                Get snippet
              </a>
            </div>
          ) : (
            <div className="space-y-2">
              {recentVisits.map((v) => {
                const isIdentified = !!(v.matchedLeadId || v.matchedContactId || v.matchedCompanyId)
                return (
                  <div key={v.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl flex items-start gap-3 px-4 py-3">
                    <Globe className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                          {v.resolvedOrg ?? (v.ip ? `IP: ${v.ip}` : 'Anonymous')}
                        </span>
                        {isIdentified && (
                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-400 font-medium">
                            Identified
                          </span>
                        )}
                      </div>
                      {v.url && <p className="text-xs text-gray-400 truncate">{v.url}</p>}
                    </div>
                    <span className="text-[10px] text-gray-400 flex-shrink-0 mt-1">{formatRelTime(v.visitedAt)}</span>
                  </div>
                )
              })}
              <div className="text-center pt-2">
                <a
                  href="/signals/website"
                  className="text-sm text-purple-600 dark:text-purple-400 hover:underline font-medium"
                >
                  See all visits →
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create watchlist modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">New watchlist</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Funding round prospects"
                  className="w-full px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Signal type</label>
                <div className="grid grid-cols-2 gap-2">
                  {SIGNAL_TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, signalType: t.value }))}
                      className={`text-left px-3 py-2.5 rounded-lg border text-xs transition-colors ${
                        form.signalType === t.value
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-200'
                          : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-base mr-1.5">{t.icon}</span>
                      <span className="font-medium">{t.label}</span>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="What are you watching for?"
                  className="w-full px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !form.name}
                  className="flex-1 px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors"
                >
                  {creating ? 'Creating…' : 'Create watchlist'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
