import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock the runner so we can assert it's called per user without touching prisma
vi.mock('@/lib/sequenceRunner', () => ({
  runPendingStepsForUser: vi.fn(),
}))

import { prisma } from '@/lib/prisma'
import { runPendingStepsForUser } from '@/lib/sequenceRunner'
import { GET } from '@/app/api/cron/run-sequence-steps/route'

function req(headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost:3000/api/cron/run-sequence-steps', { headers })
}

const ORIGINAL_SECRET = process.env.CRON_SECRET

describe('GET /api/cron/run-sequence-steps — auth', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => { process.env.CRON_SECRET = ORIGINAL_SECRET })

  it('returns 401 when CRON_SECRET is not configured on the server', async () => {
    process.env.CRON_SECRET = ''
    const res = await GET(req({ authorization: 'Bearer anything' }))
    expect(res.status).toBe(401)
  })

  it('returns 401 with no Authorization header', async () => {
    process.env.CRON_SECRET = 's3cret'
    const res = await GET(req())
    expect(res.status).toBe(401)
  })

  it('returns 401 with wrong bearer token', async () => {
    process.env.CRON_SECRET = 's3cret'
    const res = await GET(req({ authorization: 'Bearer wrong' }))
    expect(res.status).toBe(401)
  })

  it('returns 401 when the header is mal-formed (missing "Bearer ")', async () => {
    process.env.CRON_SECRET = 's3cret'
    const res = await GET(req({ authorization: 's3cret' }))
    expect(res.status).toBe(401)
  })

  it('does NOT call the runner when auth fails', async () => {
    process.env.CRON_SECRET = 's3cret'
    await GET(req({ authorization: 'Bearer wrong' }))
    expect(runPendingStepsForUser).not.toHaveBeenCalled()
    expect(prisma.user.findMany).not.toHaveBeenCalled()
  })
})

