'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { HelpPanel } from '@/components/HelpPanel'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { TrendingUp, Plus, X, ChevronDown, List, LayoutGrid } from 'lucide-react'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PipelineStage {
  id: string
  name: string
  position: number
  probability: number
  type: string
  color: string
  _count?: { deals: number }
}

interface Pipeline {
  id: string
  name: string
  isDefault: boolean
  stages: PipelineStage[]
  _count?: { deals: number }
}

interface DealContact {
  id: string
  name: string
}

interface DealCompany {
  id: string
  name: string
  domain: string | null
}

interface Deal {
  id: string
  title: string
  value: number | null
  currency: string
  closeDate: string | null
  probability: number | null
  stageId: string
  stage: PipelineStage
  status: string
  contactId: string | null
  companyId: string | null
  contact: DealContact | null
  company: DealCompany | null
  description: string | null
  lostReason: string | null
  wonAt: string | null
  lostAt: string | null
  createdAt: string
  activities?: DealActivity[]
}

interface DealActivity {
  id: string
  type: string
  title: string
  body: string | null
  createdAt: string
  actorUserId: string | null
}

interface Stats {
  totalPipeline: number
  openDeals: number
  wonThisMonth: number
  avgDealSize: number
  closeRate: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(value: number | null, currency = 'USD') {
  if (value == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value)
}

function fmtDate(dateStr: string | null) {
  if (!dateStr) return null
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function isOverdue(dateStr: string | null) {
  if (!dateStr) return false
  return new Date(dateStr) < new Date()
}

function activityIcon(type: string) {
  switch (type) {
    case 'note': return '📝'
    case 'stage_change': return '🔄'
    case 'status_change': return '⚡'
    case 'email': return '📧'
    case 'call': return '📞'
    default: return '•'
  }
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────

function StatsBar({ stats, loading }: { stats: Stats | null; loading: boolean }) {
  const items = [
    { label: 'Total Pipeline', value: stats ? fmt(stats.totalPipeline) : '—' },
    { label: 'Open Deals', value: stats ? String(stats.openDeals) : '—' },
    { label: 'Won This Month', value: stats ? fmt(stats.wonThisMonth) : '—' },
    { label: 'Avg Deal Size', value: stats ? fmt(stats.avgDealSize) : '—' },
    { label: 'Close Rate', value: stats ? `${stats.closeRate}%` : '—' },
  ]
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
      {items.map(({ label, value }) => (
        <div key={label} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{label}</p>
          <p className={`text-xl font-bold text-gray-900 dark:text-white tabular-nums ${loading ? 'animate-pulse opacity-40' : ''}`}>{value}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Deal Card ────────────────────────────────────────────────────────────────

function DealCard({
  deal,
  onClick,
  onDragStart,
}: {
  deal: Deal
  onClick: () => void
  onDragStart: (e: React.DragEvent) => void
}) {
  const overdue = isOverdue(deal.closeDate)
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm transition-all select-none"
    >
      <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight mb-1 truncate">{deal.title}</p>
      {deal.value != null && (
        <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mb-1">{fmt(deal.value, deal.currency)}</p>
      )}
      {deal.contact && (
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{deal.contact.name}</p>
      )}
      {deal.company && !deal.contact && (
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{deal.company.name}</p>
      )}
      {deal.closeDate && (
        <p className={`text-xs mt-1 ${overdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
          {overdue ? '⚠ ' : ''}{fmtDate(deal.closeDate)}
        </p>
      )}
    </div>
  )
}

// ─── Quick Create Form ────────────────────────────────────────────────────────

function QuickCreateForm({
  stageId,
  pipelineId,
  onSuccess,
  onCancel,
}: {
  stageId: string
  pipelineId: string
  onSuccess: (deal: Deal) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const [value, setValue] = useState('')
  const [closeDate, setCloseDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), pipelineId, stageId, value: value || null, closeDate: closeDate || null }),
      })
      if (res.ok) {
        const data = await res.json()
        onSuccess(data.deal)
        setTitle(''); setValue(''); setCloseDate('')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-2">
      <input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Deal title *"
        required
        className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2.5 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Value ($)"
          className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2.5 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
        />
        <input
          type="date"
          value={closeDate}
          onChange={(e) => setCloseDate(e.target.value)}
          className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2.5 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 text-xs py-1.5 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting || !title.trim()}
          className="flex-1 text-xs py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-50 transition-colors"
        >
          {submitting ? 'Adding…' : 'Add deal'}
        </button>
      </div>
    </form>
  )
}

// ─── Deal Slide-Over ──────────────────────────────────────────────────────────

function DealSlideOver({
  deal: initialDeal,
  stages,
  onClose,
  onUpdate,
  onDelete,
}: {
  deal: Deal
  stages: PipelineStage[]
  onClose: () => void
  onUpdate: (deal: Deal) => void
  onDelete: (dealId: string) => void
}) {
  const [deal, setDeal] = useState(initialDeal)
  const [activities, setActivities] = useState<DealActivity[]>(initialDeal.activities ?? [])
  const [noteText, setNoteText] = useState('')
  const [addingNote, setAddingNote] = useState(false)
  const [markingWon, setMarkingWon] = useState(false)
  const [markingLost, setMarkingLost] = useState(false)
  const [lostReason, setLostReason] = useState('')
  const [showLostForm, setShowLostForm] = useState(false)
  const [descDraft, setDescDraft] = useState(deal.description ?? '')
  const [descSaving, setDescSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Fetch full deal with activities on mount
  useEffect(() => {
    fetch(`/api/deals/${initialDeal.id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (!d) return
        setDeal(d.deal)
        setActivities(d.deal.activities ?? [])
        setDescDraft(d.deal.description ?? '')
      })
      .catch(() => {})
  }, [initialDeal.id])

  async function changeStage(stageId: string) {
    const res = await fetch(`/api/deals/${deal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stageId }),
    })
    if (res.ok) {
      const d = await res.json()
      setDeal(d.deal)
      onUpdate(d.deal)
      // Refresh activities
      fetch(`/api/deals/${deal.id}/activities`)
        .then((r) => r.ok ? r.json() : null)
        .then((d) => { if (d) setActivities(d.activities) })
    }
  }

  async function markWon() {
    setMarkingWon(true)
    const res = await fetch(`/api/deals/${deal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'won' }),
    })
    setMarkingWon(false)
    if (res.ok) {
      const d = await res.json()
      setDeal(d.deal)
      onUpdate(d.deal)
      fetch(`/api/deals/${deal.id}/activities`).then((r) => r.ok ? r.json() : null).then((d) => { if (d) setActivities(d.activities) })
    }
  }

  async function handleMarkLost() {
    setMarkingLost(true)
    const res = await fetch(`/api/deals/${deal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'lost', lostReason }),
    })
    setMarkingLost(false)
    setShowLostForm(false)
    if (res.ok) {
      const d = await res.json()
      setDeal(d.deal)
      onUpdate(d.deal)
      fetch(`/api/deals/${deal.id}/activities`).then((r) => r.ok ? r.json() : null).then((d) => { if (d) setActivities(d.activities) })
    }
  }

  async function saveDescription() {
    setDescSaving(true)
    const res = await fetch(`/api/deals/${deal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: descDraft }),
    })
    setDescSaving(false)
    if (res.ok) {
      const d = await res.json()
      setDeal(d.deal)
      onUpdate(d.deal)
    }
  }

  async function addNote() {
    if (!noteText.trim()) return
    setAddingNote(true)
    const res = await fetch(`/api/deals/${deal.id}/activities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'note', body: noteText.trim() }),
    })
    setAddingNote(false)
    if (res.ok) {
      const d = await res.json()
      setActivities((prev) => [d.activity, ...prev])
      setNoteText('')
    }
  }

  async function deleteDeal() {
    if (!confirm('Delete this deal? This cannot be undone.')) return
    setDeleting(true)
    const res = await fetch(`/api/deals/${deal.id}`, { method: 'DELETE' })
    setDeleting(false)
    if (res.ok) {
      onDelete(deal.id)
      onClose()
    }
  }

  const statusBadge = deal.status === 'won'
    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900 dark:text-emerald-200 dark:border-emerald-600/50'
    : deal.status === 'lost'
    ? 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900 dark:text-red-200 dark:border-red-600/50'
    : 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-600/50'

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      {/* Panel */}
      <div className="w-full max-w-[480px] bg-white dark:bg-gray-950 border-l border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white leading-tight truncate">{deal.title}</h2>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {deal.value != null && (
                  <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{fmt(deal.value, deal.currency)}</span>
                )}
                {deal.closeDate && (
                  <span className={`text-xs ${isOverdue(deal.closeDate) ? 'text-red-500' : 'text-gray-500'}`}>
                    {fmtDate(deal.closeDate)}
                  </span>
                )}
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${statusBadge}`}>{deal.status}</span>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded flex-shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Stage dropdown */}
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <label className="text-xs text-gray-500 dark:text-gray-400">Stage:</label>
            <select
              value={deal.stageId}
              onChange={(e) => changeStage(e.target.value)}
              className="text-xs border border-gray-200 dark:border-gray-700 rounded-md px-2 py-1 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {stages.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            {deal.status === 'open' && (
              <>
                <button
                  onClick={markWon}
                  disabled={markingWon}
                  className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-md disabled:opacity-50 transition-colors"
                >
                  {markingWon ? 'Marking…' : 'Mark Won'}
                </button>
                <button
                  onClick={() => setShowLostForm(true)}
                  className="text-xs bg-red-50 hover:bg-red-100 text-red-600 px-2.5 py-1 rounded-md border border-red-200 transition-colors"
                >
                  Mark Lost
                </button>
              </>
            )}
            <button
              onClick={deleteDeal}
              disabled={deleting}
              className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded-md hover:bg-red-50 dark:hover:bg-red-950 transition-colors ml-auto"
            >
              {deleting ? '…' : 'Delete'}
            </button>
          </div>

          {showLostForm && (
            <div className="mt-2 flex gap-2">
              <input
                value={lostReason}
                onChange={(e) => setLostReason(e.target.value)}
                placeholder="Lost reason (optional)"
                className="flex-1 text-xs border border-gray-200 dark:border-gray-700 rounded-md px-2.5 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <button
                onClick={handleMarkLost}
                disabled={markingLost}
                className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-md disabled:opacity-50"
              >
                Confirm
              </button>
              <button
                onClick={() => setShowLostForm(false)}
                className="text-xs text-gray-500 px-2 py-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Contact / Company */}
          {(deal.contact || deal.company) && (
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 space-y-2">
              {deal.contact && (
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xs font-bold text-blue-700 dark:text-blue-200 flex-shrink-0">
                    {deal.contact.name[0]?.toUpperCase()}
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{deal.contact.name}</p>
                </div>
              )}
              {deal.company && (
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-400 flex-shrink-0">
                    {deal.company.name[0]?.toUpperCase()}
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{deal.company.name}{deal.company.domain ? ` · ${deal.company.domain}` : ''}</p>
                </div>
              )}
            </div>
          )}

          {/* Description */}
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Description</p>
            <textarea
              rows={3}
              value={descDraft}
              onChange={(e) => setDescDraft(e.target.value)}
              onBlur={saveDescription}
              placeholder="Add notes about this deal…"
              className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none"
            />
            {descSaving && <p className="text-xs text-gray-400 mt-1">Saving…</p>}
          </div>

          {/* Activity */}
          <div className="px-5 py-4">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Activity</p>

            {/* Add note */}
            <div className="mb-4">
              <textarea
                rows={2}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add a note…"
                className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none"
              />
              <button
                onClick={addNote}
                disabled={addingNote || !noteText.trim()}
                className="mt-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md disabled:opacity-50 transition-colors"
              >
                {addingNote ? 'Adding…' : 'Add note'}
              </button>
            </div>

            {/* Activity list */}
            <div className="space-y-3">
              {activities.length === 0 ? (
                <p className="text-xs text-gray-400">No activity yet.</p>
              ) : (
                activities.map((a) => (
                  <div key={a.id} className="flex items-start gap-2.5">
                    <span className="text-sm mt-0.5 flex-shrink-0">{activityIcon(a.type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 dark:text-gray-300">{a.title}</p>
                      {a.body && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{a.body}</p>}
                    </div>
                    <p className="text-xs text-gray-400 flex-shrink-0">
                      {new Date(a.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── List View ────────────────────────────────────────────────────────────────

function ListView({
  deals,
  stages,
  onClickDeal,
}: {
  deals: Deal[]
  stages: PipelineStage[]
  onClickDeal: (deal: Deal) => void
}) {
  const stageMap = Object.fromEntries(stages.map((s) => [s.id, s]))
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
            <tr>
              {['Title', 'Stage', 'Contact', 'Company', 'Value', 'Close date', 'Status'].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
            {deals.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-400">No deals yet.</td>
              </tr>
            ) : (
              deals.map((deal) => {
                const stage = stageMap[deal.stageId]
                const overdue = isOverdue(deal.closeDate)
                return (
                  <tr
                    key={deal.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                    onClick={() => onClickDeal(deal)}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white max-w-[200px] truncate">{deal.title}</td>
                    <td className="px-4 py-3">
                      {stage && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />
                          {stage.name}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{deal.contact?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{deal.company?.name ?? '—'}</td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{fmt(deal.value, deal.currency)}</td>
                    <td className={`px-4 py-3 text-xs ${overdue ? 'text-red-500 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                      {fmtDate(deal.closeDate) ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                        deal.status === 'won' ? 'bg-emerald-100 text-emerald-700' :
                        deal.status === 'lost' ? 'bg-red-100 text-red-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>{deal.status}</span>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PipelinePage() {
  const { status } = useSession()
  const router = useRouter()

  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null)
  const [deals, setDeals] = useState<Deal[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [loading, setLoading] = useState(true)
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null)
  const [showCreateForm, setShowCreateForm] = useState<{ stageId: string } | null>(null)
  const [dragState, setDragState] = useState<{ dealId: string; sourceStageId: string } | null>(null)
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board')
  const [pipelineDropdownOpen, setPipelineDropdownOpen] = useState(false)

  // Auth guard
  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login')
  }, [status, router])

  // Load pipelines
  const loadPipelines = useCallback(async () => {
    const res = await fetch('/api/pipelines')
    if (res.ok) {
      const data = await res.json()
      setPipelines(data.pipelines)
      if (!selectedPipeline && data.pipelines.length > 0) {
        setSelectedPipeline(data.pipelines[0])
      }
    }
  }, [selectedPipeline])

  // Load deals for selected pipeline
  const loadDeals = useCallback(async (pipelineId: string) => {
    setLoading(true)
    const res = await fetch(`/api/deals?pipelineId=${pipelineId}`)
    if (res.ok) {
      const data = await res.json()
      setDeals(data.deals)
    }
    setLoading(false)
  }, [])

  // Load stats
  const loadStats = useCallback(async (pipelineId: string) => {
    setStatsLoading(true)
    const res = await fetch(`/api/deals/stats?pipelineId=${pipelineId}`)
    if (res.ok) {
      const data = await res.json()
      setStats(data)
    }
    setStatsLoading(false)
  }, [])

  useEffect(() => {
    if (status === 'authenticated') loadPipelines()
  }, [status, loadPipelines])

  useEffect(() => {
    if (selectedPipeline) {
      loadDeals(selectedPipeline.id)
      loadStats(selectedPipeline.id)
    }
  }, [selectedPipeline, loadDeals, loadStats])

  function handleDragStart(e: React.DragEvent, dealId: string, sourceStageId: string) {
    setDragState({ dealId, sourceStageId })
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  async function handleDrop(e: React.DragEvent, targetStageId: string) {
    e.preventDefault()
    if (!dragState || dragState.sourceStageId === targetStageId) {
      setDragState(null)
      return
    }

    const { dealId } = dragState
    setDragState(null)

    // Optimistic update
    setDeals((prev) =>
      prev.map((d) => d.id === dealId ? { ...d, stageId: targetStageId } : d)
    )

    const res = await fetch(`/api/deals/${dealId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stageId: targetStageId }),
    })

    if (!res.ok) {
      // Revert on failure
      setDeals((prev) =>
        prev.map((d) => d.id === dealId ? { ...d, stageId: dragState.sourceStageId } : d)
      )
    } else {
      const data = await res.json()
      setDeals((prev) => prev.map((d) => d.id === dealId ? { ...d, stage: data.deal.stage } : d))
    }
  }

  function handleDealCreated(deal: Deal) {
    setDeals((prev) => [deal, ...prev])
    setShowCreateForm(null)
    if (selectedPipeline) loadStats(selectedPipeline.id)
  }

  function handleDealUpdated(updated: Deal) {
    setDeals((prev) => prev.map((d) => d.id === updated.id ? updated : d))
    if (selectedPipeline) loadStats(selectedPipeline.id)
  }

  function handleDealDeleted(dealId: string) {
    setDeals((prev) => prev.filter((d) => d.id !== dealId))
    if (selectedPipeline) loadStats(selectedPipeline.id)
  }

  if (status === 'loading') {
    return <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
  }

  const stages = selectedPipeline?.stages ?? []

  return (
    <div className="p-4 md:p-6 lg:p-8 flex flex-col min-h-0 h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-6 h-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pipeline</h1>

          {/* Pipeline picker */}
          {pipelines.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setPipelineDropdownOpen((o) => !o)}
                className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                {selectedPipeline?.name ?? 'Select pipeline'}
                <ChevronDown className="w-4 h-4" />
              </button>
              {pipelineDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-20 min-w-[160px]">
                  {pipelines.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => { setSelectedPipeline(p); setPipelineDropdownOpen(false) }}
                      className={`w-full text-left text-sm px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 first:rounded-t-xl last:rounded-b-xl transition-colors ${
                        p.id === selectedPipeline?.id ? 'text-blue-600 font-semibold' : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('board')}
              className={`p-1.5 ${viewMode === 'board' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
              title="Board view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <Link
            href="/settings/pipeline"
            className="text-sm font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Settings
          </Link>
        </div>
      </div>

      {/* Stats bar */}
      <StatsBar stats={stats} loading={statsLoading} />

      {/* Board / List */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Loading deals…</div>
      ) : viewMode === 'list' ? (
        <ListView
          deals={deals}
          stages={stages}
          onClickDeal={(d) => setSelectedDeal(d)}
        />
      ) : (
        /* Board */
        <div className="flex-1 overflow-x-auto pb-4">
          {stages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <TrendingUp className="w-12 h-12 text-gray-200 dark:text-gray-700 mb-4" />
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">No pipeline yet</p>
              <p className="text-xs text-gray-400 max-w-xs">Loading your pipeline…</p>
            </div>
          ) : (
            <div className="flex gap-4 h-full" style={{ minWidth: `${Math.max(stages.length * 280, 320)}px` }}>
              {stages.map((stage) => {
                const stageDeals = deals.filter((d) => d.stageId === stage.id)
                const stageValue = stageDeals.reduce((sum, d) => sum + (d.value ?? 0), 0)
                const isDropTarget = dragState && dragState.sourceStageId !== stage.id

                return (
                  <div
                    key={stage.id}
                    className={`flex flex-col w-[272px] flex-shrink-0 bg-gray-50 dark:bg-gray-900 rounded-xl border transition-colors ${
                      isDropTarget ? 'border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-950/30' : 'border-gray-200 dark:border-gray-800'
                    }`}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, stage.id)}
                  >
                    {/* Column header */}
                    <div className="px-3 py-3 border-b border-gray-200 dark:border-gray-800">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />
                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide flex-1 truncate">{stage.name}</span>
                        <span className="text-xs text-gray-400 bg-gray-200 dark:bg-gray-700 rounded-full px-1.5 py-0.5">{stageDeals.length}</span>
                      </div>
                      {stageValue > 0 && (
                        <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5 ml-4">{fmt(stageValue)}</p>
                      )}
                    </div>

                    {/* Deal cards */}
                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                      {stageDeals.length === 0 && !dragState && (
                        <div className="text-xs text-gray-300 dark:text-gray-600 text-center py-4">No deals</div>
                      )}
                      {stageDeals.map((deal) => (
                        <DealCard
                          key={deal.id}
                          deal={deal}
                          onClick={() => setSelectedDeal(deal)}
                          onDragStart={(e) => handleDragStart(e, deal.id, deal.stageId)}
                        />
                      ))}
                    </div>

                    {/* Footer: Add deal */}
                    <div className="p-2 border-t border-gray-200 dark:border-gray-800">
                      {showCreateForm?.stageId === stage.id && selectedPipeline ? (
                        <QuickCreateForm
                          stageId={stage.id}
                          pipelineId={selectedPipeline.id}
                          onSuccess={handleDealCreated}
                          onCancel={() => setShowCreateForm(null)}
                        />
                      ) : (
                        <button
                          onClick={() => setShowCreateForm({ stageId: stage.id })}
                          className="w-full flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-white dark:hover:bg-gray-800 rounded-lg px-2 py-2 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add deal
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Deal slide-over */}
      {selectedDeal && selectedPipeline && (
        <DealSlideOver
          deal={selectedDeal}
          stages={selectedPipeline.stages}
          onClose={() => setSelectedDeal(null)}
          onUpdate={handleDealUpdated}
          onDelete={handleDealDeleted}
        />
      )}
      <HelpPanel
        title='CRM Pipeline'
        description='Track deals from first contact to closed-won. Move cards across stages as your conversations progress.'
        sections={[
        { title: 'What is a Pipeline?', content: 'A pipeline is a visual board showing where every potential deal stands. Each column is a stage in your sales process — deals move left to right as they progress.', example: 'Anjali Verma starts in LEAD when she first replies to your LinkedIn message. After a discovery call she moves to QUALIFIED. After you send pricing she moves to PROPOSAL SENT.', tip: 'Create multiple pipelines for different products or markets — e.g. "Enterprise" and "SMB".' },
        { title: 'How to add a deal', content: 'Click "+ Add Deal" in any stage column, or go to a lead\'s profile and click "Add to Pipeline". Fill in the deal title, value, and expected close date.', example: 'You spoke to Rajesh Kumar on a call. Open his lead profile → Add to Pipeline → $5,000 → Close date: 30 July.' },
        { title: 'Moving deals between stages', content: 'Click on a deal card to open the slide-over. Use the Stage dropdown to move it, or drag-and-drop between columns. Each stage has a win probability — your close rate is calculated from this.', example: 'You sent a proposal to Meesho → open the deal → change Stage to "Proposal Sent" → probability auto-updates to 60%.', tip: 'Set realistic probabilities in Settings → Pipeline. Inaccurate probabilities make your forecast misleading.' },
        { title: 'Won and Lost deals', content: 'When a deal closes, mark it Won or Lost. Lost deals are removed from the board but kept in history. Won deals count toward your "Won this month" metric.', example: '$12,000 deal with Swiggy → Mark as Won → appears in monthly revenue stats on the Analytics page.', tip: 'Add a note when marking lost ("Price too high", "Went with competitor") — it helps spot patterns later.' },
        { title: 'Pipeline stats explained', content: 'Total Pipeline = sum of all open deal values. Close Rate = Won deals ÷ total deals closed. Avg Deal Size = total won value ÷ won deal count.', example: 'You have 5 open deals worth $50K total. You won 2 out of 4 closed deals. Close rate = 50%.', tip: 'A 0% close rate just means no deals are marked Won yet — add outcomes as you close them.' },
        ]}
      />
    </div>
  )
}
