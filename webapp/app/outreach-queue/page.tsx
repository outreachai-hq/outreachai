'use client'

// Plan 8 — Outreach Queue. Three-pane: filter sidebar · draft list · editor.
//
// Keyboard shortcuts (skipped when an input/textarea has focus):
//   j / ArrowDown  — next draft
//   k / ArrowUp    — previous
//   a              — approve + send
//   r              — reject
//   e              — focus body editor

import { useEffect, useState, useCallback, useRef } from 'react'
import { HelpPanel } from '@/components/HelpPanel'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  ListOrdered, X as XIcon, Send, Calendar, Loader2,
  Mail, MessageSquare, Sparkles, AlertCircle, Link2,
} from 'lucide-react'

type Draft = {
  id:           string
  channel:      'email' | 'linkedin' | 'sms'
  subject:      string | null
  body:         string
  conversationId: string | null
  leadId:       string | null
  contactId:    string | null
  campaignId:   string | null
  status:       'pending' | 'edited' | 'approved' | 'sent' | 'rejected' | 'expired'
  scheduledFor: string | null
  source:       string
  createdByAi:  boolean
  priority:     number
  createdAt:    string
  updatedAt:    string
}

const STATUS_TABS: Array<{ key: string; label: string }> = [
  { key: 'open',     label: 'Pending'   },  // server default = pending + edited
  { key: 'sent',     label: 'Sent'      },
  { key: 'rejected', label: 'Rejected'  },
]

