import { describe, it, expect } from 'vitest'
import {
  parseSendWindow,
  isWithinSendWindow,
  getCurrentHourInTz,
  startOfTodayInTz,
  isWithinSchedule,
} from '@/lib/timezone'

describe('parseSendWindow', () => {
  it('parses a valid [start, end] tuple', () => {
    expect(parseSendWindow([9, 17])).toEqual([9, 17])
  })

  it('coerces numeric strings', () => {
    expect(parseSendWindow(['9', '17'])).toEqual([9, 17])
  })

  it('defaults to [8, 18] on malformed input', () => {
    expect(parseSendWindow(null)).toEqual([8, 18])
    expect(parseSendWindow(undefined)).toEqual([8, 18])
    expect(parseSendWindow('not-an-array')).toEqual([8, 18])
    expect(parseSendWindow([9])).toEqual([8, 18])
    expect(parseSendWindow([9, 10, 11])).toEqual([8, 18])
  })
})

describe('isWithinSendWindow', () => {
  it('returns true (fail-open) on an unknown timezone', () => {
    expect(isWithinSendWindow('Mars/Olympus_Mons', 0, 24)).toBe(true)
  })
})

describe('getCurrentHourInTz', () => {
  it('returns a sensible 0-23 hour for a known timezone', () => {
    const h = getCurrentHourInTz('UTC')
    expect(h).toBeGreaterThanOrEqual(0)
    expect(h).toBeLessThan(24)
  })

  it('returns a number on an unknown tz (fallback)', () => {
    const h = getCurrentHourInTz('Mars/Olympus_Mons')
    expect(typeof h).toBe('number')
  })
})

// ─── startOfTodayInTz ─────────────────────────────────────────────────────────

describe('startOfTodayInTz', () => {
  it('UTC: matches setUTCHours(0,0,0,0)', () => {
    const now = new Date('2026-06-23T14:30:45.123Z')
    const got = startOfTodayInTz('UTC', now)
    expect(got.toISOString()).toBe('2026-06-23T00:00:00.000Z')
  })

  it('IST (+5:30): midnight IST equals 18:30 UTC the previous day', () => {
    // 14:30 UTC = 20:00 IST on June 23
    // Midnight IST June 23 = 18:30 UTC June 22
    const now = new Date('2026-06-23T14:30:45.123Z')
    const got = startOfTodayInTz('Asia/Kolkata', now)
    expect(got.toISOString()).toBe('2026-06-22T18:30:00.000Z')
  })

  it('IST: at 02:00 IST (= 20:30 UTC prev day) returns the same IST day', () => {
    // 20:30 UTC June 22 = 02:00 IST June 23
    // Midnight IST June 23 = 18:30 UTC June 22
    const now = new Date('2026-06-22T20:30:00.000Z')
    const got = startOfTodayInTz('Asia/Kolkata', now)
    expect(got.toISOString()).toBe('2026-06-22T18:30:00.000Z')
  })

  it('IST: at 23:59 IST returns midnight of that same IST day', () => {
    // 23:59 IST June 23 = 18:29 UTC June 23
    // Midnight IST June 23 = 18:30 UTC June 22
    const now = new Date('2026-06-23T18:29:00.000Z')
    const got = startOfTodayInTz('Asia/Kolkata', now)
    expect(got.toISOString()).toBe('2026-06-22T18:30:00.000Z')
  })

  it('Asia/Kathmandu (+5:45): handles fractional 45-min offset', () => {
    // 14:30 UTC = 20:15 NPT on June 23
    // Midnight NPT June 23 = 18:15 UTC June 22
    const now = new Date('2026-06-23T14:30:00.000Z')
    const got = startOfTodayInTz('Asia/Kathmandu', now)
    expect(got.toISOString()).toBe('2026-06-22T18:15:00.000Z')
  })

  it('America/New_York (varies): late evening UTC -> same NY day', () => {
    // 03:00 UTC June 23 = 23:00 EDT June 22 (during EDT)
    // Midnight EDT June 22 = 04:00 UTC June 22
    const now = new Date('2026-06-23T03:00:00.000Z')
    const got = startOfTodayInTz('America/New_York', now)
    expect(got.toISOString()).toBe('2026-06-22T04:00:00.000Z')
  })

  it('falls back to UTC midnight on an unknown timezone', () => {
    const now = new Date('2026-06-23T14:30:45.123Z')
    const got = startOfTodayInTz('Mars/Olympus_Mons', now)
    expect(got.toISOString()).toBe('2026-06-23T00:00:00.000Z')
  })

  it('uses Date.now() when no instant is provided', () => {
    const got = startOfTodayInTz('UTC')
    const now = Date.now()
    // The returned value should be at or before "now" and within the last 24h
    expect(got.getTime()).toBeLessThanOrEqual(now)
    expect(now - got.getTime()).toBeLessThanOrEqual(24 * 3600 * 1000)
  })

  it('returned Date is always at or before now (sanity)', () => {
    const now = new Date('2026-06-23T14:30:45.123Z')
    for (const tz of ['UTC', 'Asia/Kolkata', 'America/Los_Angeles', 'Pacific/Auckland', 'Atlantic/Azores']) {
      const got = startOfTodayInTz(tz, now)
      expect(got.getTime()).toBeLessThanOrEqual(now.getTime())
      // Within the last 24h+1min (allow for tz-shifted days)
      expect(now.getTime() - got.getTime()).toBeLessThan(25 * 3600 * 1000)
    }
  })
})

describe('isWithinSchedule', () => {
  // Tuesday 2026-03-10 at 10:30 UTC (= 16:00 IST = 02:30 PT)
  const tueMid = new Date(Date.UTC(2026, 2, 10, 10, 30))

  it('is true inside today\'s window in the schedule\'s timezone', () => {
    expect(isWithinSchedule({
      timezone: 'Asia/Kolkata',
      weeklyHours: { tue: [[9, 18]] },
      holidays: [],
    }, tueMid)).toBe(true) // 16:00 IST is inside 9-18
  })

  it('is false outside today\'s windows', () => {
    expect(isWithinSchedule({
      timezone: 'America/Los_Angeles', // 02:30 PT
      weeklyHours: { tue: [[9, 18]] },
      holidays: [],
    }, tueMid)).toBe(false)
  })

  it('respects multiple ranges per day', () => {
    expect(isWithinSchedule({
      timezone: 'Asia/Kolkata',
      weeklyHours: { tue: [[9, 12], [14, 18]] },
      holidays: [],
    }, tueMid)).toBe(true) // 16:00 IST — second range
  })

  it('skips when today is a holiday', () => {
    expect(isWithinSchedule({
      timezone: 'Asia/Kolkata',
      weeklyHours: { tue: [[9, 18]] },
      holidays: [{ date: '2026-03-10', label: 'Test holiday' }],
    }, tueMid)).toBe(false)
  })

  it('returns false when the weekday has no configured windows', () => {
    expect(isWithinSchedule({
      timezone: 'Asia/Kolkata',
      weeklyHours: { mon: [[9, 18]] }, // tue missing
      holidays: [],
    }, tueMid)).toBe(false)
  })

  it('fails open on malformed input', () => {
    expect(isWithinSchedule({
      timezone: 'Not/A_Real_Tz',
      weeklyHours: 'whoops' as unknown as Record<string, [number, number][]>,
      holidays: null as unknown as { date: string }[],
    }, tueMid)).toBe(true)
  })
})