describe('GET /api/cron/run-sequence-steps — behaviour', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 's3cret'
  })
  afterEach(() => { process.env.CRON_SECRET = ORIGINAL_SECRET })

  it('returns 0 for every counter when no users have active campaigns', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([])
    const res = await GET(req({ authorization: 'Bearer s3cret' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.usersProcessed).toBe(0)
    expect(json.deferredUsers).toBe(0)
    expect(json.emailsSent).toBe(0)
    expect(json.linkedInQueued).toBe(0)
    expect(json.tasksCreated).toBe(0)
    expect(json.skipped).toBe(0)
    expect(json.bounced).toBe(0)
    expect(json.failed).toBe(0)
    expect(json.deferred).toBe(0)
    expect(json.errors).toBe(0)
    expect(typeof json.elapsedMs).toBe('number')
    expect(runPendingStepsForUser).not.toHaveBeenCalled()
  })

  it('aggregates totals across all users', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([
      { id: 'u1' }, { id: 'u2' }, { id: 'u3' },
    ] as any)
    vi.mocked(runPendingStepsForUser)
      .mockResolvedValueOnce({ emailsSent: 5, linkedInQueued: 2, tasksCreated: 0, skipped: 1, bounced: 0, failed: 0, errors: [] })
      .mockResolvedValueOnce({ emailsSent: 0, linkedInQueued: 3, tasksCreated: 1, skipped: 0, bounced: 0, failed: 0, errors: [] })
      .mockResolvedValueOnce({ emailsSent: 2, linkedInQueued: 0, tasksCreated: 0, skipped: 2, bounced: 0, failed: 0, errors: ['oops'] })

    const res = await GET(req({ authorization: 'Bearer s3cret' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.usersProcessed).toBe(3)
    expect(json.emailsSent).toBe(7)
    expect(json.linkedInQueued).toBe(5)
    expect(json.tasksCreated).toBe(1)
    expect(json.skipped).toBe(3)
    expect(json.errors).toBe(1)
  })

  it('queries only users that have at least one active campaign', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([])
    await GET(req({ authorization: 'Bearer s3cret' }))
    const findManyCall = vi.mocked(prisma.user.findMany).mock.calls[0]?.[0] as any
    expect(findManyCall.where).toEqual({ campaigns: { some: { status: 'active' } } })
    expect(findManyCall.select).toEqual({ id: true })
  })

  it('passes a sane batch size (50) and a time budget to the runner', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([{ id: 'u1' }] as any)
    vi.mocked(runPendingStepsForUser).mockResolvedValueOnce({
      emailsSent: 0, linkedInQueued: 0, tasksCreated: 0, skipped: 0, bounced: 0, failed: 0, errors: [],
    })
    await GET(req({ authorization: 'Bearer s3cret' }))
    expect(runPendingStepsForUser).toHaveBeenCalledTimes(1)
    const args = vi.mocked(runPendingStepsForUser).mock.calls[0]
    expect(args[0]).toBe('u1')
    expect(args[1]).toBe(50)
    expect((args[2] as any)?.maxRuntimeMs).toBeGreaterThan(0)
  })

  it('continues processing the next user when one user throws', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([
      { id: 'u_bad' }, { id: 'u_good' },
    ] as any)
    vi.mocked(runPendingStepsForUser)
      .mockRejectedValueOnce(new Error('db kapow'))
      .mockResolvedValueOnce({ emailsSent: 1, linkedInQueued: 0, tasksCreated: 0, skipped: 0, bounced: 0, failed: 0, errors: [] })

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await GET(req({ authorization: 'Bearer s3cret' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.usersProcessed).toBe(2)
    expect(json.emailsSent).toBe(1)   // u_good succeeded
    expect(json.errors).toBe(1)        // u_bad's throw counted as one error
    expect(runPendingStepsForUser).toHaveBeenCalledTimes(2)

    consoleSpy.mockRestore()
  })

  it('counts per-user errors in the aggregate but does not abort the loop', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([
      { id: 'u1' }, { id: 'u2' },
    ] as any)
    vi.mocked(runPendingStepsForUser)
      .mockResolvedValueOnce({ emailsSent: 0, linkedInQueued: 0, tasksCreated: 0, skipped: 0, bounced: 0, failed: 0, errors: ['e1', 'e2'] })
      .mockResolvedValueOnce({ emailsSent: 0, linkedInQueued: 0, tasksCreated: 0, skipped: 0, bounced: 0, failed: 0, errors: ['e3'] })

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const res = await GET(req({ authorization: 'Bearer s3cret' }))
    const json = await res.json()
    expect(json.errors).toBe(3)
    expect(runPendingStepsForUser).toHaveBeenCalledTimes(2)

    consoleSpy.mockRestore()
  })

  it('passes a per-user time budget that shrinks as more users are processed', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([
      { id: 'u1' }, { id: 'u2' }, { id: 'u3' }, { id: 'u4' },
    ] as any)
    vi.mocked(runPendingStepsForUser).mockResolvedValue({
      emailsSent: 0, linkedInQueued: 0, tasksCreated: 0, skipped: 0, bounced: 0, failed: 0, errors: [],
    })

    await GET(req({ authorization: 'Bearer s3cret' }))

    // Each call receives a budget; first user has the full pool, later users have less.
    const calls = vi.mocked(runPendingStepsForUser).mock.calls
    expect(calls).toHaveLength(4)
    const budgets = calls.map((c) => (c[2] as any).maxRuntimeMs as number)
    // Sanity: each budget is at least the 5s floor
    expect(budgets.every((b) => b >= 5_000)).toBe(true)
    // First user should see roughly TOTAL/4 = ~13.7s; well below the total ~55s
    expect(budgets[0]).toBeLessThanOrEqual(55_000)
    expect(budgets[0]).toBeGreaterThanOrEqual(10_000)
  })

  it('aggregates deferred counts from the runner', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([
      { id: 'u1' }, { id: 'u2' },
    ] as any)
    vi.mocked(runPendingStepsForUser)
      .mockResolvedValueOnce({ emailsSent: 3, linkedInQueued: 0, tasksCreated: 0, skipped: 0, bounced: 0, failed: 0, errors: [], deferred: 7 })
      .mockResolvedValueOnce({ emailsSent: 1, linkedInQueued: 0, tasksCreated: 0, skipped: 0, bounced: 0, failed: 0, errors: [] })

    const res = await GET(req({ authorization: 'Bearer s3cret' }))
    const json = await res.json()
    expect(json.deferred).toBe(7)
    expect(json.emailsSent).toBe(4)
  })

  it('aggregates bounced + failed counts from the runner', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([
      { id: 'u1' }, { id: 'u2' },
    ] as any)
    vi.mocked(runPendingStepsForUser)
      .mockResolvedValueOnce({ emailsSent: 8, linkedInQueued: 0, tasksCreated: 0, skipped: 0, bounced: 2, failed: 1, errors: ['b1', 'b2', 'f1'] })
      .mockResolvedValueOnce({ emailsSent: 3, linkedInQueued: 0, tasksCreated: 0, skipped: 0, bounced: 0, failed: 0, errors: [] })

    const res = await GET(req({ authorization: 'Bearer s3cret' }))
    const json = await res.json()
    expect(json.bounced).toBe(2)
    expect(json.failed).toBe(1)
    expect(json.emailsSent).toBe(11)
    expect(json.errors).toBe(3)
  })

  it('returns elapsedMs in the response', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([])
    const res = await GET(req({ authorization: 'Bearer s3cret' }))
    const json = await res.json()
    expect(typeof json.elapsedMs).toBe('number')
    expect(json.elapsedMs).toBeGreaterThanOrEqual(0)
  })
})
