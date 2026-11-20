import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// ── Route handlers under test ──────────────────────────────────────────────
import { POST as publishPost } from '@/app/api/linkedin-posts/publish/route'
import { GET as settingsGet, POST as settingsPost } from '@/app/api/linkedin-posts/settings/route'
import { GET as cronGet } from '@/app/api/cron/linkedin-publish/route'

// ── Helpers ────────────────────────────────────────────────────────────────
function makePost(url: string, headers: Record<string, string> = {}) {
  return new NextRequest(url, { method: 'POST', headers })
}
function makeGet(url: string, headers: Record<string, string> = {}) {
  return new NextRequest(url, { method: 'GET', headers })
}

const mockSession = {
  user: { id: 'user_test_123', email: 'test@example.com', name: 'Test User' },
  expires: '',
} as any

// ── Mock linkedin-publisher so tests stay unit-level ───────────────────────
vi.mock('@/lib/linkedin-publisher', () => ({
  runLinkedInPublisher: vi.fn().mockResolvedValue({ published: 0, failed: 0, skipped: 0 }),
}))

// ── Tests ──────────────────────────────────────────────────────────────────

describe('POST /api/linkedin-posts/publish', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.CRON_SECRET
  })

  it('returns 401 when not authenticated and no cron secret', async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as any)
    const req = makePost('http://localhost:3000/api/linkedin-posts/publish')
    const res = await publishPost(req)
    expect(res.status).toBe(401)
  })

  it('returns 401 when wrong cron secret is provided', async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as any)
    process.env.CRON_SECRET = 'correct-secret'
    const req = makePost('http://localhost:3000/api/linkedin-posts/publish', {
      'x-cron-secret': 'wrong-secret',
    })
    const res = await publishPost(req)
    expect(res.status).toBe(401)
  })

  it('succeeds with correct cron secret (no user session needed)', async () => {
    // Auth is NOT called when a valid cron secret is provided — do not mock it
    process.env.CRON_SECRET = 'my-secret'
    const req = makePost('http://localhost:3000/api/linkedin-posts/publish', {
      'x-cron-secret': 'my-secret',
    })
    const res = await publishPost(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toHaveProperty('published')
  })

  it('succeeds when authenticated user calls it', async () => {
    vi.mocked(auth).mockResolvedValueOnce(mockSession)
    const req = makePost('http://localhost:3000/api/linkedin-posts/publish')
    const res = await publishPost(req)
    expect(res.status).toBe(200)
  })
})

describe('GET /api/linkedin-posts/settings', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as any)
    const res = await settingsGet()
    expect(res.status).toBe(401)
  })

  it('returns hour and timezone for authenticated user', async () => {
    vi.mocked(auth).mockResolvedValueOnce(mockSession)
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      linkedInPostHour: 9,
      linkedInPostTz: 'UTC',
    } as any)
    const res = await settingsGet()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.hour).toBe(9)
    expect(json.timezone).toBe('UTC')
  })
})

describe('POST /api/linkedin-posts/settings', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as any)
    const req = new NextRequest('http://localhost:3000/api/linkedin-posts/settings', {
      method: 'POST',
      body: JSON.stringify({ hour: 9, timezone: 'UTC' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await settingsPost(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 when hour is out of range (25)', async () => {
    vi.mocked(auth).mockResolvedValueOnce(mockSession)
    const req = new NextRequest('http://localhost:3000/api/linkedin-posts/settings', {
      method: 'POST',
      body: JSON.stringify({ hour: 25, timezone: 'UTC' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await settingsPost(req)
    expect(res.status).toBe(400)
  })

  it('returns 200 with valid hour=9 and timezone=UTC', async () => {
    vi.mocked(auth).mockResolvedValueOnce(mockSession)
    vi.mocked(prisma.user.update).mockResolvedValueOnce({
      linkedInPostHour: 9,
      linkedInPostTz: 'UTC',
    } as any)
    const req = new NextRequest('http://localhost:3000/api/linkedin-posts/settings', {
      method: 'POST',
      body: JSON.stringify({ hour: 9, timezone: 'UTC' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await settingsPost(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.hour).toBe(9)
    expect(json.timezone).toBe('UTC')
  })
})

describe('GET /api/cron/linkedin-publish', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.CRON_SECRET
  })

  it('returns 401 without authorization header', async () => {
    process.env.CRON_SECRET = 'some-secret'
    const req = makeGet('http://localhost:3000/api/cron/linkedin-publish')
    const res = await cronGet(req)
    expect(res.status).toBe(401)
  })

  it('returns 401 with wrong Bearer token', async () => {
    process.env.CRON_SECRET = 'correct'
    const req = makeGet('http://localhost:3000/api/cron/linkedin-publish', {
      authorization: 'Bearer wrong',
    })
    const res = await cronGet(req)
    expect(res.status).toBe(401)
  })

  it('returns 200 with correct Bearer token', async () => {
    process.env.CRON_SECRET = 'correct'
    const req = makeGet('http://localhost:3000/api/cron/linkedin-publish', {
      authorization: 'Bearer correct',
    })
    const res = await cronGet(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
  })
})
