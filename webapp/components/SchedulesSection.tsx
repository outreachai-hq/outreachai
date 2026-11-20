'use client'

// Plan 7 — Schedules management UI for the Settings page.
//
// Editor pattern: each weekday has zero or more [start, end] hour ranges.
// Holidays are a flat list of {date, label}. Schedule.isDefault is
// mutually-exclusive across the user's schedules (enforced server-side).

import { useEffect, useState } from 'react'
import { CalendarClock, Plus, Trash2, Pencil, Check, X, Loader2, Star } from 'lucide-react'
import { TIMEZONES } from '@/lib/timezone'

type Range = [number, number]
type WeeklyHours = Record<string, Range[]>
type Holiday = { date: string; label?: string }

type Schedule = {
  id: string
  name: string
  timezone: string
  weeklyHours: WeeklyHours
  holidays:    Holiday[]
  isDefault:   boolean
}

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
const DAY_LABEL: Record<string, string> = {
  mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun',
}

const EMPTY_DRAFT = {
  name: '',
  timezone: 'Asia/Kolkata',
  weeklyHours: { mon: [[9, 18]], tue: [[9, 18]], wed: [[9, 18]], thu: [[9, 18]], fri: [[9, 18]] } as WeeklyHours,
  holidays: [] as Holiday[],
  isDefault: false,
}

function rangeSummary(weekly: WeeklyHours, tz: string): string {
  const active = DAY_KEYS
    .filter((d) => weekly[d]?.length)
    .map((d) => `${DAY_LABEL[d]} ${weekly[d].map(([s, e]) => `${s}-${e}`).join(', ')}`)
  return active.length === 0 ? '— no windows configured —' : `${tz.split('/').pop()} · ${active.join(' · ')}`
}

