'use client'

import { Mail, Link2, MessageSquare } from 'lucide-react'

function icon(channel: string) {
  if (channel === 'email')    return <Mail className="w-3 h-3" />
  if (channel === 'linkedin') return <Link2 className="w-3 h-3" />
  return <MessageSquare className="w-3 h-3" />
}

function timeAgo(iso: string) {
  if (!iso) return ''
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

export function TableRecentReplies({ data }: {
  data: Array<{ id: string; participantName: string; channel: string; lastMessage: string; at: string }>
}) {
  if (!data || data.length === 0) {
    return <p className="text-xs text-gray-400 italic py-6">No replies yet.</p>
  }
  return (
    <ul className="space-y-1.5">
      {data.map((r) => (
        <li key={r.id} className="flex items-start gap-2 text-xs">
          <span className="mt-0.5 text-gray-400 flex-shrink-0">{icon(r.channel)}</span>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-gray-900 dark:text-white truncate">{r.participantName}</p>
            <p className="text-gray-500 dark:text-gray-400 truncate">{r.lastMessage}</p>
          </div>
          <span className="text-gray-400 flex-shrink-0">{timeAgo(r.at)}</span>
        </li>
      ))}
    </ul>
  )
}
