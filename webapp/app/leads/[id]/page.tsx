'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Search, SlidersHorizontal, Plus, Sparkles,
  ChevronDown, ExternalLink, CheckCircle2, XCircle, HelpCircle, X,
} from 'lucide-react'
import { ActivityTimeline, type ActivityRow } from '@/components/ActivityTimeline'
import { CustomFieldsPanel } from '@/components/CustomFieldsPanel'

interface Lead {
  id: string
  firstName: string
  lastName: string | null
  email: string | null
  company: string | null
  linkedinUrl: string | null
  headline: string | null
  aiOpener: string | null
  status: string
  createdAt: string
  customFields?: Record<string, unknown>
  aiColumnRuns?: Record<string, { status?: string; lastRunAt?: string; error?: string | null }>
}

interface LeadList {
  id: string
  name: string
  leads: Lead[]
}

// dot colors for the small status dot in the badge
const STATUS_DOT: Record<string, string> = {
  pending: 'bg-slate-400', in_progress: 'bg-blue-500',
  completed: 'bg-green-500', replied: 'bg-purple-500', bounced: 'bg-red-500',
}
const STATUS_CHIP: Record<string, string> = {
  pending: 'chip chip-pending', in_progress: 'chip chip-sent',
  completed: 'chip chip-replied', replied: 'chip chip-purple', bounced: 'chip chip-bounced',
}
// Legacy alias kept for existing JSX that destructures { bg, text, dot }
const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  pending:     { bg: 'chip-pending',  text: '', dot: STATUS_DOT.pending },
  in_progress: { bg: 'chip-sent',     text: '', dot: STATUS_DOT.in_progress },
  completed:   { bg: 'chip-replied',  text: '', dot: STATUS_DOT.completed },
  replied:     { bg: 'chip-purple',   text: '', dot: STATUS_DOT.replied },
  bounced:     { bg: 'chip-bounced',  text: '', dot: STATUS_DOT.bounced },
}