function channelIcon(c: Draft['channel']) {
  if (c === 'email')    return <Mail className="w-3.5 h-3.5" />
  if (c === 'linkedin') return <Link2 className="w-3.5 h-3.5" />
  return <MessageSquare className="w-3.5 h-3.5" />
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function OutreachQueuePage() {
  const { status } = useSession()
  const router = useRouter()

  const [statusFilter, setStatusFilter]   = useState<string>('open')
  const [channelFilter, setChannelFilter] = useState<string>('')
  const [drafts, setDrafts]               = useState<Draft[]>([])
  const [loading, setLoading]             = useState(true)
  const [selectedId, setSelectedId]       = useState<string | null>(null)
  const [editingBody, setEditingBody]     = useState('')
  const [editingSubject, setEditingSubject] = useState('')
  const [acting, setActing]               = useState(false)
  const [error, setError]                 = useState<string | null>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login')
  }, [status, router])

  const fetchList = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (statusFilter !== 'open') params.set('status', statusFilter)
    if (channelFilter)           params.set('channel', channelFilter)
    const res = await fetch(`/api/drafts?${params}`)
    if (!res.ok) { setLoading(false); return }
    const { drafts: rows } = await res.json()
    setDrafts(rows ?? [])
    setLoading(false)
  }, [statusFilter, channelFilter])

  useEffect(() => { if (status === 'authenticated') fetchList() }, [status, fetchList])

  useEffect(() => {
    if (drafts.length === 0) { setSelectedId(null); return }
    if (!drafts.some((d) => d.id === selectedId)) setSelectedId(drafts[0].id)
  }, [drafts, selectedId])

  const selected = drafts.find((d) => d.id === selectedId) ?? null

  useEffect(() => {
    setEditingBody(selected?.body ?? '')
    setEditingSubject(selected?.subject ?? '')
    setError(null)
  }, [selectedId, selected?.body, selected?.subject])

  async function persistEdits() {
    if (!selected) return
    if (editingBody === selected.body && editingSubject === (selected.subject ?? '')) return
    const res = await fetch(`/api/drafts/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: editingBody, subject: editingSubject || null }),
    })
    if (res.ok) {
      const { draft } = await res.json()
      setDrafts((prev) => prev.map((d) => (d.id === draft.id ? draft : d)))
    }
  }

  const approve = useCallback(async () => {
    if (!selected || acting) return
    setActing(true); setError(null)
    await persistEdits()
    const res = await fetch(`/api/drafts/${selected.id}/approve-send`, { method: 'POST' })
    setActing(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? `Send failed (${res.status})`)
      return
    }
    setDrafts((prev) => prev.filter((d) => d.id !== selected.id))
  }, [selected, acting])

  const reject = useCallback(async () => {
    if (!selected || acting) return
    setActing(true); setError(null)
    const res = await fetch(`/api/drafts/${selected.id}/reject`, { method: 'POST' })
    setActing(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Reject failed')
      return
    }
    setDrafts((prev) => prev.filter((d) => d.id !== selected.id))
  }, [selected, acting])

  async function schedule() {
    if (!selected) return
    const raw = prompt('Schedule send for when? (datetime — e.g. 2026-12-25T09:30)')
    if (!raw) return
    const iso = new Date(raw).toISOString()
    const res = await fetch(`/api/drafts/${selected.id}/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduledFor: iso }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Schedule failed')
    } else {
      fetchList()
    }
  }

  // Keyboard nav — listen on document; skip when an input/textarea is focused
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
      const ids = drafts.map((d) => d.id)
      const i = selectedId ? ids.indexOf(selectedId) : -1
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault()
        if (i < ids.length - 1) setSelectedId(ids[i + 1])
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault()
        if (i > 0) setSelectedId(ids[i - 1])
      } else if (e.key === 'a') { e.preventDefault(); approve() }
      else if   (e.key === 'r') { e.preventDefault(); reject() }
      else if   (e.key === 'e') { e.preventDefault(); bodyRef.current?.focus() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drafts, selectedId, approve, reject])

  return (
    <div className="flex h-screen bg-white dark:bg-gray-950">
      {/* ── Filter sidebar ── */}
      <aside className="w-48 flex-shrink-0 border-r border-gray-200 dark:border-gray-800 p-4 bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center gap-2 mb-4">
          <ListOrdered className="w-4 h-4 text-blue-600" />
          <h1 className="text-sm font-bold text-gray-900 dark:text-white">Outreach Queue</h1>
        </div>
        <nav className="space-y-0.5 mb-6">
          {STATUS_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setStatusFilter(t.key)}
              className={`w-full text-left px-2.5 py-1.5 text-sm font-medium rounded-md transition-colors ${
                statusFilter === t.key
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-2">Channel</p>
        <div className="flex flex-col gap-1">
          {[
            { key: '',         label: 'All'      },
            { key: 'email',    label: 'Email'    },
            { key: 'linkedin', label: 'LinkedIn' },
          ].map((c) => (
            <button
              key={c.key}
              onClick={() => setChannelFilter(c.key)}
              className={`text-left px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                channelFilter === c.key
                  ? 'bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-white'
                  : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-gray-400 mt-8 leading-relaxed">
          <kbd className="font-mono">j / k</kbd> nav · <kbd className="font-mono">a</kbd> send ·{' '}
          <kbd className="font-mono">r</kbd> reject · <kbd className="font-mono">e</kbd> edit
        </p>
      </aside>

      {/* ── Draft list ── */}
      <div className="w-80 flex-shrink-0 border-r border-gray-200 dark:border-gray-800 overflow-y-auto">
        {loading ? (
          <div className="p-4 space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : drafts.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">
            No drafts {statusFilter === 'open' ? 'waiting for review' : `in "${statusFilter}"`}.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {drafts.map((d) => {
              const isSel = d.id === selectedId
              return (
                <li key={d.id}>
                  <button
                    onClick={() => setSelectedId(d.id)}
                    className={`w-full text-left px-4 py-3 transition-colors ${
                      isSel
                        ? 'bg-blue-50 dark:bg-blue-950/30 border-l-2 border-blue-600'
                        : 'border-l-2 border-transparent hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-gray-400">{channelIcon(d.channel)}</span>
                      {d.createdByAi && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-violet-700 dark:text-violet-200 bg-violet-100 dark:bg-violet-900/40 px-1.5 py-0.5 rounded">
                          <Sparkles className="w-2.5 h-2.5" /> AI
                        </span>
                      )}
                      {d.status === 'edited' && (
                        <span className="text-[10px] text-amber-600 font-medium">edited</span>
                      )}
                      {d.scheduledFor && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-blue-700 dark:text-blue-200">
                          <Calendar className="w-2.5 h-2.5" /> scheduled
                        </span>
                      )}
                      <span className="ml-auto text-[10px] text-gray-400">{timeAgo(d.createdAt)}</span>
                    </div>
                    {d.subject && (
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{d.subject}</p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{d.body}</p>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* ── Editor pane ── */}
      <div className="flex-1 overflow-y-auto flex flex-col">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
            Select a draft from the list.
          </div>
        ) : (
          <>
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400">
                  {selected.source === 'ai'              && 'AI auto-draft'}
                  {selected.source === 'sequence_manual' && 'Sequence manual step'}
                  {selected.source === 'manual_draft'    && 'Manual draft'}
                  {' · '}{selected.channel}
                  {selected.scheduledFor && ` · scheduled for ${new Date(selected.scheduledFor).toLocaleString()}`}
                </p>
                <h2 className="text-base font-bold text-gray-900 dark:text-white mt-1">
                  {selected.subject ?? '(no subject)'}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={schedule}
                  disabled={acting || selected.status === 'sent' || selected.status === 'rejected'}
                  className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded px-2.5 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
                >
                  <Calendar className="w-3.5 h-3.5" /> Schedule
                </button>
                <button
                  onClick={reject}
                  disabled={acting || selected.status === 'sent' || selected.status === 'rejected'}
                  className="inline-flex items-center gap-1 text-xs font-medium text-red-700 border border-red-200 dark:border-red-800 rounded px-2.5 py-1.5 hover:bg-red-50 dark:hover:bg-red-950 disabled:opacity-50"
                >
                  <XIcon className="w-3.5 h-3.5" /> Reject
                </button>
                <button
                  onClick={approve}
                  disabled={acting || selected.status === 'sent' || selected.status === 'rejected'}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded px-3 py-1.5 disabled:opacity-50"
                >
                  {acting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Approve &amp; send
                </button>
              </div>
            </div>

            {selected.channel === 'email' && (
              <div className="px-6 py-3 border-b border-gray-100 dark:border-gray-800">
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  value={editingSubject}
                  onChange={(e) => setEditingSubject(e.target.value)}
                  onBlur={persistEdits}
                  className="w-full px-2 py-1 text-sm border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            )}

            <div className="flex-1 px-6 py-4 flex flex-col">
              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                Body
              </label>
              <textarea
                ref={bodyRef}
                value={editingBody}
                onChange={(e) => setEditingBody(e.target.value)}
                onBlur={persistEdits}
                className="flex-1 w-full px-3 py-2 text-sm font-sans border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none"
              />
              {error && (
                <p className="mt-2 text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" /> {error}
                </p>
              )}
              <p className="mt-2 text-[10px] text-gray-400">
                Edits save automatically when you click out of the field.
              </p>
            </div>
          </>
        )}
      </div>
      <HelpPanel
        title='Outreach Queue'
        description='LinkedIn actions waiting to be delivered by the Chrome extension. The extension executes these one by one when you open LinkedIn.'
        sections={[
        { title: 'Why a queue?', content: "LinkedIn doesn't have an API for sending messages — only the Chrome extension can do it by simulating what a human does in the browser. Actions queue up here until you open LinkedIn.", example: '50 connection requests queued. You open LinkedIn with the extension → it sends 10 per session automatically (safe limit) → 40 remaining.', tip: 'You must have the Chrome extension installed and be logged into LinkedIn for the queue to execute.' },
        { title: 'Safe sending limits', content: "LinkedIn flags accounts that send too many connection requests in one day. The extension sends at a human pace (5-10 per session, with pauses) to stay under LinkedIn's radar.", example: "Don't try to send 100 connections in one day. LinkedIn may temporarily restrict your account. 20-30/day is safe for new accounts, up to 50/day for established ones." },
        { title: 'Queue priority', content: "Actions execute in the order they were created. Connection requests go first, then messages to accepted connections. You can't reply to someone before they've accepted.", example: 'Anjali\'s connection request was sent Monday. She accepts Tuesday. The message "Hi Anjali, thanks for connecting..." executes when you open LinkedIn on Wednesday.' },
        { title: 'Failed actions', content: 'Actions fail if the person has changed their URL, restricted their profile, or if LinkedIn throttled your account. Failed actions appear in red and can be retried.', example: 'LinkedIn restricts your account for 24h (sent too many requests). Queue shows 40 failed. You retry after the restriction is lifted.', tip: 'If you see many failures at once, check if LinkedIn has shown you any warning banners on your account.' },
        ]}
      />
    </div>
  )
}
