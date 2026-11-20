'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2, Clock, AlertCircle, Trash2, Loader2 } from 'lucide-react'

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

export const TIMEZONES: { value: string; label: string }[] = [
  { value: 'Asia/Kolkata',       label: 'Asia/Kolkata (IST)'       },
  { value: 'America/New_York',   label: 'America/New_York (EST/EDT)'},
  { value: 'America/Los_Angeles',label: 'America/Los_Angeles (PST/PDT)'},
  { value: 'America/Chicago',    label: 'America/Chicago (CST/CDT)' },
  { value: 'Europe/London',      label: 'Europe/London (GMT/BST)'  },
  { value: 'Europe/Paris',       label: 'Europe/Paris (CET/CEST)'  },
  { value: 'Asia/Dubai',         label: 'Asia/Dubai (GST)'         },
  { value: 'Asia/Singapore',     label: 'Asia/Singapore (SGT)'     },
  { value: 'Asia/Tokyo',         label: 'Asia/Tokyo (JST)'         },
  { value: 'Australia/Sydney',   label: 'Australia/Sydney (AEST/AEDT)'},
  { value: 'UTC',                label: 'UTC'                      },
]

export function formatHour(h: number): string {
  if (h === 0)  return '12 AM'
  if (h < 12)   return `${h} AM`
  if (h === 12) return '12 PM'
  return `${h - 12} PM`
}

export function tzShort(tz: string): string {
  const found = TIMEZONES.find(t => t.value === tz)
  if (!found) return tz
  // Extract the parenthesised abbreviation e.g. "(IST)" -> "IST"
  const m = found.label.match(/\(([^)]+)\)/)
  return m ? m[1] : tz
}

// ---------------------------------------------------------------------------
// TimePicker
// ---------------------------------------------------------------------------

interface TimePickerProps {
  hour: number
  tz: string
  onSave: (hour: number, tz: string) => Promise<void>
}

