// Plan 7 (Iter 3) — smoke tests for the Schedules API.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/lib/prisma'

import { GET as listSchedules, POST as createSchedule } from '@/app/api/schedules/route'
import { PATCH as patchSchedule, DELETE as deleteSchedule } from '@/app/api/schedules/[id]/route'

function mkReq(url: string, init?: RequestInit) {
  return new Request(url, init) as unknown as Parameters<typeof patchSchedule>[0]
}

describe('GET /api/schedules', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns user-scoped schedules ordered with defaults first', async () => {
    vi.mocked(prisma.schedule.findMany).mockResolvedValue([
      { id: 'sch_1', name: 'IST Business', isDefault: true } as never,
      { id: 'sch_2', name: 'Weekends',     isDefault: false } as never,
    ])
    const res = await listSchedules()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.schedules).toHaveLength(2)
    expect(vi.mocked(prisma.schedule.findMany)).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    }))
  })
})

describe('POST /api/schedules', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects missing name', async () => {
    const res = await createSchedule(mkReq('http://x', {
      method: 'POST', body: JSON.stringify({ timezone: 'Asia/Kolkata' }),
    }))
    expect(res.status).toBe(400)
  })

  it('rejects missing timezone', async () => {
    const res = await createSchedule(mkReq('http://x', {
      method: 'POST', body: JSON.stringify({ name: 'IST Business' }),
    }))
    expect(res.status).toBe(400)
  })

  it('rejects malformed weeklyHours range', async () => {
    const res = await createSchedule(mkReq('http://x', {
      method: 'POST',
      body: JSON.stringify({ name: 'X', timezone: 'UTC', weeklyHours: { mon: [[9, 'eighteen']] } }),
    }))
    expect(res.status).toBe(400)
  })

  it('rejects unknown weeklyHours key', async () => {
    const res = await createSchedule(mkReq('http://x', {
      method: 'POST',
      body: JSON.stringify({ name: 'X', timezone: 'UTC', weeklyHours: { funday: [[9, 18]] } }),
    }))
    expect(res.status).toBe(400)
  })

  it('creates a schedule and un-sets other defaults atomically when isDefault=true', async () => {
    const calls: { table: string; method: string; args: unknown }[] = []
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: unknown) => {
      const fakeTx = {
        schedule: {
          updateMany: vi.fn().mockImplementation(async (a) => {
            calls.push({ table: 'schedule', method: 'updateMany', args: a }); return { count: 0 }
          }),
          create: vi.fn().mockImplementation(async (a) => {
            calls.push({ table: 'schedule', method: 'create', args: a }); return { id: 'sch_new' }
          }),
        },
      }
      return (cb as (tx: typeof fakeTx) => Promise<unknown>)(fakeTx)
    })

    const res = await createSchedule(mkReq('http://x', {
      method: 'POST',
      body: JSON.stringify({
        name: 'IST Business', timezone: 'Asia/Kolkata',
        weeklyHours: { mon: [[9, 18]], tue: [[9, 18]] },
        isDefault: true,
      }),
    }))
    expect(res.status).toBe(201)
    expect(calls.map((c) => c.method)).toEqual(['updateMany', 'create'])
  })
})

describe('PATCH /api/schedules/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('404s when not owned', async () => {
    vi.mocked(prisma.schedule.findFirst).mockResolvedValue(null)
    const res = await patchSchedule(mkReq('http://x', { method: 'PATCH', body: '{}' }),
      { params: Promise.resolve({ id: 'x' }) })
    expect(res.status).toBe(404)
  })

  it('rejects empty patch when isDefault not requested', async () => {
    vi.mocked(prisma.schedule.findFirst).mockResolvedValue({ id: 'sch_1' } as never)
    const res = await patchSchedule(mkReq('http://x', { method: 'PATCH', body: '{}' }),
      { params: Promise.resolve({ id: 'sch_1' }) })
    expect(res.status).toBe(400)
  })

  it('updates name and weeklyHours', async () => {
    vi.mocked(prisma.schedule.findFirst).mockResolvedValue({ id: 'sch_1' } as never)
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: unknown) => {
      const fakeTx = {
        schedule: {
          update: vi.fn().mockResolvedValue({ id: 'sch_1', name: 'New' } as never),
          updateMany: vi.fn().mockResolvedValue({ count: 0 } as never),
        },
      }
      return (cb as (tx: typeof fakeTx) => Promise<unknown>)(fakeTx)
    })
    const res = await patchSchedule(mkReq('http://x', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'New', weeklyHours: { mon: [[10, 17]] } }),
    }), { params: Promise.resolve({ id: 'sch_1' }) })
    expect(res.status).toBe(200)
  })
})

describe('DELETE /api/schedules/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('404 when nothing removed', async () => {
    vi.mocked(prisma.schedule.deleteMany).mockResolvedValue({ count: 0 })
    const res = await deleteSchedule(mkReq('http://x', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'x' }) })
    expect(res.status).toBe(404)
  })

  it('ok when one removed', async () => {
    vi.mocked(prisma.schedule.deleteMany).mockResolvedValue({ count: 1 })
    const res = await deleteSchedule(mkReq('http://x', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'sch_1' }) })
    expect(res.status).toBe(200)
  })
})
