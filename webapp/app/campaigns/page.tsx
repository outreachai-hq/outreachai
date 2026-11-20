'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { HelpPanel } from '@/components/HelpPanel'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Plus,
  Megaphone,
  X,
  List,
  Users,
  Search,
  LayoutGrid,
  LayoutList,
  MessageSquare,
  Rocket,
} from 'lucide-react'

interface Campaign {
  id: string
  name: string
  status: string
  sequenceName: string
  sequenceId: string
  leadListName: string
  leadListId: string
  leadCount: number
  launchedAt: string | null
  createdAt: string
}

type StatusFilter = 'all' | 'active' | 'draft' | 'paused' | 'completed'
type ViewMode = 'grid' | 'list'

const STATUS_STYLES: Record<string, string> = {
  draft:     'chip chip-pending',
  active:    'chip chip-replied',
  paused:    'chip chip-paused',
  completed: 'chip chip-sent',
}

// Left border color per status
const BORDER_COLOR: Record<string, string> = {
  active:    'border-l-green-500',
  draft:     'border-l-gray-300',
  paused:    'border-l-amber-400',
  completed: 'border-l-blue-400',
}

const STATUS_FILTER_LABELS: { key: StatusFilter; label: string }[] = [
  { key: 'all',       label: 'All' },
  { key: 'active',    label: 'Active' },
  { key: 'draft',     label: 'Draft' },
  { key: 'paused',    label: 'Paused' },
  { key: 'completed', label: 'Completed' },
]

function CreateCampaignDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Campaign name is required'); return }
    setSaving(true)
    setError('')
    const res = await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Failed to create campaign')
      setSaving(false)
      return
    }
    const campaign = await res.json()
    onCreated(campaign.id)
    router.push(`/campaigns/${campaign.id}`)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Create campaign</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleCreate}>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Campaign name
          </label>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setError('') }}
            placeholder="e.g. LinkedIn SaaS Outreach - Q2"
            className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
          />
          {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
          <div className="flex gap-3 mt-5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="flex-1 px-4 py-2.5 text-sm font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              {saving ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function formatDate(dateStr: string | null, prefix = '') {
  if (!dateStr) return null
  const d = new Date(dateStr)
  const formatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return prefix ? `${prefix} ${formatted}` : formatted
}

// Derive mock reply count from leadCount (deterministic)
function mockReplies(c: Campaign) {
  return Math.round(c.leadCount * 0.12)
}

export default function CampaignsPage() {
  const { status } = useSession()
  const router = useRouter()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')

  const fetchCampaigns = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/campaigns')
    if (res.ok) {
      const data = await res.json()
      // API returns array directly
      setCampaigns(Array.isArray(data) ? data : (data.campaigns ?? []))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login')
    if (status === 'authenticated') {
      const t = setTimeout(() => fetchCampaigns(), 0)
      return () => clearTimeout(t)
    }
  }, [status, fetchCampaigns, router])

  if (status === 'loading' || loading) {
    return <div className="p-8 text-center text-gray-400 text-sm">Loading campaigns…</div>
  }

  const filtered = campaigns.filter((c) => {
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter
    const matchesSearch = search === '' ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.sequenceName.toLowerCase().includes(search.toLowerCase())
    return matchesStatus && matchesSearch
  })

  return (
    <>
      {showDialog && (
        <CreateCampaignDialog
          onClose={() => setShowDialog(false)}
          onCreated={() => { setShowDialog(false); fetchCampaigns() }}
        />
      )}

      <div className="p-4 md:p-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Campaigns</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage and launch your outreach campaigns.</p>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 border border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                title="Grid view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                title="List view"
              >
                <LayoutList className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={() => setShowDialog(true)}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Create campaign</span>
              <span className="sm:hidden">Create</span>
            </button>
          </div>
        </div>

        {/* Filter toolbar */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          {/* Status filter tabs */}
          <div className="flex gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 max-w-full overflow-x-auto no-scrollbar">
            {STATUS_FILTER_LABELS.map(({ key, label }) => {
              const count = key === 'all' ? campaigns.length : campaigns.filter((c) => c.status === key).length
              return (
                <button
                  key={key}
                  onClick={() => setStatusFilter(key)}
                  className={`flex-shrink-0 whitespace-nowrap px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    statusFilter === key
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                >
                  {label}
                  {count > 0 && (
                    <span className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      statusFilter === key ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400' : 'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400'
                    }`}>{count}</span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search campaigns…"
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {filtered.length !== campaigns.length && (
            <span className="text-xs text-gray-400">
              Showing {filtered.length} of {campaigns.length}
            </span>
          )}
        </div>

        {/* Empty state */}
        {campaigns.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 py-20 text-center">
            <Megaphone className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No campaigns yet. Create your first one.</p>
            <button
              onClick={() => setShowDialog(true)}
              className="mt-4 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create campaign
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 py-12 text-center">
            <Search className="w-8 h-8 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">No campaigns match your filter.</p>
            <button onClick={() => { setStatusFilter('all'); setSearch('') }} className="mt-2 text-xs text-blue-600 hover:underline">Clear filters</button>
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid view */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((c) => {
              const borderColor = BORDER_COLOR[c.status] ?? 'border-l-gray-300'
              const replies = mockReplies(c)
              const launched = formatDate(c.launchedAt, 'Launched')
              return (
                <div
                  key={c.id}
                  className={`bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 border-l-4 ${borderColor} p-5 hover:shadow-md transition-shadow`}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">{c.name}</h3>
                    <span
                      className={`flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                        STATUS_STYLES[c.status] ?? 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {c.status}
                    </span>
                  </div>

                  <div className="space-y-1.5 mb-4">
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <List className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="truncate">{c.sequenceName}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-gray-400" />
                        {c.leadCount} lead{c.leadCount !== 1 ? 's' : ''}
                      </span>
                      <span className="flex items-center gap-1.5" title="Estimated replies">
                        <MessageSquare className="w-3.5 h-3.5 text-gray-400" />
                        ~{replies} repl{replies !== 1 ? 'ies' : 'y'} <span className="text-[10px] text-gray-400">(est.)</span>
                      </span>
                    </div>
                    {launched && c.status === 'active' ? (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                        <Rocket className="w-3 h-3" />
                        {launched}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400">
                        Created {formatDate(c.createdAt)}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
                    <Link
                      href={`/campaigns/${c.id}`}
                      className="flex items-center justify-center gap-1.5 w-full text-xs font-medium text-blue-600 hover:text-blue-700 border border-blue-200 hover:border-blue-300 bg-blue-50 hover:bg-blue-100 rounded-lg py-2 transition-colors"
                    >
                      Open →
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* List / table view */
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Leads</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Replies</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Created</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filtered.map((c) => {
                  const borderColor = BORDER_COLOR[c.status] ?? 'border-l-gray-300'
                  const replies = mockReplies(c)
                  return (
                    <tr key={c.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800 border-l-4 ${borderColor}`}>
                      <td className="px-5 py-3.5 font-medium text-gray-900 dark:text-white">
                        <div>{c.name}</div>
                        <div className="text-[11px] text-gray-400 mt-0.5">{c.sequenceName}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[c.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right text-gray-700 dark:text-gray-300 tabular-nums">{c.leadCount}</td>
                      <td className="px-4 py-3.5 text-right text-gray-700 dark:text-gray-300 tabular-nums" title="Estimated replies">~{replies} <span className="text-[10px] text-gray-400">(est.)</span></td>
                      <td className="px-4 py-3.5 text-xs text-gray-400">{formatDate(c.createdAt)}</td>
                      <td className="px-4 py-3.5">
                        <Link
                          href={`/campaigns/${c.id}`}
                          className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
                        >
                          Open →
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>
      <HelpPanel
        title='Campaigns'
        description='A campaign runs a sequence of outreach steps (LinkedIn + email) automatically against a list of leads.'
        sections={[
        { title: 'How a campaign works', content: 'A campaign pairs a Sequence (the message steps) with a Lead List (who to send to). Once launched, it automatically executes each step for each lead on the schedule you set.', example: '"SaaS Founders Outreach" campaign → 500 leads → runs "LinkedIn + Email sequence" → sends step 1 to each lead on day 1, step 2 on day 4, etc.', tip: 'A campaign is paused by default — review it before launching.' },
        { title: 'Active vs Draft', content: 'Draft = not sending yet. Active = steps are being executed automatically by the background runner every hour. Paused = temporarily stopped.', example: "Set to Active on Monday → by Friday all 500 leads have received step 1, and the ones who haven't replied get step 2 queued.", tip: 'Never launch a campaign without first previewing the sequence messages with real lead data.' },
        { title: 'Campaign stats', content: 'Each campaign shows: Sent (emails delivered), Replied (lead replied to any step), Bounced (email address invalid), In Progress (currently mid-sequence).', example: '200 sent, 18 replied = 9% reply rate. Industry average is 5-8%, so this campaign is performing well.' },
        { title: 'Stopping a campaign', content: 'When a lead replies, OutreachAI auto-stops them from receiving further steps. You can also manually stop individual leads or pause the whole campaign.', example: 'Priya replied on step 2 → she is automatically moved out of the sequence → you can reply from the Inbox.' },
        ]}
      />
    </>
  )
}
