'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Building2, ExternalLink, Trash2, Pencil, Check, X,
  Users, Briefcase, Save, Activity as ActivityIcon,
} from 'lucide-react'
import { ActivityTimeline, type ActivityRow } from '@/components/ActivityTimeline'
import { CustomFieldsPanel } from '@/components/CustomFieldsPanel'
import { AddToPipelineButton } from '@/components/AddToPipelineButton'

interface Contact {
  id: string
  name: string
  headline: string | null
  linkedinUrl: string | null
  status: string
}

interface Lead {
  id: string
  firstName: string
  lastName: string | null
  email: string | null
  headline: string | null
  status: string
  leadListId: string
}

interface Company {
  id: string
  name: string
  domain: string | null
  websiteUrl: string | null
  linkedinUrl: string | null
  industry: string | null
  market: string | null
  type: string | null
  size: string | null
  employeeCount: number | null
  foundedYear: number | null
  city: string | null
  state: string | null
  region: string | null
  country: string | null
  technologies: string[]
  tags: string[]
  notes: string | null
  contactCount: number
  leadCount: number
  lastActivityAt: string | null
  createdAt: string
  contacts: Contact[]
  leads: Lead[]
  customFields?: Record<string, unknown>
  aiColumnRuns?: Record<string, { status?: string; lastRunAt?: string; error?: string | null }>
}

const STATUS_BADGE: Record<string, string> = {
  sent:        'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-200',
  followup:    'bg-yellow-50 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-300',
  replied:     'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-200',
  pending:     'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300',
  in_progress: 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-200',
  completed:   'bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-200',
  bounced:     'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-200',
  failed:      'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300',
}

type Tab = 'overview' | 'contacts' | 'leads' | 'activity'

