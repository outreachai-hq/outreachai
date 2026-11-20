'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Phone, Plus, X, PhoneIncoming, PhoneOutgoing, PhoneMissed, Clock, Pencil, Trash2 } from 'lucide-react'

const OUTCOMES = [
  { value: 'interested',     label: 'Interested',     color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:border-emerald-600' },
  { value: 'not_interested', label: 'Not interested', color: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-200 dark:border-red-600' },
  { value: 'callback',       label: 'Callback',       color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-200 dark:border-blue-600' },
  { value: 'left_voicemail', label: 'Left voicemail', color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-700' },
  { value: 'wrong_number',   label: 'Wrong number',   color: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-slate-700 dark:text-slate-300 dark:border-gray-700' },
]

interface Call {
  id: string
  toNumber: string
  fromNumber: string | null
  direction: string
  status: string
  durationSec: number | null
  notes: string | null
  outcome: string | null
  startedAt: string
  endedAt: string | null
}

function OutcomeBadge({ outcome }: { outcome: string | null }) {
  if (!outcome) return <span className="text-xs text-gray-400">—</span>
  const meta = OUTCOMES.find((o) => o.value === outcome)
  if (!meta) return <span className="text-xs text-gray-400">{outcome}</span>
  return (
    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${meta.color}`}>
      {meta.label}
    </span>
  )
}

function formatDuration(sec: number | null) {
  if (!sec) return '—'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr)
  const now = Date.now()
  const diff = now - d.getTime()
  if (diff < 86_400_000) return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  if (diff < 7 * 86_400_000) return d.toLocaleDateString('en-US', { weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: true })
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function parseDuration(val: string): number | null {
  if (!val) return null
  if (val.includes(':')) {
    const [m, s] = val.split(':').map(Number)
    return (m || 0) * 60 + (s || 0)
  }
  const n = parseInt(val)
  return isNaN(n) ? null : n
}

export default function CallsPage() {
  const { status } = useSession()
  const router = useRouter()
  const [calls, setCalls] = useState<Call[]>([])
  const [loading, setLoading] = useState(true)
  const [showLog, setShowLog] = useState(false)
  const [logging, setLogging] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editNotes, setEditNotes] = useState('')
  const [editOutcome, setEditOutcome] = useState('')
  const [form, setForm] = useState({
    toNumber: '',
    direction: 'outbound',
    duration: '',
    outcome: '',
    notes: '',
  })

  useEffect(() => {
    if (status === 'unauthenticated') { router.replace('/login') }
  }, [status, router])

  const fetchCalls = useCallback(async () => {
    const res = await fetch('/api/calls?limit=50')
    if (res.ok) {
      const d = await res.json()
      setCalls(d.calls ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (status !== 'authenticated') return
    fetchCalls()
  }, [status, fetchCalls])

  const handleLog = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.toNumber) return
    setLogging(true)
    const res = await fetch('/api/calls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toNumber: form.toNumber,
        direction: form.direction,
        durationSec: parseDuration(form.duration),
        outcome: form.outcome || null,
        notes: form.notes || null,
      }),
    })
    if (res.ok) {
      await fetchCalls()
      setShowLog(false)
      setForm({ toNumber: '', direction: 'outbound', duration: '', outcome: '', notes: '' })
    }
    setLogging(false)
  }, [form, fetchCalls])

  const handleSaveEdit = useCallback(async (id: string) => {
    await fetch(`/api/calls/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: editNotes || null, outcome: editOutcome || null }),
    })
    setCalls((prev) => prev.map((c) => c.id === id ? { ...c, notes: editNotes || null, outcome: editOutcome || null } : c))
    setEditId(null)
  }, [editNotes, editOutcome])

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Delete this call record?')) return
    setCalls((prev) => prev.filter((c) => c.id !== id))
    fetch(`/api/calls/${id}`, { method: 'DELETE' }).catch(() => {})
  }, [])

  // Stats
  // Captured once per mount so render stays pure
  const [mountedAt] = useState(() => Date.now())
  const weekAgo = mountedAt - 7 * 86_400_000
  const thisWeek = calls.filter((c) => new Date(c.startedAt).getTime() > weekAgo)
  const avgDuration = thisWeek.length > 0
    ? Math.round(thisWeek.filter((c) => c.durationSec).reduce((sum, c) => sum + (c.durationSec ?? 0), 0) / Math.max(1, thisWeek.filter((c) => c.durationSec).length))
    : null
  const connectedRate = thisWeek.length > 0
    ? Math.round((thisWeek.filter((c) => c.status === 'completed' && c.durationSec).length / thisWeek.length) * 100)
    : null

  if (status === 'loading' || loading) {
    return <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
  }

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Phone className="w-5 h-5 text-emerald-500" /> Calls
            {calls.length > 0 && (
              <span className="text-sm font-normal text-gray-400 ml-1">({calls.length})</span>
            )}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Track and log calls with your prospects</p>
        </div>
        <button
          onClick={() => setShowLog(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> Log a call
        </button>
      </div>

      {/* Stats row */}
      {thisWeek.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">Calls this week</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5">{thisWeek.length}</p>
          </div>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">Avg duration</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5">
              {avgDuration !== null ? formatDuration(avgDuration) : '—'}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">Connection rate</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5">
              {connectedRate !== null ? `${connectedRate}%` : '—'}
            </p>
          </div>
        </div>
      )}

      {/* Call log */}
      {calls.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mb-4">
            <Phone className="w-8 h-8 text-emerald-400" />
          </div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">No calls logged yet</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Click &quot;Log a call&quot; to start tracking your calls</p>
          <button
            onClick={() => setShowLog(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> Log your first call
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                  <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-4 py-2.5">Number</th>
                  <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-4 py-2.5">Direction</th>
                  <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-4 py-2.5">Duration</th>
                  <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-4 py-2.5">Outcome</th>
                  <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-4 py-2.5">Notes</th>
                  <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-4 py-2.5">When</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {calls.map((call) => (
                  <tr key={call.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm text-gray-900 dark:text-white">{call.toNumber}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${
                        call.direction === 'inbound'
                          ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-200 dark:border-blue-600'
                          : 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-slate-700 dark:text-slate-300 dark:border-gray-700'
                      }`}>
                        {call.direction === 'inbound'
                          ? <PhoneIncoming className="w-3 h-3" />
                          : <PhoneOutgoing className="w-3 h-3" />}
                        {call.direction === 'inbound' ? 'Inbound' : 'Outbound'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300">
                        <Clock className="w-3 h-3 text-gray-400" />
                        {formatDuration(call.durationSec)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {editId === call.id ? (
                        <select
                          value={editOutcome}
                          onChange={(e) => setEditOutcome(e.target.value)}
                          className="text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        >
                          <option value="">No outcome</option>
                          {OUTCOMES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      ) : (
                        <OutcomeBadge outcome={call.outcome} />
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      {editId === call.id ? (
                        <input
                          type="text"
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          placeholder="Notes…"
                          className="text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white w-full"
                        />
                      ) : (
                        <span className="text-xs text-gray-500 dark:text-gray-400 truncate block max-w-[180px]">
                          {call.notes ?? <span className="italic text-gray-300 dark:text-gray-600">—</span>}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-400">{formatTime(call.startedAt)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {editId === call.id ? (
                          <>
                            <button
                              onClick={() => handleSaveEdit(call.id)}
                              className="text-xs px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditId(null)}
                              className="text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => { setEditId(call.id); setEditNotes(call.notes ?? ''); setEditOutcome(call.outcome ?? '') }}
                              className="text-gray-300 hover:text-gray-600 dark:text-gray-600 dark:hover:text-gray-300 transition-colors p-1"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(call.id)}
                              className="text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400 transition-colors p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Log call panel */}
      {showLog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Log a call</h2>
              <button onClick={() => setShowLog(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleLog} className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Phone number</label>
                <input
                  type="tel"
                  value={form.toNumber}
                  onChange={(e) => setForm((f) => ({ ...f, toNumber: e.target.value }))}
                  placeholder="+1 555 123 4567"
                  className="w-full px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Direction</label>
                <div className="flex gap-2">
                  {(['outbound', 'inbound'] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, direction: d }))}
                      className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
                        form.direction === d
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-200'
                          : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300'
                      }`}
                    >
                      {d === 'outbound' ? <PhoneOutgoing className="w-3.5 h-3.5" /> : <PhoneIncoming className="w-3.5 h-3.5" />}
                      {d === 'outbound' ? 'Outbound' : 'Inbound'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Duration <span className="text-gray-400">(mm:ss or seconds)</span>
                </label>
                <input
                  type="text"
                  value={form.duration}
                  onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))}
                  placeholder="3:45 or 225"
                  className="w-full px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Outcome</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, outcome: '' }))}
                    className={`py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                      !form.outcome
                        ? 'border-gray-400 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
                        : 'border-gray-200 dark:border-gray-700 text-gray-400 hover:border-gray-300'
                    }`}
                  >
                    No outcome
                  </button>
                  {OUTCOMES.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, outcome: o.value }))}
                      className={`py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                        form.outcome === o.value ? o.color : 'border-gray-200 dark:border-gray-700 text-gray-400 hover:border-gray-300'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes <span className="text-gray-400">(optional)</span>
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="What was discussed?"
                  rows={3}
                  className="w-full px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowLog(false)}
                  className="flex-1 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={logging || !form.toNumber}
                  className="flex-1 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  {logging ? 'Logging…' : 'Log call'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
