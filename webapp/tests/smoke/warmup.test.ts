import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { GET, POST } from '@/app/api/warmup/route'
import { PATCH, DELETE } from '@/app/api/warmup/[id]/route'
import { GET as StatsGET } from '@/app/api/warmup/stats/route'

const MOCK_USER_ID = 'user_test_123'

const mockEmailAccount = {
  id: 'ea_1',
  name: 'Test Account',
  email: 'test@example.com',
  userId: MOCK_USER_ID,
}

const mockWarmupAccount = {
  id: 'wa_1',
  userId: MOCK_USER_ID,
  emailAccountId: 'ea_1',
  status: 'active',
  dailyTarget: 5,
  currentDay: 3,
  totalSent: 12,
  totalReceived: 0,
  totalReplied: 0,
  startedAt: new Date(),
  lastRunAt: null,
  createdAt: new Date(),
  emailAccount: mockEmailAccount,
}

function makeReq(method: string, url: string, body?: object) {
  return new NextRequest(`http://localhost:3000${url}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

// ── GET /api/warmup ───────────────────────────────────────────────────────────

describe('GET /api/warmup', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 without auth', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockResolvedValueOnce(null as any)
    const res = await GET(makeReq('GET', '/api/warmup'))
    expect(res.status).toBe(401)
  })

  it('returns warmup accounts for authenticated user', async () => {
    vi.mocked(prisma.warmupAccount.findMany).mockResolvedValueOnce([mockWarmupAccount] as any)
    const res = await GET(makeReq('GET', '/api/warmup'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.accounts).toHaveLength(1)
    expect(json.accounts[0].emailAccount.email).toBe('test@example.com')
  })
})

// ── POST /api/warmup ──────────────────────────────────────────────────────────

describe('POST /api/warmup', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 when emailAccountId is missing', async () => {
    const res = await POST(makeReq('POST', '/api/warmup', {}))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/emailAccountId/i)
  })

  it('returns 404 when email account does not belong to user', async () => {
    vi.mocked(prisma.emailAccount.findFirst).mockResolvedValueOnce(null)
    const res = await POST(makeReq('POST', '/api/warmup', { emailAccountId: 'ea_other' }))
    expect(res.status).toBe(404)
  })

  it('returns 409 when account is already enrolled', async () => {
    vi.mocked(prisma.emailAccount.findFirst).mockResolvedValueOnce(mockEmailAccount as any)
    vi.mocked(prisma.warmupAccount.findUnique).mockResolvedValueOnce(mockWarmupAccount as any)
    const res = await POST(makeReq('POST', '/api/warmup', { emailAccountId: 'ea_1' }))
    expect(res.status).toBe(409)
  })

  it('creates a warmup account and returns 201', async () => {
    vi.mocked(prisma.emailAccount.findFirst).mockResolvedValueOnce(mockEmailAccount as any)
    vi.mocked(prisma.warmupAccount.findUnique).mockResolvedValueOnce(null)
    vi.mocked(prisma.warmupAccount.create).mockResolvedValueOnce(mockWarmupAccount as any)
    const res = await POST(makeReq('POST', '/api/warmup', { emailAccountId: 'ea_1', dailyTarget: 5 }))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.account.emailAccount.email).toBe('test@example.com')
  })
})

// ── GET /api/warmup/stats ─────────────────────────────────────────────────────

describe('GET /api/warmup/stats', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 without auth', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockResolvedValueOnce(null as any)
    const res = await StatsGET(makeReq('GET', '/api/warmup/stats'))
    expect(res.status).toBe(401)
  })

  it('returns aggregated stats', async () => {
    // The stats route calls findMany independently of the GET /api/warmup mock
    vi.mocked(prisma.warmupAccount.findMany).mockResolvedValueOnce([
      { status: 'active', totalSent: 10, totalReceived: 5, totalReplied: 2 },
      { status: 'paused', totalSent: 3,  totalReceived: 1, totalReplied: 0 },
    ] as any)

    const res = await StatsGET(makeReq('GET', '/api/warmup/stats'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.totalSent).toBe(13)
    expect(json.activeCount).toBe(1)
    expect(json.totalAccounts).toBe(2)
  })
})

// ── PATCH /api/warmup/[id] ────────────────────────────────────────────────────

describe('PATCH /api/warmup/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 for invalid status value', async () => {
    const mockParams = Promise.resolve({ id: 'wa_1' })
    const res = await PATCH(makeReq('PATCH', '/api/warmup/wa_1', { status: 'invalid' }), { params: mockParams })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/status/i)
  })

  it('returns 404 when warmup account not found', async () => {
    vi.mocked(prisma.warmupAccount.findFirst).mockResolvedValueOnce(null)
    const mockParams = Promise.resolve({ id: 'wa_missing' })
    const res = await PATCH(makeReq('PATCH', '/api/warmup/wa_missing', { status: 'paused' }), { params: mockParams })
    expect(res.status).toBe(404)
  })

  it('updates status successfully', async () => {
    vi.mocked(prisma.warmupAccount.findFirst).mockResolvedValueOnce(mockWarmupAccount as any)
    vi.mocked(prisma.warmupAccount.update).mockResolvedValueOnce({ ...mockWarmupAccount, status: 'paused' } as any)
    const mockParams = Promise.resolve({ id: 'wa_1' })
    const res = await PATCH(makeReq('PATCH', '/api/warmup/wa_1', { status: 'paused' }), { params: mockParams })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.account.status).toBe('paused')
  })
})

// ── DELETE /api/warmup/[id] ───────────────────────────────────────────────────

describe('DELETE /api/warmup/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes a warmup account', async () => {
    vi.mocked(prisma.warmupAccount.deleteMany).mockResolvedValueOnce({ count: 1 })
    const mockParams = Promise.resolve({ id: 'wa_1' })
    const res = await DELETE(makeReq('DELETE', '/api/warmup/wa_1'), { params: mockParams })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
  })
})
