'use client'

import { useEffect, useState, useCallback } from 'react'
import { Activity as ActivityIcon, RefreshCw } from 'lucide-react'
import { ActivityTimeline, type ActivityRow } from '@/components/ActivityTimeline'

const FILTERS: Array<{ label: string; value: string }> = [
  { label: 'All',      value: ''        },
  { label: 'Sent',     value: 'sent'    },
  { label: 'Replied',  value: 'replied' },
  { label: 'Notes',    value: 'notes'   },
  { label: 'Tasks',    value: 'tasks'   },
]

export default function ActivityPage() {
  const [events, setEvents] = useState<ActivityRow[]>([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)

  const fetchEvents = useCallback(async (family: string, cursor?: string) => {
    const params = new URLSearchParams({ limit: '50' })
    if (family) params.set('family', family)
    if (cursor) params.set('cursor', cursor)
    const res = await fetch(`/api/activities?${params}`)
    if (!res.ok) return { activities: [], nextCursor: null }
    return res.json()
  }, [])

  const reload = useCallback(() => {
    setLoading(true)
    fetchEvents(filter).then((data) => {
      setEvents(data.activities ?? [])
      setNextCursor(data.nextCursor ?? null)
      setLoading(false)
    })
  }, [filter, fetchEvents])

  useEffect(() => { reload() }, [reload])

  async function loadMore() {
    if (!nextCursor) return
    setLoadingMore(true)
    const data = await fetchEvents(filter, nextCursor)
    setEvents((prev) => [...prev, ...(data.activities ?? [])])
    setNextCursor(data.nextCursor ?? null)
    setLoadingMore(false)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <ActivityIcon className="w-5 h-5 text-blue-600" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Activity Feed</h1>
        </div>
        <button
          onClick={reload}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === f.value
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <ActivityTimeline
            activities={events}
            emptyMessage="No activity yet. Start a campaign or message a lead to see events here."
          />
          {nextCursor && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="w-full mt-3 py-2 text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          )}
        </>
      )}
    </div>
  )
}
