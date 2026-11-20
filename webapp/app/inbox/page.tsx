'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { HelpPanel } from '@/components/HelpPanel'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useSnippetPicker } from '@/components/SnippetPicker'
import {
  RefreshCw,
  MessageSquare,
  ExternalLink,
  Send,
  Sparkles,
  Inbox,
  Mail,
  Search,
  Link2,
  ArrowLeft,
  CheckCheck,
} from 'lucide-react'
import { useAiConfigured } from '@/components/NoAiProviderGate'

// ─── Types ────────────────────────────────────────────────────────────────────

type ChannelFilter = 'all' | 'linkedin' | 'email' | 'whatsapp'
type StatusFilter = 'open' | 'done' | 'all'

interface Message {
  id: string
  direction: 'in' | 'out'
  body: string
  html?: string | null
  externalId?: string | null
  sentAt: string
}

interface ConversationSummary {
  id: string
  channel: 'email' | 'linkedin' | 'sms' | 'whatsapp'
  subject: string | null
  linkedinProfileId: string | null
  emailThreadKey: string | null
  participantName: string
  participantEmail: string | null
  participantUrl: string | null
  avatarUrl: string | null
  status: string
  unread: boolean
  labels: string[]
  lastMessageAt: string | null
  lastSenderIsMe: boolean
  syncedAt: string
  messages?: Message[] // last 1 from list, full when fetched by detail
}

const AVATAR_COLORS = [
  'bg-blue-500',
  'bg-violet-500',
  'bg-rose-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-cyan-500',
]

// Fallback used only during the brief moment before the labels API returns —
// keeps the chip row from popping in empty on first render.
const FALLBACK_LABELS: { key: string; label: string; color: string }[] = [
  { key: 'interested',     label: 'Interested',     color: '#10b981' },
  { key: 'not_interested', label: 'Not interested', color: '#ef4444' },
  { key: 'out_of_office',  label: 'OOO',            color: '#f59e0b' },
  { key: 'favorite',       label: 'Favorite',       color: '#3b82f6' },
  { key: 'meeting_booked', label: 'Meeting',        color: '#8b5cf6' },
]