export function TimePicker({ hour, tz, onSave }: TimePickerProps) {
  const [editing, setEditing]     = useState(false)
  const [editHour, setEditHour]   = useState(hour)
  const [editTz, setEditTz]       = useState(tz)
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)

  // Keep local edit state in sync when parent re-fetches preferences
  useEffect(() => { if (!editing) { setEditHour(hour); setEditTz(tz) } }, [hour, tz, editing])

  async function handleSave() {
    setSaving(true)
    await onSave(editHour, editTz)
    setSaving(false)
    setEditing(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function handleCancel() {
    setEditHour(hour)
    setEditTz(tz)
    setEditing(false)
  }

  if (!editing) {
    return (
      <p className="text-sm text-gray-500 mt-1 flex items-center gap-1 flex-wrap">
        Posts automatically at&nbsp;
        <span className="font-medium text-gray-700">{formatHour(hour)}</span>
        &nbsp;
        <span className="font-medium text-gray-700">{tzShort(tz)}</span>
        &nbsp;every day.
        <button
          onClick={() => { setEditHour(hour); setEditTz(tz); setEditing(true) }}
          className="ml-1 text-xs text-blue-600 hover:text-blue-800 underline underline-offset-2"
        >
          Edit ✎
        </button>
        {saved && <span className="text-xs text-green-600 font-medium">Saved</span>}
      </p>
    )
  }

  return (
    <div className="flex items-center gap-2 flex-wrap mt-1">
      <select
        value={editHour}
        onChange={e => setEditHour(Number(e.target.value))}
        className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
      >
        {Array.from({ length: 24 }, (_, i) => (
          <option key={i} value={i}>{formatHour(i)}</option>
        ))}
      </select>

      <select
        value={editTz}
        onChange={e => setEditTz(e.target.value)}
        className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
      >
        {TIMEZONES.map(t => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>

      <button
        onClick={handleSave}
        disabled={saving}
        className="inline-flex items-center gap-1 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-3 py-1 rounded-md transition-colors"
      >
        {saving && <Loader2 className="w-3 h-3 animate-spin" />}
        Save
      </button>
      <button
        onClick={handleCancel}
        className="text-sm text-gray-500 hover:text-gray-700 px-2 py-1"
      >
        Cancel
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// LinkedInBanner
// ---------------------------------------------------------------------------

interface LinkedInStatus {
  configured: boolean
  connected: boolean
  account: { name: string; scope: string; tokenExpiry: string } | null
}

interface LinkedInBannerProps {
  status: LinkedInStatus | null
  loading: boolean
  onPublish: () => Promise<void>
  onDisconnect: () => Promise<void>
  publishResult: { published: number; failed: number; skipped: number } | null
  publishing: boolean
}

export function LinkedInBanner({
  status,
  loading,
  onPublish,
  onDisconnect,
  publishResult,
  publishing,
}: LinkedInBannerProps) {
  if (loading || status === null) return null

  // Not configured
  if (!status.configured) {
    return (
      <div className="mb-5 p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700">
        <p className="font-semibold text-gray-900 mb-1">LinkedIn auto-posting needs a Developer App</p>
        <p className="text-gray-600 mb-2">Posts are saved and ready. To enable auto-publishing:</p>
        <ol className="list-decimal list-inside space-y-0.5 text-gray-600 mb-3">
          <li>Create a LinkedIn Developer App (5 min)</li>
          <li>Add <code className="bg-gray-100 px-1 rounded text-xs">LINKEDIN_CLIENT_ID</code> + <code className="bg-gray-100 px-1 rounded text-xs">LINKEDIN_CLIENT_SECRET</code> to env</li>
          <li>Redeploy</li>
        </ol>
        <a
          href="https://www.linkedin.com/developers"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 underline text-xs"
        >
          linkedin.com/developers
        </a>
      </div>
    )
  }

  // Configured but not connected
  if (!status.connected) {
    return (
      <div className="mb-5 p-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl text-sm text-amber-800 dark:text-amber-300 flex items-center justify-between flex-wrap gap-3">
        <span className="font-medium">Connect your LinkedIn account to enable auto-posting</span>
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- OAuth redirect needs a full page load */}
          <a
            href="/api/auth/linkedin"
            className="inline-flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
          >
            Connect LinkedIn
          </a>
          <a href="/settings" className="text-amber-700 dark:text-amber-400 font-semibold underline text-xs">
            Settings
          </a>
        </div>
      </div>
    )
  }

  // Connected
  return (
    <div className="mb-5 p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-xl text-sm">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 text-green-700 dark:text-green-200">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>
            Posting as <strong>{status.account?.name}</strong>
            {status.account?.scope && (
              <span className="ml-1 text-green-600 dark:text-green-400 text-xs">
                · {status.account.scope.split(',')[0]} granted
              </span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onPublish}
            disabled={publishing}
            className="inline-flex items-center gap-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
          >
            {publishing && <Loader2 className="w-3 h-3 animate-spin" />}
            Publish due posts now
          </button>
          <button
            onClick={onDisconnect}
            className="text-xs text-red-600 hover:text-red-800 font-medium underline"
          >
            Disconnect
          </button>
        </div>
      </div>
      {publishResult && (
        <p className="mt-2 text-xs text-green-700 dark:text-green-400">
          Published: {publishResult.published} · Failed: {publishResult.failed} · Skipped: {publishResult.skipped}
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// DayRow
// ---------------------------------------------------------------------------

export interface ScheduledPost {
  id: string
  content: string
  scheduledFor: string
  status: 'scheduled' | 'posted' | 'failed' | 'skipped'
  postedAt: string | null
  error: string | null
  linkedInAccountId: string | null
  linkedInPostId?: string | null
}

export interface DaySlot {
  date: Date
  dateKey: string
  post: ScheduledPost | null
  draft: string
  isDirty: boolean
}

const STATUS_META = {
  scheduled: { label: 'Scheduled', color: 'text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-200', Icon: Clock },
  posted:    { label: 'Posted',    color: 'text-green-600 bg-green-50 dark:bg-green-950 dark:text-green-200', Icon: CheckCircle2 },
  failed:    { label: 'Failed',    color: 'text-red-600 bg-red-50 dark:bg-red-950 dark:text-red-200', Icon: AlertCircle },
  skipped:   { label: 'Skipped',   color: 'text-gray-500 bg-gray-100', Icon: AlertCircle },
}

function formatDate(d: Date) {
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
}

function formatPostTime(date: Date, hour: number, tz: string): string {
  // Build a date string at the given slot with user's hour preference
  const d = new Date(date)
  d.setHours(hour, 0, 0, 0)
  try {
    return d.toLocaleString('en-IN', {
      weekday: 'short', day: 'numeric', month: 'short',
      hour: 'numeric', minute: '2-digit',
      timeZone: tz,
    })
  } catch {
    return formatDate(date)
  }
}

function toDateKey(d: Date) { return d.toISOString().slice(0, 10) }

interface DayRowProps {
  slot: DaySlot
  isActive: boolean
  todayKey: string
  postHour: number
  postTz: string
  onToggle: () => void
  onDraftChange: (val: string) => void
  onClear: () => void
}

export function DayRow({
  slot,
  isActive,
  todayKey,
  postHour,
  postTz,
  onToggle,
  onDraftChange,
  onClear,
}: DayRowProps) {
  const hasContent = slot.draft.trim() !== ''
  const status     = slot.post?.status
  const meta       = status ? STATUS_META[status] : null
  const isPast     = slot.date < new Date(new Date().setHours(0, 0, 0, 0))
  const isToday    = slot.dateKey === toDateKey(new Date(todayKey))
  const canEdit    = status !== 'posted'
  const charsLeft  = 3000 - slot.draft.length

  async function copyToClipboard() {
    try { await navigator.clipboard.writeText(slot.draft) } catch { /* ignore */ }
  }

  return (
    <div
      className={`rounded-xl border transition-all ${
        isActive
          ? 'border-blue-300 dark:border-blue-600 shadow-sm bg-white'
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <button type="button" onClick={() => canEdit && onToggle()}
        className="w-full flex items-center gap-4 px-4 py-3 text-left">
        <div className="w-20 flex-shrink-0">
          <p className={`text-xs font-semibold ${isPast && !isToday ? 'text-gray-400' : 'text-gray-900'}`}>
            {formatDate(slot.date)}
          </p>
          {isToday && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: '#0A66C2', color: 'white' }}>Today</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          {hasContent
            ? <p className="text-sm text-gray-700 truncate">{slot.draft}</p>
            : <p className="text-sm text-gray-400 italic">{isPast ? 'No post scheduled' : 'Click to add post…'}</p>
          }
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {meta && (
            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${meta.color}`}>
              <meta.Icon className="w-3 h-3" />{meta.label}
            </span>
          )}
          {!meta && hasContent && (
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-200">
              <Clock className="w-3 h-3" /> Ready
            </span>
          )}
          {hasContent && canEdit && (
            <button type="button"
              onClick={e => { e.stopPropagation(); onClear() }}
              className="p-1 text-gray-400 hover:text-red-500 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </button>

      {isActive && canEdit && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3">
          {slot.post?.error && (
            <p className="text-xs text-red-500 mb-2">{slot.post.error}</p>
          )}
          <textarea
            rows={5}
            placeholder="Write your LinkedIn post here…"
            value={slot.draft}
            onChange={e => onDraftChange(e.target.value)}
            className="w-full px-3 py-2.5 text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none placeholder-gray-400"
          />
          <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
            <span className={`text-xs font-medium ${charsLeft < 0 ? 'text-red-500' : charsLeft < 200 ? 'text-amber-500' : 'text-gray-400'}`}>
              {charsLeft >= 0 ? `${charsLeft} chars left` : `${Math.abs(charsLeft)} over limit`}
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={copyToClipboard}
                className="text-xs text-gray-400 hover:text-gray-700 flex items-center gap-1 transition-colors"
              >
                Copy
              </button>
              <span className="text-xs text-gray-400">
                Will post at {formatPostTime(slot.date, postHour, postTz)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Shown for 'posted' status — view only */}
      {status === 'posted' && slot.post?.postedAt && (
        <div className="px-4 pb-3 border-t border-gray-100 pt-2">
          <p className="text-xs text-gray-500">
            Posted at {new Date(slot.post.postedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
            {slot.post.linkedInPostId && (
              <>
                {' · '}
                <a
                  href={`https://www.linkedin.com/feed/update/${slot.post.linkedInPostId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  View on LinkedIn
                </a>
              </>
            )}
          </p>
          <p className="mt-1 text-sm text-gray-600 line-clamp-3">{slot.draft}</p>
        </div>
      )}
    </div>
  )
}