export function SchedulesSection() {
  const [items, setItems]       = useState<Schedule[]>([])
  const [loading, setLoading]   = useState(true)
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [draft, setDraft]       = useState(EMPTY_DRAFT)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/schedules')
      .then((r) => (r.ok ? r.json() : { schedules: [] }))
      .then((d) => setItems(d.schedules ?? []))
      .finally(() => setLoading(false))
  }, [])

  function openNew() {
    setDraft(EMPTY_DRAFT)
    setEditingId('new')
    setError(null)
  }

  function openEdit(s: Schedule) {
    setDraft({
      name: s.name,
      timezone: s.timezone,
      weeklyHours: s.weeklyHours ?? {},
      holidays: Array.isArray(s.holidays) ? s.holidays : [],
      isDefault: s.isDefault,
    })
    setEditingId(s.id)
    setError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setError(null)
  }

  function addRange(day: string) {
    setDraft((d) => {
      const next: WeeklyHours = { ...d.weeklyHours }
      next[day] = [...(next[day] ?? []), [9, 18]]
      return { ...d, weeklyHours: next }
    })
  }
  function removeRange(day: string, idx: number) {
    setDraft((d) => {
      const next: WeeklyHours = { ...d.weeklyHours }
      next[day] = (next[day] ?? []).filter((_, i) => i !== idx)
      if (next[day].length === 0) delete next[day]
      return { ...d, weeklyHours: next }
    })
  }
  function setRange(day: string, idx: number, side: 0 | 1, hour: number) {
    setDraft((d) => {
      const next: WeeklyHours = { ...d.weeklyHours }
      const ranges = (next[day] ?? []).slice()
      const r = ranges[idx]?.slice() as Range
      if (!r) return d
      r[side] = hour
      ranges[idx] = r
      next[day] = ranges
      return { ...d, weeklyHours: next }
    })
  }
  function addHoliday() {
    setDraft((d) => ({ ...d, holidays: [...d.holidays, { date: '', label: '' }] }))
  }
  function setHoliday(idx: number, patch: Partial<Holiday>) {
    setDraft((d) => ({ ...d, holidays: d.holidays.map((h, i) => (i === idx ? { ...h, ...patch } : h)) }))
  }
  function removeHoliday(idx: number) {
    setDraft((d) => ({ ...d, holidays: d.holidays.filter((_, i) => i !== idx) }))
  }

  async function save() {
    setError(null)
    if (!draft.name.trim()) { setError('Name required'); return }
    setSaving(true)
    try {
      const cleaned = {
        ...draft,
        // strip empty holiday rows
        holidays: draft.holidays.filter((h) => h.date.trim()),
      }
      const url = editingId === 'new' ? '/api/schedules' : `/api/schedules/${editingId}`
      const method = editingId === 'new' ? 'POST' : 'PATCH'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleaned),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error ?? `Save failed (${res.status})`)
        return
      }
      const { schedule } = await res.json()
      setItems((prev) => {
        const i = prev.findIndex((s) => s.id === schedule.id)
        // Editing default-on can change isDefault on other rows server-side;
        // we mirror that locally for snappier UI.
        const cleared = schedule.isDefault ? prev.map((s) => ({ ...s, isDefault: s.id === schedule.id })) : prev
        if (i >= 0) return cleared.map((s) => (s.id === schedule.id ? schedule : s))
        return [schedule, ...cleared]
      })
      setEditingId(null)
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this schedule? Any campaigns using it will fall back to their inline timezone+window.')) return
    const res = await fetch(`/api/schedules/${id}`, { method: 'DELETE' })
    if (res.ok) setItems((prev) => prev.filter((s) => s.id !== id))
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 bg-cyan-50 dark:bg-cyan-950 rounded-lg">
            <CalendarClock className="w-5 h-5 text-cyan-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Schedules</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Reusable send-window calendars. Attach one to any campaign in place of inline timezone + hours.
            </p>
          </div>
        </div>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          <Plus className="w-4 h-4" /> Add schedule
        </button>
      </div>

      {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

      {editingId !== null && (
        <div className="mb-4 p-4 border border-cyan-200 dark:border-cyan-900 bg-cyan-50 dark:bg-gray-800 rounded-lg space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Name (e.g. IST Business Hours)"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            <select
              value={draft.timezone}
              onChange={(e) => setDraft({ ...draft, timezone: e.target.value })}
              className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              {TIMEZONES.map((tz) => (<option key={tz.value} value={tz.value}>{tz.label}</option>))}
            </select>
          </div>

          {/* Weekly hours grid */}
          <div className="space-y-1.5">
            {DAY_KEYS.map((day) => {
              const ranges = draft.weeklyHours[day] ?? []
              return (
                <div key={day} className="flex items-start gap-2">
                  <div className="w-9 text-xs font-semibold text-gray-500 dark:text-gray-400 mt-1.5">
                    {DAY_LABEL[day]}
                  </div>
                  <div className="flex-1 flex flex-wrap items-center gap-1.5">
                    {ranges.length === 0 ? (
                      <span className="text-xs text-gray-400 italic mt-1.5">off</span>
                    ) : (
                      ranges.map(([s, e], i) => (
                        <div key={i} className="flex items-center gap-1 bg-white dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-700 px-1.5 py-0.5">
                          <select
                            value={s}
                            onChange={(ev) => setRange(day, i, 0, parseInt(ev.target.value, 10))}
                            className="text-xs bg-transparent focus:outline-none text-gray-900 dark:text-white"
                          >
                            {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{h.toString().padStart(2, '0')}</option>)}
                          </select>
                          <span className="text-xs text-gray-400">–</span>
                          <select
                            value={e}
                            onChange={(ev) => setRange(day, i, 1, parseInt(ev.target.value, 10))}
                            className="text-xs bg-transparent focus:outline-none text-gray-900 dark:text-white"
                          >
                            {Array.from({ length: 25 }, (_, h) => <option key={h} value={h}>{h.toString().padStart(2, '0')}</option>)}
                          </select>
                          <button onClick={() => removeRange(day, i)} className="text-gray-400 hover:text-red-600" aria-label="Remove range">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))
                    )}
                    <button
                      onClick={() => addRange(day)}
                      className="text-xs text-cyan-600 hover:text-cyan-700 font-medium"
                    >
                      + Add range
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Holidays */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Holidays</p>
              <button onClick={addHoliday} className="text-xs text-cyan-600 hover:text-cyan-700 font-medium">+ Add holiday</button>
            </div>
            {draft.holidays.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No holidays configured.</p>
            ) : (
              <div className="space-y-1">
                {draft.holidays.map((h, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="date"
                      value={h.date}
                      onChange={(e) => setHoliday(i, { date: e.target.value })}
                      className="px-2 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                    <input
                      type="text"
                      placeholder="Label (optional)"
                      value={h.label ?? ''}
                      onChange={(e) => setHoliday(i, { label: e.target.value })}
                      className="flex-1 px-2 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                    <button onClick={() => removeHoliday(i)} className="text-gray-400 hover:text-red-600" aria-label="Remove holiday">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
            <input
              type="checkbox"
              checked={draft.isDefault}
              onChange={(e) => setDraft({ ...draft, isDefault: e.target.checked })}
              className="rounded border-gray-300 text-cyan-600"
            />
            Set as default schedule for new campaigns
          </label>

          <div className="flex gap-2 pt-1">
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save schedule
            </button>
            <button
              onClick={cancelEdit}
              className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[...Array(2)].map((_, i) => (<div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />))}
        </div>
      ) : items.length === 0 && editingId === null ? (
        <div className="text-center py-6 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">No schedules yet.</p>
          <button onClick={openNew} className="text-sm text-cyan-600 hover:underline">+ Add your first schedule</button>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((s) => (
            <div key={s.id} className="flex items-start gap-3 px-3 py-2.5 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{s.name}</p>
                  {s.isDefault && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950 px-1.5 py-0.5 rounded">
                      <Star className="w-2.5 h-2.5" /> default
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {rangeSummary(s.weeklyHours ?? {}, s.timezone)}
                </p>
                {Array.isArray(s.holidays) && s.holidays.length > 0 && (
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {s.holidays.length} holiday{s.holidays.length === 1 ? '' : 's'}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => openEdit(s)}
                  className="p-1.5 text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-950 rounded transition-colors"
                  aria-label="Edit"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => remove(s.id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 rounded transition-colors"
                  aria-label="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