export default function CompanyDetailPage() {
  const { status } = useSession()
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('overview')
  const [activities, setActivities] = useState<ActivityRow[]>([])
  const [activitiesLoading, setActivitiesLoading] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [draft, setDraft] = useState<Partial<Company>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/companies/${id}`)
    if (res.ok) {
      const d = await res.json()
      setCompany(d.company)
    } else if (res.status === 404) {
      router.replace('/companies')
    }
    setLoading(false)
  }, [id, router])

  useEffect(() => {
    if (status === 'unauthenticated') { router.replace('/login'); return }
    if (status === 'authenticated') load()
  }, [status, load, router])

  useEffect(() => {
    if (tab !== 'activity' || status !== 'authenticated') return
    let cancelled = false
    setActivitiesLoading(true)
    fetch(`/api/companies/${id}/activities`)
      .then((r) => r.ok ? r.json() : { activities: [] })
      .then((d) => { if (!cancelled) setActivities(d.activities ?? []) })
      .finally(() => { if (!cancelled) setActivitiesLoading(false) })
    return () => { cancelled = true }
  }, [tab, id, status])

  function startEdit() {
    if (!company) return
    setDraft({
      name: company.name,
      websiteUrl: company.websiteUrl,
      linkedinUrl: company.linkedinUrl,
      industry: company.industry,
      market: company.market,
      type: company.type,
      size: company.size,
      country: company.country,
      city: company.city,
      notes: company.notes,
    })
    setEditMode(true)
    setSaveError(null)
  }

  async function save() {
    setSaving(true)
    setSaveError(null)
    const res = await fetch(`/api/companies/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    })
    setSaving(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setSaveError(d.error ?? `Save failed (${res.status})`)
    } else {
      setEditMode(false)
      load()
    }
  }

  async function remove() {
    if (!confirm('Delete this company? Its contacts and leads stay but become unaffiliated.')) return
    setDeleting(true)
    const res = await fetch(`/api/companies/${id}`, { method: 'DELETE' })
    setDeleting(false)
    if (res.ok) router.replace('/companies')
  }

  if (loading || !company) {
    return <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-5">
        <Link href="/companies" className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-3">
          <ArrowLeft className="w-4 h-4" />
          Back to companies
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-6 h-6 text-blue-500" />
            </div>
            <div className="min-w-0">
              {editMode ? (
                <input
                  value={draft.name ?? ''}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  className="text-2xl font-bold bg-white dark:bg-gray-900 border border-blue-300 dark:border-blue-600 rounded px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-600 text-gray-900 dark:text-white"
                />
              ) : (
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white break-words">{company.name}</h1>
              )}
              <div className="flex items-center gap-2 mt-1">
                {company.domain && <span className="text-sm text-gray-500 dark:text-gray-400">{company.domain}</span>}
                {company.websiteUrl && (
                  <a href={company.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {editMode ? (
              <>
                <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg px-3 py-1.5">
                  <Save className="w-3.5 h-3.5" />
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button onClick={() => { setEditMode(false); setSaveError(null) }} className="text-sm font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5">
                  Cancel
                </button>
              </>
            ) : (
              <>
                <AddToPipelineButton companyId={company.id} contactName={company.name} />
                <button onClick={startEdit} className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg px-3 py-1.5">
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </button>
                <button onClick={remove} disabled={deleting} className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600 hover:text-red-700 border border-red-200 hover:bg-red-50 rounded-lg px-3 py-1.5 disabled:opacity-50">
                  <Trash2 className="w-3.5 h-3.5" />
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              </>
            )}
          </div>
        </div>
        {saveError && <p className="text-xs text-red-600 mt-2">{saveError}</p>}
      </div>

      {/* Aggregate strip */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Contacts</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1 tabular-nums">{company.contactCount}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Leads</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1 tabular-nums">{company.leadCount}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Last activity</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-white mt-2">
            {company.lastActivityAt ? new Date(company.lastActivityAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 mb-5">
        {(['overview', 'contacts', 'leads', 'activity'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? 'border-blue-600 text-blue-700 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {t === 'overview'  ? 'Overview'
             : t === 'contacts' ? `Contacts (${company.contactCount})`
             : t === 'leads'    ? `Leads (${company.leadCount})`
             :                    'Activity'}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div className="space-y-4">
        <CustomFieldsPanel
          entity="company"
          entityId={company.id}
          patchUrl={`/api/companies/${company.id}`}
          initialValues={company.customFields ?? {}}
          initialAiRuns={(company.aiColumnRuns ?? {}) as Parameters<typeof CustomFieldsPanel>[0]['initialAiRuns']}
          onChange={load}
        />
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Industry" value={company.industry} editMode={editMode} draft={draft} setDraft={setDraft} field="industry" />
            <Field label="Size"     value={company.size}     editMode={editMode} draft={draft} setDraft={setDraft} field="size"     placeholder="11-50" />
            <Field label="Country"  value={company.country}  editMode={editMode} draft={draft} setDraft={setDraft} field="country"  placeholder="US" />
            <Field label="City"     value={company.city}     editMode={editMode} draft={draft} setDraft={setDraft} field="city" />
            <Field label="Market"   value={company.market}   editMode={editMode} draft={draft} setDraft={setDraft} field="market"   placeholder="B2B" />
            <Field label="Type"     value={company.type}     editMode={editMode} draft={draft} setDraft={setDraft} field="type"     placeholder="Public" />
            <Field label="Website"   value={company.websiteUrl}   editMode={editMode} draft={draft} setDraft={setDraft} field="websiteUrl"   placeholder="https://…" />
            <Field label="LinkedIn"  value={company.linkedinUrl}  editMode={editMode} draft={draft} setDraft={setDraft} field="linkedinUrl" placeholder="https://linkedin.com/company/…" />
          </div>
          <div className="mt-5">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Notes</p>
            {editMode ? (
              <textarea
                rows={4}
                value={draft.notes ?? ''}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none"
              />
            ) : (
              <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{company.notes || <span className="text-gray-400">No notes yet.</span>}</p>
            )}
          </div>
        </div>
        </div>
      )}

      {/* Contacts list */}
      {tab === 'contacts' && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {company.contacts.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">
              <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              No contacts linked to this company yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  <th className="px-4 py-2.5">Name</th>
                  <th className="px-4 py-2.5">Headline</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {company.contacts.map((c) => (
                  <tr key={c.id} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{c.name}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 truncate max-w-md">{c.headline ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${STATUS_BADGE[c.status] ?? 'bg-gray-100 text-gray-600'}`}>{c.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {c.linkedinUrl && (
                        <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-xs text-blue-600 hover:underline">
                          LinkedIn <ExternalLink className="w-3 h-3 ml-1" />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      )}

      {/* Activity feed (rolled up across all contacts + leads at this company) */}
      {tab === 'activity' && (
        activitiesLoading ? (
          <div className="py-12 text-center text-sm text-gray-400">
            <ActivityIcon className="w-8 h-8 mx-auto mb-2 text-gray-300 animate-pulse" />
            Loading activity…
          </div>
        ) : (
          <ActivityTimeline
            activities={activities}
            emptyMessage="No activity recorded for this account yet."
          />
        )
      )}

      {/* Leads list */}
      {tab === 'leads' && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {company.leads.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">
              <Briefcase className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              No leads linked to this company yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  <th className="px-4 py-2.5">Name</th>
                  <th className="px-4 py-2.5">Email</th>
                  <th className="px-4 py-2.5">Headline</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {company.leads.map((l) => (
                  <tr key={l.id} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40">
                    <td className="px-4 py-3">
                      <Link href={`/leads/${l.leadListId}`} className="font-medium text-gray-900 dark:text-white hover:text-blue-600">
                        {l.firstName} {l.lastName ?? ''}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{l.email ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 truncate max-w-md">{l.headline ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${STATUS_BADGE[l.status] ?? 'bg-gray-100 text-gray-600'}`}>{l.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Field({
  label, value, editMode, draft, setDraft, field, placeholder,
}: {
  label: string
  value: string | null
  editMode: boolean
  draft: Partial<Company>
  setDraft: (d: Partial<Company>) => void
  field: keyof Company
  placeholder?: string
}) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      {editMode ? (
        <input
          value={(draft[field] as string) ?? ''}
          onChange={(e) => setDraft({ ...draft, [field]: e.target.value || null })}
          placeholder={placeholder}
          className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
        />
      ) : (
        <p className="text-sm text-gray-700 dark:text-gray-300">{value ?? <span className="text-gray-400">—</span>}</p>
      )}
    </div>
  )
}
