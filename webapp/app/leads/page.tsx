'use client'

import { useState, useEffect, useCallback } from 'react'
import { HelpPanel } from '@/components/HelpPanel'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Users, X, Check, Trash2 } from 'lucide-react'

interface LeadList {
  id: string
  name: string
  leadCount: number
  createdAt: string
}

export default function LeadsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [lists, setLists] = useState<LeadList[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formName, setFormName] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchLists = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/lead-lists')
    if (res.ok) setLists(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login')
    if (status === 'authenticated') {
      const t = setTimeout(() => fetchLists(), 0)
      return () => clearTimeout(t)
    }
  }, [status, fetchLists, router])

  async function createList(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/lead-lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: formName }),
    })
    if (res.ok) {
      setShowForm(false)
      setFormName('')
      fetchLists()
    }
    setSaving(false)
  }

  async function deleteList(id: string) {
    if (!confirm('Delete this lead list and all its leads?')) return
    await fetch(`/api/lead-lists/${id}`, { method: 'DELETE' })
    setLists((prev) => prev.filter((l) => l.id !== id))
  }

  if (status === 'loading' || loading) {
    return <div className="p-8 text-center text-gray-400 text-sm">Loading lead lists…</div>
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Lead Lists</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage your prospect lists for campaigns.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          New List
        </button>
      </div>

      {/* New List inline form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-blue-200 shadow-sm p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">New Lead List</h2>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={createList} className="flex items-center gap-3">
            <input
              type="text"
              required
              autoFocus
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. SaaS Founders Batch 1"
              className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent dark:bg-gray-800 dark:border-gray-700 dark:text-white"
            />
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              <Check className="w-4 h-4" />
              {saving ? 'Creating…' : 'Create'}
            </button>
          </form>
        </div>
      )}

      {/* Lists grid */}
      {lists.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 py-16 text-center">
          <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">No lead lists yet.</p>
          <p className="text-xs text-gray-400 mt-1">Create a list to start adding and importing leads.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {lists.map((l) => (
            <div key={l.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between gap-2 mb-4">
                <div className="flex items-center gap-2 min-w-0">
                  <Users className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{l.name}</h3>
                </div>
                <button
                  onClick={() => deleteList(l.id)}
                  className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                  title="Delete list"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-4 mb-4">
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{l.leadCount}</p>
                  <p className="text-xs text-gray-400">leads</p>
                </div>
              </div>

              <p className="text-xs text-gray-400 mb-4">
                Created {new Date(l.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>

              <div className="flex items-center gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                <Link
                  href={`/leads/${l.id}`}
                  className="flex-1 text-center text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-gray-700 rounded-lg py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  View Leads
                </Link>
                <Link
                  href={`/leads/${l.id}?import=1`}
                  className="flex-1 text-center text-xs font-medium bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg py-1.5 transition-colors"
                >
                  Import CSV
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
      <HelpPanel
        title='Lead Lists'
        description='Organised groups of leads that are assigned to campaigns. Think of them as the "audience" for each campaign.'
        sections={[
        { title: 'What is a Lead List?', content: 'A lead list is a named group of people who will receive a specific campaign. One lead list can be reused across multiple campaigns, but is usually paired 1:1.', example: '"SaaS Founders India Q3" lead list → 300 people → assigned to "SaaS Founders Outreach" campaign.', tip: 'Keep lists focused and named clearly. "Founders Q3" is better than "List 1".' },
        { title: 'Importing leads', content: 'Click + New List → import CSV or use the Chrome Extension. CSV columns: firstName, lastName, linkedinUrl, email, company, phone.', example: 'Search "VP Sales India" on LinkedIn → use the Chrome Extension to scrape the profiles → they land in a new Lead List automatically.', tip: 'Always import a small test batch (20-30 leads) first to verify message quality before running at full scale.' },
        { title: 'Lead status in a campaign', content: 'Pending = waiting to be contacted. In Progress = mid-sequence. Replied = replied to a step. Completed = all steps done. Bounced = email invalid.', example: '500 leads imported. 200 In Progress (actively receiving steps). 45 Replied (in conversation in Inbox). 255 Pending (not yet reached).', tip: 'Check Bounced leads — a high bounce rate means your lead source has bad data.' },
        { title: 'Deduplication', content: 'OutreachAI skips leads whose email is on the unsubscribe list or who are already in an active campaign. This prevents messaging someone twice.', example: 'Rajesh is already in "Campaign A". You add him to "Campaign B". He is automatically skipped in Campaign B.' },
        ]}
      />
    </div>
  )
}
