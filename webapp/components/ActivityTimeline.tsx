'use client'

// Plan 4 (Iter 23) — shared, read-only timeline renderer.
//
// Consumes a list of LeadActivity rows (already fetched by the parent — kept
// pure so the same component can render lead, contact, and company feeds).
// Optionally accepts an `onAddNote` callback; when present, shows a tiny
// composer at the top of the feed.

import { useState } from 'react'
import {
  Mail, MousePointerClick, Eye, Reply, Ban, AlertTriangle, Briefcase,
  CheckSquare, StickyNote, Sparkles, Circle, MessageSquare, ArrowRight,
} from 'lucide-react'

export type ActivityRow = {
  id: string
  type: string
  channel: string | null
  title: string
  body: string | null
  occurredAt: string
  payload?: unknown
}

const ICONS: Record<string, { Icon: typeof Mail; tint: string }> = {
  'email.sent':                { Icon: Mail,             tint: 'text-blue-500 bg-blue-50  dark:bg-blue-900/20' },
  'email.opened':              { Icon: Eye,              tint: 'text-sky-500  bg-sky-50   dark:bg-sky-900/20' },
  'email.clicked':             { Icon: MousePointerClick,tint: 'text-violet-500 bg-violet-50 dark:bg-violet-900/20' },
  'email.replied':             { Icon: Reply,            tint: 'text-green-500 bg-green-50 dark:bg-green-900/20' },
  'email.bounced':             { Icon: Ban,              tint: 'text-red-500  bg-red-50   dark:bg-red-900/20' },
  'email.failed':              { Icon: AlertTriangle,    tint: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20' },
  'linkedin.visit_queued':     { Icon: Briefcase,         tint: 'text-blue-500 bg-blue-50  dark:bg-blue-900/20' },
  'linkedin.invite_queued':    { Icon: Briefcase,         tint: 'text-blue-500 bg-blue-50  dark:bg-blue-900/20' },
  'linkedin.message_queued':   { Icon: Briefcase,         tint: 'text-blue-500 bg-blue-50  dark:bg-blue-900/20' },
  'linkedin.visit_done':       { Icon: Briefcase,         tint: 'text-green-500 bg-green-50 dark:bg-green-900/20' },
  'linkedin.invite_sent':      { Icon: Briefcase,         tint: 'text-green-500 bg-green-50 dark:bg-green-900/20' },
  'linkedin.message_sent':     { Icon: Briefcase,         tint: 'text-green-500 bg-green-50 dark:bg-green-900/20' },
  'linkedin.message_received': { Icon: MessageSquare,    tint: 'text-green-500 bg-green-50 dark:bg-green-900/20' },
  'task.created':              { Icon: CheckSquare,      tint: 'text-orange-500 bg-orange-50 dark:bg-orange-900/20' },
  'task.completed':            { Icon: CheckSquare,      tint: 'text-green-500 bg-green-50 dark:bg-green-900/20' },
  'note.added':                { Icon: StickyNote,       tint: 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20' },
  'status.changed':            { Icon: ArrowRight,       tint: 'text-gray-500 bg-gray-100  dark:bg-gray-800' },
  'enrichment.completed':      { Icon: Sparkles,         tint: 'text-purple-500 bg-purple-50 dark:bg-purple-900/20' },
}

function relativeTime(iso: string): string {
  const d = new Date(iso).getTime()
  const diff = Date.now() - d
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function ActivityTimeline({
  activities,
  onAddNote,
  emptyMessage = 'No activity yet.',
}: {
  activities: ActivityRow[]
  onAddNote?: (body: string) => Promise<void>
  emptyMessage?: string
}) {
  const [note, setNote] = useState('')
  const [posting, setPosting] = useState(false)

  async function submit() {
    if (!onAddNote || !note.trim() || posting) return
    setPosting(true)
    try {
      await onAddNote(note.trim())
      setNote('')
    } finally {
      setPosting(false)
    }
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 md:p-5">
      {onAddNote && (
        <div className="mb-5 pb-5 border-b border-gray-100 dark:border-gray-800">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note about this lead…"
            rows={2}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none"
          />
          <div className="flex justify-end mt-2">
            <button
              onClick={submit}
              disabled={!note.trim() || posting}
              className="text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg px-3 py-1.5"
            >
              {posting ? 'Adding…' : 'Add note'}
            </button>
          </div>
        </div>
      )}

      {activities.length === 0 ? (
        <div className="py-10 text-center text-sm text-gray-400">{emptyMessage}</div>
      ) : (
        <ol className="space-y-3">
          {activities.map((a) => {
            const meta = ICONS[a.type] ?? { Icon: Circle, tint: 'text-gray-400 bg-gray-100 dark:bg-gray-800' }
            const { Icon, tint } = meta
            return (
              <li key={a.id} className="flex gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${tint}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{a.title}</p>
                    <span className="text-xs text-gray-400 flex-shrink-0">{relativeTime(a.occurredAt)}</span>
                  </div>
                  {a.body && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 whitespace-pre-wrap line-clamp-3">{a.body}</p>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
