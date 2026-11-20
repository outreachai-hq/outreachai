'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { Calendar, Loader2 } from 'lucide-react'
import { TimePicker, LinkedInBanner, DayRow, tzShort } from './components'
import type { DaySlot, ScheduledPost } from './components'

// ---- helpers ---------------------------------------------------------------

function toDateKey(d: Date) { return d.toISOString().slice(0, 10) }

interface LinkedInStatus {
  configured: boolean
  connected: boolean
  account: { name: string; scope: string; tokenExpiry: string } | null
}

// ---- OAuth connected toast (reads ?connected=true) -------------------------

function ConnectedToast() {
  const params   = useSearchParams()
  const [show, setShow] = useState(params.get('connected') === 'true')

  useEffect(() => {
    if (!show) return
    const t = setTimeout(() => setShow(false), 5000)
    return () => clearTimeout(t)
  }, [show])

  if (!show) return null

  return (
    <div className="mb-5 p-4 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 flex items-center justify-between">
      <span className="font-medium">LinkedIn connected! Your posts will now publish automatically.</span>
      <button onClick={() => setShow(false)} className="text-green-500 hover:text-green-700 ml-4 text-lg leading-none">&times;</button>
    </div>
  )
}

// ---- Next post summary -----------------------------------------------------

function nextPostSummary(
  slots: DaySlot[],
  postHour: number,
  postTz: string,
): string {
  const pending = slots.filter(s => s.draft.trim() !== '' && s.post?.status !== 'posted')
  const count   = pending.length
  if (count === 0) return '0 / 30 days'

  const earliest = pending[0]
  let label = ''
  try {
    // Build the date string in the target timezone by formatting with hour=postHour
    // Using toLocaleString to get day/month/year in the target timezone avoids
    // the setHours() bug where the hour is set in browser-local timezone, not postTz.
    const d = new Date(earliest.dateKey + 'T12:00:00Z') // noon UTC — safe anchor for any timezone
    const dayPart = d.toLocaleString('en-IN', {
      weekday: 'short', day: 'numeric', month: 'short', timeZone: postTz,
    })
    const hourPart = new Date(`2000-01-01T${String(postHour).padStart(2,'0')}:00:00`)
      .toLocaleString('en-IN', { hour: 'numeric', hour12: true })
    label = `${dayPart} at ${hourPart}`
  } catch {
    label = earliest.dateKey
  }
  return `${count} post${count > 1 ? 's' : ''} scheduled · next: ${label} ${tzShort(postTz)}`
}

// ---- Main page -------------------------------------------------------------