function Avatar({ name, url, color, size = 'md' }: { name: string; url?: string | null; color: string; size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm'
  if (url) return <img src={url} alt={name} className={`${dim} rounded-full object-cover flex-shrink-0`} />
  const initials = name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
  return (
    <div className={`${dim} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 ${color}`}>
      {initials}
    </div>
  )
}

function formatTime(dateStr: string | null) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return d.toLocaleDateString('en-US', { weekday: 'short' })
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function channelLabel(c: ConversationSummary['channel']) {
  if (c === 'linkedin') return 'LinkedIn'
  if (c === 'email') return 'Email'
  if (c === 'whatsapp') return 'WhatsApp'
  return c.toUpperCase()
}

function ChannelBadge({ channel }: { channel: ConversationSummary['channel'] }) {
  if (channel === 'linkedin') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950">
        <Link2 className="w-3 h-3" /> LinkedIn
      </span>
    )
  }
  if (channel === 'whatsapp') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950">
        <MessageSquare className="w-3 h-3" /> WhatsApp
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950">
      <Mail className="w-3 h-3" /> Email
    </span>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InboxPage() {
  const { status } = useSession()
  const router = useRouter()
  const aiConfigured = useAiConfigured()
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [selected, setSelected] = useState<ConversationSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open')
  const [search, setSearch] = useState('')
  const [replyText, setReplyText] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [markingRead, setMarkingRead] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const replyRef = useRef<HTMLTextAreaElement>(null)
  const snippetPicker = useSnippetPicker({ textareaRef: replyRef, value: replyText, onChange: setReplyText })

  // Plan 7 — user-defined labels (built-ins + custom). GET seeds built-ins.
  const [labels, setLabels] = useState<Array<{ key: string; label: string; color: string }>>(FALLBACK_LABELS)
  useEffect(() => {
    fetch('/api/conversation-labels')
      .then((r) => (r.ok ? r.json() : { labels: FALLBACK_LABELS }))
      .then((d) => { if (Array.isArray(d.labels) && d.labels.length > 0) setLabels(d.labels) })
      .catch(() => {})
  }, [])

  const fetchList = useCallback(async () => {
    setLoading(true)
    const url = new URL('/api/conversations', window.location.origin)
    if (channelFilter !== 'all') url.searchParams.set('channel', channelFilter)
    if (statusFilter !== 'open') url.searchParams.set('status', statusFilter)
    if (search.trim()) url.searchParams.set('q', search.trim())
    const res = await fetch(url.toString())
    if (res.ok) {
      const data = await res.json()
      setConversations(data.conversations ?? [])
    }
    setLoading(false)
  }, [channelFilter, statusFilter, search])

  const fetchDetail = useCallback(async (id: string) => {
    const res = await fetch(`/api/conversations/${id}`)
    if (res.ok) {
      const { conversation } = await res.json()
      setSelected(conversation)
    }
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') { router.replace('/login'); return }
    const t = setTimeout(() => fetchList(), 0)
    return () => clearTimeout(t)
  }, [status, fetchList, router])

  useEffect(() => {
    setReplyText('')
    setSendError(null)
  }, [selected?.id])

  const handleSync = useCallback(async () => {
    setSyncing(true)
    await fetchList()
    setSyncing(false)
  }, [fetchList])

  const handleSelect = useCallback(async (conv: ConversationSummary) => {
    setSelected(conv) // optimistic so the right pane swaps instantly
    if (conv.unread) {
      // mark as read
      setConversations((prev) => prev.map((c) => (c.id === conv.id ? { ...c, unread: false } : c)))
      fetch(`/api/conversations/${conv.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unread: false }),
      }).catch(() => {})
    }
    await fetchDetail(conv.id)
  }, [fetchDetail])

  const handleMarkDone = useCallback(async () => {
    if (!selected) return
    setConversations((prev) => prev.filter((c) => c.id !== selected.id))
    setSelected(null)
    fetch(`/api/conversations/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'done' }),
    }).catch(() => {})
  }, [selected])

  const handleMarkAllRead = useCallback(async () => {
    setMarkingRead(true)
    const unread = conversations.filter((c) => c.unread)
    setConversations((prev) => prev.map((c) => ({ ...c, unread: false })))
    await Promise.all(
      unread.map((c) =>
        fetch(`/api/conversations/${c.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ unread: false }),
        }).catch(() => {})
      )
    )
    setMarkingRead(false)
  }, [conversations])

  const bulkPatch = useCallback(async (patch: Record<string, unknown>) => {
    const ids = [...selectedIds]
    setSelectedIds(new Set())
    if (patch.status === 'done') {
      setConversations((prev) => prev.filter((c) => !ids.includes(c.id)))
      if (selected && ids.includes(selected.id)) setSelected(null)
    }
    if (patch.unread === false) {
      setConversations((prev) => prev.map((c) => ids.includes(c.id) ? { ...c, unread: false } : c))
    }
    await Promise.all(ids.map((id) =>
      fetch(`/api/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
    ))
  }, [selectedIds, selected])

  const handleAiSuggest = useCallback(async () => {
    if (!selected) return
    if (aiConfigured === 'missing') { router.push('/settings#ai-providers'); return }
    setAiLoading(true)
    try {
      const lastMessage = selected.messages?.[selected.messages.length - 1]?.body ?? ''
      const res = await fetch('/api/ai/suggest-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantName: selected.participantName,
          lastMessage,
          lastSenderIsMe: selected.lastSenderIsMe,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setReplyText(data.suggestion ?? '')
        replyRef.current?.focus()
      }
    } catch { /* ignore */ }
    setAiLoading(false)
  }, [selected, aiConfigured, router])

  const handleSend = useCallback(async () => {
    if (!replyText.trim() || !selected) return
    setSending(true)
    setSendError(null)
    try {
      const res = await fetch(`/api/conversations/${selected.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: replyText.trim() }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setSendError(data.error ?? `Send failed (${res.status})`)
      } else {
        setReplyText('')
        // Re-fetch detail to pull the new outbound message
        await fetchDetail(selected.id)
        // And refresh the list snapshot
        fetchList()
      }
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'Send failed')
    } finally {
      setSending(false)
    }
  }, [replyText, selected, fetchDetail, fetchList])

  const toggleLabel = useCallback(async (labelKey: string) => {
    if (!selected) return
    const has = selected.labels.includes(labelKey)
    const action = has ? 'removeLabel' : 'addLabel'
    // Optimistic
    setSelected((prev) => prev && ({
      ...prev,
      labels: has ? prev.labels.filter((l) => l !== labelKey) : [...prev.labels, labelKey],
    }))
    setConversations((prev) => prev.map((c) => c.id === selected.id ? {
      ...c,
      labels: has ? c.labels.filter((l) => l !== labelKey) : [...c.labels, labelKey],
    } : c))
    fetch(`/api/conversations/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [action]: labelKey }),
    }).catch(() => {})
  }, [selected])

  if (status === 'loading' || loading) {
    return <div className="p-8 text-center text-gray-400 text-sm">Loading inbox…</div>
  }

  const filtered = conversations.filter((c) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      c.participantName.toLowerCase().includes(q) ||
      (c.participantEmail ?? '').toLowerCase().includes(q) ||
      (c.subject ?? '').toLowerCase().includes(q) ||
      (c.messages?.[0]?.body ?? '').toLowerCase().includes(q)
    )
  })

  const unreadCount = conversations.filter((c) => c.unread).length
  const selectedColor = selected
    ? AVATAR_COLORS[Math.abs(selected.id.split('').reduce((h, ch) => h * 31 + ch.charCodeAt(0), 0)) % AVATAR_COLORS.length]
    : AVATAR_COLORS[0]

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
      {/* Header */}
      <div className="px-4 md:px-6 py-3 md:py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex-shrink-0">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Inbox</h1>
            {unreadCount > 0 && (
              <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">{unreadCount}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleMarkAllRead}
              disabled={markingRead || unreadCount === 0}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
            >
              <span className="hidden sm:inline">Mark all read</span>
              <span className="sm:hidden"><CheckCheck className="w-3.5 h-3.5" /></span>
            </button>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-40"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
        {/* Filters row — scrollable on mobile */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {/* Status filter tabs */}
          <div className="flex gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 flex-shrink-0">
            {(['open', 'done', 'all'] as StatusFilter[]).map((key) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors capitalize whitespace-nowrap ${
                  statusFilter === key
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                {key === 'open' ? 'Open' : key === 'done' ? 'Done' : 'All'}
              </button>
            ))}
          </div>
          {/* Channel filter tabs */}
          <div className="flex gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 flex-shrink-0">
            {([
              { key: 'all' as const,       label: 'All',       Icon: null },
              { key: 'linkedin' as const,  label: 'LinkedIn',  Icon: Link2 },
              { key: 'email' as const,     label: 'Email',     Icon: Mail },
              { key: 'whatsapp' as const,  label: 'WhatsApp',  Icon: MessageSquare },
            ]).map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => setChannelFilter(key)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  channelFilter === key
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                {Icon && <Icon className="w-3 h-3" />}
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Body: 2-column */}
      <div className="flex flex-1 overflow-hidden">
        {/* Conversation list */}
        <div className={`${selected ? 'hidden md:flex' : 'flex'} w-full md:w-[340px] flex-shrink-0 border-r border-gray-200 dark:border-gray-700 flex-col bg-white dark:bg-gray-900 overflow-hidden`}>
          {/* Bulk action bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-950 border-b border-blue-200 dark:border-blue-800 flex-shrink-0">
              <span className="text-xs font-semibold text-blue-700 dark:text-blue-200 mr-1">{selectedIds.size} selected</span>
              <button
                onClick={() => bulkPatch({ unread: false })}
                className="text-xs font-medium text-blue-700 dark:text-blue-200 hover:underline"
              >
                Mark read
              </button>
              <button
                onClick={() => bulkPatch({ status: 'done' })}
                className="text-xs font-medium text-blue-700 dark:text-blue-200 hover:underline"
              >
                Mark done
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="ml-auto text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                Clear
              </button>
            </div>
          )}

          <div className="px-3 py-2.5 border-b border-gray-100 dark:border-gray-800">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search conversations…"
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
                <MessageSquare className="w-8 h-8 text-gray-200 dark:text-gray-700 mb-2" />
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {conversations.length === 0
                    ? channelFilter === 'email'
                      ? 'No email replies yet. Run "Poll replies" on your IMAP-configured mailboxes to sync.'
                      : channelFilter === 'whatsapp'
                      ? 'No WhatsApp messages yet. Leads who reply to your WhatsApp sequence steps will appear here.'
                      : 'No conversations yet. Open LinkedIn messaging to sync.'
                    : 'No conversations match your search.'}
                </p>
              </div>
            ) : (
              <>
                {/* Select all row */}
                <div className="flex items-center gap-2 px-4 py-1.5 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && filtered.every((c) => selectedIds.has(c.id))}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIds(new Set(filtered.map((c) => c.id)))
                      } else {
                        setSelectedIds(new Set())
                      }
                    }}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-600"
                  />
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">Select all</span>
                </div>

                {filtered.map((c, i) => {
                  const color = AVATAR_COLORS[i % AVATAR_COLORS.length]
                  const isSelected = selected?.id === c.id
                  const isChecked = selectedIds.has(c.id)
                  const previewBody = c.messages?.[0]?.body ?? c.subject ?? ''
                  return (
                    <div
                      key={c.id}
                      className={`group w-full flex items-center gap-2 px-3 h-16 text-left transition-colors border-l-2 ${
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-950 border-l-blue-500'
                          : 'border-l-transparent hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      {/* Checkbox */}
                      <div
                        className={`flex-shrink-0 ${isChecked || selectedIds.size > 0 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            e.stopPropagation()
                            setSelectedIds((prev) => {
                              const next = new Set(prev)
                              if (e.target.checked) next.add(c.id)
                              else next.delete(c.id)
                              return next
                            })
                          }}
                          className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-600"
                        />
                      </div>

                      <button
                        className="flex-1 flex items-center gap-2 min-w-0"
                        onClick={() => handleSelect(c)}
                      >
                        <div className="relative flex-shrink-0">
                          <Avatar name={c.participantName} url={c.avatarUrl} color={color} size="sm" />
                          {c.unread && (
                            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-500 rounded-full border border-white dark:border-gray-900" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <span className={`text-xs font-semibold truncate ${c.unread ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                              {c.participantName}
                            </span>
                            <span className="text-[10px] text-gray-400 flex-shrink-0">{formatTime(c.lastMessageAt ?? c.syncedAt)}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <ChannelBadge channel={c.channel} />
                            <p className={`text-[11px] truncate flex-1 ${c.unread ? 'text-gray-700 dark:text-gray-200 font-medium' : 'text-gray-400 dark:text-gray-500'}`}>
                              {c.lastSenderIsMe ? 'You: ' : ''}{previewBody}
                            </p>
                          </div>
                        </div>
                      </button>
                    </div>
                  )
                })}
              </>
            )}
          </div>
        </div>

        {/* Conversation detail */}
        <div className={`${selected ? 'flex' : 'hidden md:flex'} flex-1 flex-col overflow-hidden bg-gray-50 dark:bg-gray-950`}>
          {selected ? (
            <>
              {/* Conversation header */}
              <div className="flex items-center gap-3 px-4 md:px-6 py-3.5 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                <button
                  onClick={() => setSelected(null)}
                  className="md:hidden flex-shrink-0 -ml-1 p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  aria-label="Back to conversations"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <Avatar name={selected.participantName} url={selected.avatarUrl} color={selectedColor} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{selected.participantName}</span>
                    <ChannelBadge channel={selected.channel} />
                    {selected.participantEmail && (
                      <span className="text-[11px] text-gray-400">{selected.participantEmail}</span>
                    )}
                  </div>
                  {selected.subject && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{selected.subject}</p>
                  )}
                </div>
                <button
                  onClick={handleMarkDone}
                  title="Mark as done"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 hover:text-emerald-800 border border-emerald-200 hover:border-emerald-300 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-900 rounded-lg px-3 py-1.5 transition-colors flex-shrink-0"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Done
                </button>
                {selected.participantUrl && selected.channel === 'linkedin' && (
                  <a
                    href={selected.participantUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 border border-blue-200 hover:border-blue-300 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950 dark:border-blue-800 dark:hover:bg-blue-900 rounded-lg px-3 py-1.5 transition-colors flex-shrink-0"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open in LinkedIn
                  </a>
                )}
              </div>

              {/* Label chips */}
              <div className="flex items-center gap-1.5 flex-wrap px-4 md:px-6 py-2 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                {labels.map((l) => {
                  const active = selected.labels.includes(l.key)
                  return (
                    <button
                      key={l.key}
                      onClick={() => toggleLabel(l.key)}
                      style={active ? { backgroundColor: `${l.color}22`, color: l.color, borderColor: `${l.color}55` } : undefined}
                      className={`text-[11px] font-medium px-2 py-0.5 rounded-full border transition-colors ${
                        active
                          ? ''
                          : 'bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      {l.label}
                    </button>
                  )
                })}
              </div>

              {/* Messages timeline */}
              <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-3">
                {(selected.messages ?? []).length === 0 ? (
                  <div className="flex justify-center">
                    <span className="text-[11px] text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-full px-3 py-1">
                      No messages on file yet — sync to see history
                    </span>
                  </div>
                ) : (
                  (selected.messages ?? []).map((m) => (
                    <div key={m.id} className={`flex ${m.direction === 'out' ? 'justify-end' : 'justify-start'} gap-2`}>
                      {m.direction === 'in' && (
                        <Avatar name={selected.participantName} url={selected.avatarUrl} color={selectedColor} size="sm" />
                      )}
                      <div
                        className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
                          m.direction === 'out'
                            ? 'bg-blue-600 text-white rounded-tr-sm'
                            : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-tl-sm'
                        }`}
                      >
                        {m.body}
                        <div className={`mt-1 text-[10px] ${m.direction === 'out' ? 'text-blue-100' : 'text-gray-400'}`}>
                          {formatTime(m.sentAt)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Reply box */}
              <div className="px-4 md:px-6 py-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
                {/* Channel-specific delivery hint */}
                {selected.channel === 'linkedin' ? (
                  <div className="flex items-center gap-2 px-3 py-2 mb-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <Link2 className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                    <p className="text-xs text-blue-700 dark:text-blue-200 font-medium">
                      Queued for the Chrome extension — it will deliver on your next LinkedIn page visit.
                    </p>
                  </div>
                ) : selected.channel === 'email' ? (
                  <div className="flex items-center gap-2 px-3 py-2 mb-3 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                    <Mail className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                    <p className="text-xs text-emerald-700 dark:text-emerald-200 font-medium">
                      Replies send via SMTP through your default mailbox.
                    </p>
                  </div>
                ) : selected.channel === 'whatsapp' ? (
                  <div className="flex items-center gap-2 px-3 py-2 mb-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                    <MessageSquare className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                    <p className="text-xs text-green-700 dark:text-green-200 font-medium">
                      Sends via WhatsApp through your connected mfapis number.
                    </p>
                  </div>
                ) : null}
                <div className="relative">
                  <textarea
                    ref={replyRef}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={snippetPicker.handleKeyDown}
                    placeholder="Write a reply… (type / to insert a snippet)"
                    rows={3}
                    className="w-full px-3 py-2.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none"
                  />
                  {snippetPicker.popover}
                </div>
                {sendError && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{sendError}</p>}
                <div className="flex items-center justify-end mt-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleAiSuggest}
                      disabled={aiLoading || aiConfigured === 'loading'}
                      title={aiConfigured === 'missing' ? 'Add an AI key in Settings to use this' : undefined}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-600 hover:text-violet-700 border border-violet-200 hover:border-violet-300 bg-violet-50 hover:bg-violet-100 dark:bg-violet-950 dark:border-violet-800 dark:text-violet-400 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {aiLoading ? 'Thinking…' : aiConfigured === 'missing' ? 'Setup AI' : 'AI Suggest'}
                    </button>
                    <button
                      onClick={handleSend}
                      disabled={!replyText.trim() || sending}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg px-4 py-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {sending ? 'Sending…' : 'Send'}
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                <Inbox className="w-8 h-8 text-gray-300 dark:text-gray-600" />
              </div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Select a conversation to view messages</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {conversations.length === 0
                  ? 'Sync from LinkedIn or poll email replies to get started'
                  : `${conversations.length} conversation${conversations.length !== 1 ? 's' : ''} available`}
              </p>
            </div>
          )}
        </div>
      </div>
      <HelpPanel
        title='Inbox'
        description='All replies from LinkedIn, email, and WhatsApp in one place. Reply, label, and manage conversations without switching apps.'
        sections={[
        { title: 'Unified inbox', content: "Every reply from every channel appears here — LinkedIn messages, email replies, WhatsApp messages. You don't need to check LinkedIn app or Gmail separately.", example: 'Anjali replies to your LinkedIn message → shows in Inbox under LinkedIn tab. Rajesh replies to your email → shows under Email tab. Both can be replied to from here.', tip: 'Use the "All" tab to see everything at once sorted by time.' },
        { title: 'Replying to messages', content: 'Click a conversation → type your reply → Send. For LinkedIn, it queues for the Chrome extension to deliver. Email sends via SMTP immediately. WhatsApp sends via mfapis.', example: 'Anjali says "Interested, tell me more" on LinkedIn → click her conversation → type "Great! Are you free Thursday at 3pm for a quick call?" → Send → extension delivers it next time you open LinkedIn.' },
        { title: 'Labels and organisation', content: 'Click a label chip (Interested, Not Interested, OOO, Meeting Booked) to categorise conversations. Filter by label to see only interested leads.', example: 'Mark Anjali as "Interested" after she agrees to a call. Filter by Interested → you see all warm leads in one view.', tip: 'Labelling is how you build your pipeline. Every "Interested" label should become a CRM deal.' },
        { title: 'Mark as Done', content: 'Click "Done" to archive a conversation. It moves to the Done tab and stops showing in Open. Does not delete anything.', example: 'Rajesh says "Not the right time" → label as Not Interested → Mark Done → removed from your active view.', tip: 'Review Done conversations monthly — "Not the right time" leads from 3 months ago are worth following up again.' },
        ]}
      />
    </div>
  )
}
