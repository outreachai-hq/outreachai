import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// ── Route handlers under test ──────────────────────────────────────────────
import { GET as linkedinInitiate } from '@/app/api/auth/linkedin/route'
import { GET as linkedinCallback } from '@/app/api/auth/linkedin/callback/route'
import { GET as linkedinStatus } from '@/app/api/auth/linkedin/status/route'
import { POST as linkedinDisconnect } from '@/app/api/auth/linkedin/disconnect/route'

// ── Helpers ────────────────────────────────────────────────────────────────
function makeGet(url: string) {
  return new NextRequest(url, { method: 'GET' })
}

const mockSession = {
  user: { id: 'user_test_123', email: 'test@example.com', name: 'Test User' },
  expires: '',
} as any

// ── Tests ──────────────────────────────────────────────────────────────────

describe('GET /api/auth/linkedin', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as any)
    const res = await linkedinInitiate()
    expect(res.status).toBe(401)
  })

  it('redirects to settings with not_configured when user has no BYO LinkedIn credentials', async () => {
    vi.mocked(auth).mockResolvedValueOnce(mockSession)
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      linkedInClientId: null,
      linkedInClientSecret: null,
    } as any)
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
    const res = await linkedinInitiate()
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('linkedin_error=not_configured')
  })

  it('redirects to LinkedIn OAuth when user has saved BYO credentials', async () => {
    vi.mocked(auth).mockResolvedValueOnce(mockSession)
    // safeDecrypt() returns the input string verbatim for our mock; that's fine.
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      linkedInClientId: 'enc:my-client-id',
      linkedInClientSecret: 'enc:my-client-secret',
    } as any)
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
    const res = await linkedinInitiate()
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('linkedin.com/oauth/v2/authorization')
  })
})

describe('GET /api/auth/linkedin/status', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as any)
    const res = await linkedinStatus()
    expect(res.status).toBe(401)
  })

  it('returns configured: false when LINKEDIN_CLIENT_ID not set', async () => {
    vi.mocked(auth).mockResolvedValueOnce(mockSession)
    vi.mocked(prisma.linkedInAccount.findFirst).mockResolvedValueOnce(null)
    const savedId = process.env.LINKEDIN_CLIENT_ID
    delete process.env.LINKEDIN_CLIENT_ID
    const res = await linkedinStatus()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.configured).toBe(false)
    process.env.LINKEDIN_CLIENT_ID = savedId
  })

  it('returns connected: false when no account linked', async () => {
    vi.mocked(auth).mockResolvedValueOnce(mockSession)
    vi.mocked(prisma.linkedInAccount.findFirst).mockResolvedValueOnce(null)
    const res = await linkedinStatus()
    const json = await res.json()
    expect(json.connected).toBe(false)
    expect(json.account).toBeNull()
  })
})

describe('GET /api/auth/linkedin/callback', () => {
  beforeEach(() => vi.clearAllMocks())

  it('redirects to settings with error when code is missing', async () => {
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
    const req = makeGet('http://localhost:3000/api/auth/linkedin/callback?state=abc')
    const res = await linkedinCallback(req)
    expect(res.status).toBeGreaterThanOrEqual(300)
    expect(res.status).toBeLessThan(400)
    const location = res.headers.get('location') ?? ''
    expect(location).toContain('linkedin_error')
  })

  it('redirects to settings with error when state is missing', async () => {
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
    const req = makeGet('http://localhost:3000/api/auth/linkedin/callback?code=abc123')
    const res = await linkedinCallback(req)
    expect(res.status).toBeGreaterThanOrEqual(300)
    expect(res.status).toBeLessThan(400)
    const location = res.headers.get('location') ?? ''
    expect(location).toContain('linkedin_error')
  })

  it('redirects to settings with error when LinkedIn returns error param', async () => {
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
    const req = makeGet('http://localhost:3000/api/auth/linkedin/callback?error=access_denied')
    const res = await linkedinCallback(req)
    expect(res.status).toBeGreaterThanOrEqual(300)
    expect(res.status).toBeLessThan(400)
    const location = res.headers.get('location') ?? ''
    expect(location).toContain('linkedin_error')
  })
})

describe('POST /api/auth/linkedin/disconnect', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as any)
    const res = await linkedinDisconnect()
    expect(res.status).toBe(401)
  })

  it('returns { ok: true } and deletes OAuth accounts when authenticated', async () => {
    vi.mocked(auth).mockResolvedValueOnce(mockSession)
    vi.mocked(prisma.linkedInAccount.deleteMany).mockResolvedValueOnce({ count: 1 })
    const res = await linkedinDisconnect()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(prisma.linkedInAccount.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user_test_123', linkedInMemberId: { not: null } },
    })
  })

  it('returns { ok: true } even when no accounts exist (idempotent)', async () => {
    vi.mocked(auth).mockResolvedValueOnce(mockSession)
    vi.mocked(prisma.linkedInAccount.deleteMany).mockResolvedValueOnce({ count: 0 })
    const res = await linkedinDisconnect()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
  })
})