export default function SchedulePage() {
  const { data: session }  = useSession()
  const [slots, setSlots]  = useState<DaySlot[]>([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [activeDay, setActiveDay] = useState<string | null>(null)

  const [postHour, setPostHour]   = useState(19)
  const [postTz, setPostTz]       = useState('Asia/Kolkata')
  const [linkedInStatus, setLinkedInStatus] = useState<LinkedInStatus | null>(null)
  const [publishing, setPublishing]         = useState(false)
  const [publishResult, setPublishResult]   = useState<{ published: number; failed: number; skipped: number } | null>(null)

  // Build 30-day grid once
  useEffect(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    setSlots(Array.from({ length: 30 }, (_, i) => {
      const d = new Date(today); d.setDate(d.getDate() + i)
      return { date: d, dateKey: toDateKey(d), post: null, draft: '', isDirty: false }
    }))
  }, [])

  const loadPosts = useCallback(async () => {
    if (!session) return
    setLoading(true)
    try {
      const [postsRes, settingsRes, statusRes] = await Promise.all([
        fetch('/api/linkedin-posts').then(r => r.json()),
        fetch('/api/linkedin-posts/settings').then(r => r.json()),
        fetch('/api/auth/linkedin/status').then(r => r.json()),
      ])

      setPostHour(settingsRes.hour ?? 19)
      setPostTz(settingsRes.timezone ?? 'Asia/Kolkata')
      setLinkedInStatus(statusRes)

      setSlots(prev => prev.map(slot => {
        const match = postsRes.posts?.find((p: ScheduledPost) => p.scheduledFor.slice(0, 10) === slot.dateKey)
        return match ? { ...slot, post: match, draft: match.content } : slot
      }))
    } finally {
      setLoading(false)
    }
  }, [session])

  useEffect(() => { loadPosts() }, [loadPosts])

  function updateDraft(dateKey: string, value: string) {
    setSlots(prev => prev.map(s => s.dateKey === dateKey ? { ...s, draft: value, isDirty: true } : s))
  }

  function clearSlot(dateKey: string) {
    setSlots(prev => prev.map(s => s.dateKey === dateKey ? { ...s, draft: '', isDirty: true, post: null } : s))
    if (activeDay === dateKey) setActiveDay(null)
  }

  async function saveAll() {
    setSaving(true); setSaveError(null)
    const toSave = slots
      .filter(s => s.draft.trim() !== '')
      .map(s => ({
        content: s.draft.trim(),
        scheduledFor: s.dateKey, // YYYY-MM-DD — server computes UTC from user's hour+tz pref
        linkedInAccountId: null,
      }))
    try {
      const res = await fetch('/api/linkedin-posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ posts: toSave }),
      })
      if (!res.ok) { setSaveError((await res.json()).error ?? 'Save failed'); return }
      await loadPosts()
    } catch { setSaveError('Network error') }
    finally { setSaving(false) }
  }

  async function saveTimePref(hour: number, tz: string) {
    const res = await fetch('/api/linkedin-posts/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hour, timezone: tz }),
    })
    if (res.ok) {
      setPostHour(hour)
      setPostTz(tz)
      await loadPosts()
    }
  }

  async function handlePublish() {
    setPublishing(true); setPublishResult(null)
    try {
      const res = await fetch('/api/linkedin-posts/publish', { method: 'POST' })
      if (res.ok) setPublishResult(await res.json())
    } finally { setPublishing(false) }
  }

  async function handleDisconnect() {
    await fetch('/api/auth/linkedin/disconnect', { method: 'POST' })
    const res = await fetch('/api/auth/linkedin/status').then(r => r.json())
    setLinkedInStatus(res)
  }

  const dirtyCount = slots.filter(s => s.isDirty).length
  const todayKey   = toDateKey(new Date())
  const summary    = nextPostSummary(slots, postHour, postTz)

  return (
    <div className="p-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="w-6 h-6" style={{ color: '#0A66C2' }} />
            LinkedIn Scheduler
          </h1>
          <TimePicker hour={postHour} tz={postTz} onSave={saveTimePref} />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{summary}</span>
          <button
            onClick={saveAll}
            disabled={saving || dirtyCount === 0}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Saving…' : `Save${dirtyCount > 0 ? ` (${dirtyCount})` : ''}`}
          </button>
        </div>
      </div>

      {/* OAuth ?connected=true toast */}
      <Suspense fallback={null}>
        <ConnectedToast />
      </Suspense>

      {/* LinkedIn connection banner */}
      <LinkedInBanner
        status={linkedInStatus}
        loading={loading}
        onPublish={handlePublish}
        onDisconnect={handleDisconnect}
        publishResult={publishResult}
        publishing={publishing}
      />

      {saveError && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
          {saveError}
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading schedule…
        </div>
      ) : (
        <div className="space-y-2">
          {slots.map(slot => (
            <DayRow
              key={slot.dateKey}
              slot={slot}
              isActive={activeDay === slot.dateKey}
              todayKey={todayKey}
              postHour={postHour}
              postTz={postTz}
              onToggle={() => setActiveDay(activeDay === slot.dateKey ? null : slot.dateKey)}
              onDraftChange={v => updateDraft(slot.dateKey, v)}
              onClear={() => clearSlot(slot.dateKey)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

