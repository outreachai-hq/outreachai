export const TIMEZONES = [
  { label: 'India (IST)',             value: 'Asia/Kolkata' },
  { label: 'UAE (GST)',               value: 'Asia/Dubai' },
  { label: 'Singapore (SGT)',         value: 'Asia/Singapore' },
  { label: 'UK (GMT/BST)',            value: 'Europe/London' },
  { label: 'Central Europe (CET)',    value: 'Europe/Berlin' },
  { label: 'US Eastern (EST/EDT)',    value: 'America/New_York' },
  { label: 'US Central (CST/CDT)',    value: 'America/Chicago' },
  { label: 'US Pacific (PST/PDT)',    value: 'America/Los_Angeles' },
  { label: 'Japan (JST)',             value: 'Asia/Tokyo' },
  { label: 'Australia/Sydney (AEST)', value: 'Australia/Sydney' },
  { label: 'UTC',                     value: 'UTC' },
]

export function parseSendWindow(raw: unknown): [number, number] {
  if (Array.isArray(raw) && raw.length === 2) return [Number(raw[0]), Number(raw[1])]
  return [8, 18]
}

export function isWithinSendWindow(timezone: string, startHour: number, endHour: number): boolean {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', hour12: false })
    const hour = parseInt(fmt.format(new Date()), 10)
    return hour >= startHour && hour < endHour
  } catch {
    return true // fail open — never silently block sends
  }
}

export function getCurrentHourInTz(timezone: string): number {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', hour12: false })
    return parseInt(fmt.format(new Date()), 10)
  } catch { return new Date().getHours() }
}

// Plan 7 — richer send-window evaluator backed by a named Schedule row.
//
// Schedule shape:
//   timezone:   IANA, e.g. "Asia/Kolkata"
//   weeklyHours { mon: [[9,18]], tue: [[9,12],[14,18]], wed: [...], ... }
//               Hour ranges are [startHourInclusive, endHourExclusive], 0-23.
//   holidays:   [{ date: "YYYY-MM-DD", label? }] — date is in schedule.timezone
//
// Returns true when `now` in the schedule's timezone:
//   - is NOT a holiday date
//   - falls inside one of today's weeklyHours ranges
// Fails open on malformed input — sends are never silently blocked.

export type ScheduleShape = {
  timezone: string
  weeklyHours: Record<string, [number, number][]> | unknown
  holidays:    { date: string; label?: string }[] | unknown
}

export function isWithinSchedule(schedule: ScheduleShape, now: Date = new Date()): boolean {
  try {
    const tz = schedule.timezone || 'UTC'

    // Pull weekday + YYYY-MM-DD + hour, all in the schedule's tz, in one pass.
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      weekday: 'short',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', hour12: false,
    }).formatToParts(now)
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
    const weekday = get('weekday').toLowerCase()             // mon|tue|wed|...
    const ymd     = `${get('year')}-${get('month')}-${get('day')}`
    // en-CA's hour can come back as '24' at midnight; coerce to 0.
    const hourRaw = parseInt(get('hour'), 10)
    const hour    = hourRaw === 24 ? 0 : hourRaw

    const holidays = Array.isArray(schedule.holidays) ? schedule.holidays as { date: string }[] : []
    if (holidays.some((h) => h?.date === ymd)) return false

    const weekly = (schedule.weeklyHours ?? {}) as Record<string, [number, number][]>
    const ranges = Array.isArray(weekly[weekday]) ? weekly[weekday] : []
    return ranges.some(([s, e]) => Number.isFinite(s) && Number.isFinite(e) && hour >= s && hour < e)
  } catch {
    return true
  }
}

/**
 * Returns the UTC `Date` corresponding to the start of "today" in the given
 * timezone. Used by sender-rotation to make daily-send counters reset at the
 * campaign's local midnight, not UTC midnight. Handles fractional offsets
 * (IST = +5:30, Nepal = +5:45) correctly without a dep on date-fns-tz.
 */
export function startOfTodayInTz(timezone: string, now: Date = new Date()): Date {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hourCycle: 'h23',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(now)
    const num = (t: string) => parseInt(parts.find((p) => p.type === t)?.value ?? '0', 10)
    const elapsedMs = ((num('hour') * 60 + num('minute')) * 60 + num('second')) * 1000 + now.getMilliseconds()
    return new Date(now.getTime() - elapsedMs)
  } catch {
    // Unknown tz -> fall back to UTC midnight
    const d = new Date(now)
    d.setUTCHours(0, 0, 0, 0)
    return d
  }
}