function getAvatarColor(name: string): string {
  const colors = [
    '#3B82F6', '#8B5CF6', '#10B981', '#F59E0B',
    '#EC4899', '#14B8A6', '#6366F1', '#EF4444',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

function LeadAvatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .map((p) => p[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2)
  const color = getAvatarColor(name)
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
      style={{ backgroundColor: color }}
    >
      {initials}
    </div>
  )
}

export default function LeadListDetailPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [list, setList] = useState<LeadList | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [enriching, setEnriching] = useState(false)

  // Email verification per-lead
  const [verifying, setVerifying] = useState<Record<string, boolean>>({})
  const [verifyResults, setVerifyResults] = useState<Record<string, { status: 'valid' | 'invalid' | 'unknown'; score: number }>>({})
  const [verifyErrors, setVerifyErrors] = useState<Record<string, string>>({})

  // Per-lead Activity drawer (Plan 4)
  const [activeLeadId, setActiveLeadId] = useState<string | null>(null)
  const [activities, setActivities] = useState<ActivityRow[]>([])
  const [activitiesLoading, setActivitiesLoading] = useState(false)

  // Lead editing
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', email: '', company: '', linkedinUrl: '', headline: '' })
  const [editSaving, setEditSaving] = useState(false)

  const loadActivities = useCallback(async (leadId: string) => {
    setActivitiesLoading(true)
    try {
      const res = await fetch(`/api/leads/${leadId}/activities`)
      if (res.ok) {
        const d = await res.json()
        setActivities(d.activities ?? [])
      } else {
        setActivities([])
      }
    } finally {
      setActivitiesLoading(false)
    }
  }, [])

  async function saveLead() {
    if (!activeLeadId) return
    setEditSaving(true)
    const res = await fetch(`/api/lead-lists/${id}/leads/${activeLeadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: editForm.firstName || undefined,
        lastName: editForm.lastName || undefined,
        email: editForm.email || undefined,
        company: editForm.company || undefined,
        linkedinUrl: editForm.linkedinUrl || undefined,
        headline: editForm.headline || undefined,
      }),
    })
    if (res.ok) {
      fetchList()
      setEditingLeadId(null)
    }
    setEditSaving(false)
  }

  useEffect(() => {
    if (!activeLeadId) { setActivities([]); return }
    const lead = list?.leads.find(l => l.id === activeLeadId)
    if (lead) {
      setEditForm({
        firstName: lead.firstName,
        lastName: lead.lastName ?? '',
        email: lead.email ?? '',
        company: lead.company ?? '',
        linkedinUrl: lead.linkedinUrl ?? '',
        headline: lead.headline ?? '',
      })
      setEditingLeadId(null)
    }
    loadActivities(activeLeadId)
  }, [activeLeadId, loadActivities, list?.leads])

  async function addNote(body: string) {
    if (!activeLeadId) return
    const res = await fetch(`/api/leads/${activeLeadId}/activities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    })
    if (res.ok) await loadActivities(activeLeadId)
  }

  async function verifyEmail(leadId: string, email: string) {
    setVerifying(prev => ({ ...prev, [leadId]: true }))
    setVerifyErrors(prev => ({ ...prev, [leadId]: '' }))
    const res = await fetch('/api/enrichment/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    if (res.ok) {
      const data = await res.json()
      setVerifyResults(prev => ({ ...prev, [leadId]: data }))
    } else {
      const data = await res.json().catch(() => ({}))
      setVerifyErrors(prev => ({ ...prev, [leadId]: data.error ?? 'Verification failed' }))
    }
    setVerifying(prev => ({ ...prev, [leadId]: false }))
  }

  const fetchList = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/lead-lists/${id}`)
    if (res.ok) setList(await res.json())
    else router.replace('/leads')
    setLoading(false)
  }, [id, router])

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login')
    if (status === 'authenticated') {
      const t = setTimeout(() => fetchList(), 0)
      return () => clearTimeout(t)
    }
  }, [status, fetchList, router])

  async function enrichWithAI() {
    setEnriching(true)
    await fetch(`/api/lead-lists/${id}/enrich`, { method: 'POST' })
    fetchList()
    setEnriching(false)
  }

  if (status === 'loading' || loading) {
    return <div className="p-8 text-center text-gray-400 text-sm">Loading lead list…</div>
  }
  if (!list) return null

  const filteredLeads = list.leads.filter((l) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      l.firstName.toLowerCase().includes(q) ||
      (l.lastName ?? '').toLowerCase().includes(q) ||
      (l.email ?? '').toLowerCase().includes(q) ||
      (l.company ?? '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <Link
          href="/leads"
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-gray-900 dark:text-white truncate">{list.name}</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">{list.leads.length} leads</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-6 py-3 border-b border-gray-100 dark:border-gray-800 flex-shrink-0 flex-wrap">
        {/* Search */}
        <div className="relative min-w-[200px] max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search leads…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-gray-50 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
          />
        </div>

        {/* Filters */}
        <button className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          <SlidersHorizontal className="w-4 h-4" />
          Filters
        </button>

        {/* Create AI Columns */}
        <button className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          <Sparkles className="w-4 h-4 text-purple-500" />
          Create AI Columns
          <ChevronDown className="w-3.5 h-3.5" />
        </button>

        <div className="flex-1" />

        {/* Add leads */}
        <Link
          href={`/leads/${id}/import`}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add leads
          <ChevronDown className="w-3.5 h-3.5" />
        </Link>

        {/* Enrich */}
        <button
          onClick={enrichWithAI}
          disabled={enriching}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors disabled:opacity-60"
        >
          <Sparkles className="w-4 h-4" />
          {enriching ? 'Enriching…' : 'Enrich leads'}
          {!enriching && <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {filteredLeads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
              <span className="text-2xl font-bold text-gray-400">?</span>
            </div>
            <p className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-1">
              {list.leads.length === 0 ? "You don't have any leads" : 'No leads match your search.'}
            </p>
            {list.leads.length === 0 && (
              <Link
                href={`/leads/${id}/import`}
                className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Import new leads
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-white dark:bg-gray-900 z-10">
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="w-10 px-4 py-3 text-left">
                  <input type="checkbox" className="rounded border-gray-300 text-blue-600" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Email
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Company
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  LinkedIn
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  AI Opener
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map((lead) => {
                const fullName = `${lead.firstName} ${lead.lastName ?? ''}`.trim()
                const s = STATUS_STYLES[lead.status] ?? STATUS_STYLES.pending
                return (
                  <tr key={lead.id} className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group">
                    <td className="px-4 py-3">
                      <input type="checkbox" className="rounded border-gray-300 text-blue-600" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <LeadAvatar name={fullName} />
                        <div>
                          <button
                            type="button"
                            onClick={() => setActiveLeadId(lead.id)}
                            className="font-medium text-gray-900 dark:text-white hover:text-blue-600 cursor-pointer text-left"
                          >
                            {fullName}
                          </button>
                          {lead.headline && (
                            <p className="text-xs text-gray-400 truncate max-w-[180px]">{lead.headline}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {lead.email ? (
                        <div className="flex items-center gap-1.5">
                          <span className="truncate max-w-[160px]">{lead.email}</span>
                          {verifyResults[lead.id] ? (
                            verifyResults[lead.id].status === 'valid' ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" aria-label="Valid" />
                            ) : verifyResults[lead.id].status === 'invalid' ? (
                              <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" aria-label="Invalid" />
                            ) : (
                              <HelpCircle className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" aria-label="Unknown" />
                            )
                          ) : verifyErrors[lead.id] ? (
                            <span title={verifyErrors[lead.id]} className="flex-shrink-0"><XCircle className="w-3.5 h-3.5 text-red-400" aria-label={verifyErrors[lead.id]} /></span>
                          ) : (
                            <button
                              onClick={() => verifyEmail(lead.id, lead.email!)}
                              disabled={verifying[lead.id]}
                              className="text-[10px] text-teal-600 hover:text-teal-700 font-medium opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50 flex-shrink-0"
                            >
                              {verifying[lead.id] ? '…' : 'Verify'}
                            </button>
                          )}
                        </div>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{lead.company ?? '—'}</td>
                    <td className="px-4 py-3">
                      {lead.linkedinUrl ? (
                        <a
                          href={lead.linkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 text-xs font-medium"
                        >
                          View <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`chip ${s.bg} inline-flex items-center gap-1`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                        {lead.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-[220px]">
                      {lead.aiOpener ? (
                        <p className="text-xs text-gray-600 dark:text-gray-400 truncate" title={lead.aiOpener}>
                          {lead.aiOpener}
                        </p>
                      ) : (
                        <span className="text-xs text-gray-300 italic">Not enriched</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Footer row count */}
      {filteredLeads.length > 0 && (
        <div className="px-6 py-2 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex-shrink-0">
          <p className="text-xs text-gray-400">
            1 – {filteredLeads.length} of {filteredLeads.length}
          </p>
        </div>
      )}

      {/* Per-lead Activity drawer */}
      {activeLeadId && (() => {
        const lead = list.leads.find((l) => l.id === activeLeadId)
        const fullName = lead ? `${lead.firstName} ${lead.lastName ?? ''}`.trim() : ''
        return (
          <>
            <div
              onClick={() => setActiveLeadId(null)}
              className="fixed inset-0 bg-black/30 z-30"
            />
            <aside className="fixed top-0 right-0 h-full w-full sm:w-[460px] bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 z-40 flex flex-col shadow-xl">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-gray-900 dark:text-white truncate">{fullName || 'Lead'}</h2>
                  <p className="text-xs text-gray-500 truncate">{lead?.email ?? lead?.headline ?? 'Activity timeline'}</p>
                </div>
                <button
                  onClick={() => setActiveLeadId(null)}
                  className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {lead && (
                  <>
                    {/* Lead Details Edit Form */}
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Details</h3>
                        {editingLeadId === lead.id ? (
                          <button
                            onClick={() => setEditingLeadId(null)}
                            className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                          >
                            Cancel
                          </button>
                        ) : (
                          <button
                            onClick={() => setEditingLeadId(lead.id)}
                            className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                          >
                            Edit
                          </button>
                        )}
                      </div>
                      {editingLeadId === lead.id ? (
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              placeholder="First name"
                              value={editForm.firstName}
                              onChange={(e) => setEditForm(f => ({ ...f, firstName: e.target.value }))}
                              className="text-xs px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                            <input
                              type="text"
                              placeholder="Last name"
                              value={editForm.lastName}
                              onChange={(e) => setEditForm(f => ({ ...f, lastName: e.target.value }))}
                              className="text-xs px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                          </div>
                          <input
                            type="email"
                            placeholder="Email"
                            value={editForm.email}
                            onChange={(e) => setEditForm(f => ({ ...f, email: e.target.value }))}
                            className="w-full text-xs px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                          <input
                            type="text"
                            placeholder="Company"
                            value={editForm.company}
                            onChange={(e) => setEditForm(f => ({ ...f, company: e.target.value }))}
                            className="w-full text-xs px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                          <input
                            type="url"
                            placeholder="LinkedIn URL"
                            value={editForm.linkedinUrl}
                            onChange={(e) => setEditForm(f => ({ ...f, linkedinUrl: e.target.value }))}
                            className="w-full text-xs px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                          <input
                            type="text"
                            placeholder="Headline / Job Title"
                            value={editForm.headline}
                            onChange={(e) => setEditForm(f => ({ ...f, headline: e.target.value }))}
                            className="w-full text-xs px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                          <button
                            onClick={saveLead}
                            disabled={editSaving}
                            className="w-full text-xs px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium rounded-md transition-colors"
                          >
                            {editSaving ? 'Saving…' : 'Save'}
                          </button>
                        </div>
                      ) : (
                        <dl className="space-y-2 text-xs">
                          <div>
                            <dt className="text-gray-500 dark:text-gray-400">Email</dt>
                            <dd className="text-gray-900 dark:text-white break-all">{lead.email || '—'}</dd>
                          </div>
                          <div>
                            <dt className="text-gray-500 dark:text-gray-400">Company</dt>
                            <dd className="text-gray-900 dark:text-white">{lead.company || '—'}</dd>
                          </div>
                          <div>
                            <dt className="text-gray-500 dark:text-gray-400">Title</dt>
                            <dd className="text-gray-900 dark:text-white">{lead.headline || '—'}</dd>
                          </div>
                          {lead.linkedinUrl && (
                            <div>
                              <dt className="text-gray-500 dark:text-gray-400">LinkedIn</dt>
                              <dd>
                                <a href={lead.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 break-all">
                                  {lead.linkedinUrl}
                                </a>
                              </dd>
                            </div>
                          )}
                        </dl>
                      )}
                    </div>

                    <CustomFieldsPanel
                      entity="lead"
                      entityId={lead.id}
                      patchUrl={`/api/lead-lists/${id}/leads/${lead.id}`}
                      initialValues={lead.customFields ?? {}}
                      initialAiRuns={(lead.aiColumnRuns ?? {}) as Parameters<typeof CustomFieldsPanel>[0]['initialAiRuns']}
                    />
                  </>
                )}
                {activitiesLoading ? (
                  <div className="py-12 text-center text-sm text-gray-400">Loading activity…</div>
                ) : (
                  <ActivityTimeline
                    activities={activities}
                    onAddNote={addNote}
                    emptyMessage="No activity yet — add a note or wait for the next email/LinkedIn step."
                  />
                )}
              </div>
            </aside>
          </>
        )
      })()}
    </div>
  )
}
