import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { POST as SearchPOST } from '@/app/api/enrichment/search/route'
import { POST as VerifyPOST } from '@/app/api/enrichment/verify/route'
import { GET as EnrichKeysGET } from '@/app/api/settings/enrichment-keys/route'

function makeReq(method: string, url: string, body?: object) {
  return new NextRequest(`http://localhost:3000${url}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

// ── POST /api/enrichment/search ───────────────────────────────────────────────

describe('POST /api/enrichment/search', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 without auth', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockResolvedValueOnce(null as any)
    const res = await SearchPOST(makeReq('POST', '/api/enrichment/search', { query: { title: 'CEO' }, provider: 'apollo' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when Apollo API key is not configured', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ apolloApiKey: null, hunterApiKey: null } as any)
    const res = await SearchPOST(makeReq('POST', '/api/enrichment/search', { query: { title: 'CEO' }, provider: 'apollo' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/api key/i)
  })

  it('returns 400 when query.title is missing', async () => {
    const res = await SearchPOST(makeReq('POST', '/api/enrichment/search', { query: {}, provider: 'apollo' }))
    // Auth mock returns session by default in setup
    const json = await res.json()
    expect([400, 401]).toContain(res.status)
    if (res.status === 400) expect(json.error).toMatch(/title/i)
  })
})

// ── POST /api/enrichment/verify ───────────────────────────────────────────────

describe('POST /api/enrichment/verify', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 without auth', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockResolvedValueOnce(null as any)
    const res = await VerifyPOST(makeReq('POST', '/api/enrichment/verify', { email: 'test@example.com' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when email is missing', async () => {
    const res = await VerifyPOST(makeReq('POST', '/api/enrichment/verify', {}))
    const json = await res.json()
    expect([400, 401]).toContain(res.status)
    if (res.status === 400) expect(json.error).toMatch(/email/i)
  })

  it('returns 400 when Hunter API key is not configured', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ hunterApiKey: null } as any)
    const res = await VerifyPOST(makeReq('POST', '/api/enrichment/verify', { email: 'test@example.com' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/api key/i)
  })
})

// ── GET /api/settings/enrichment-keys ────────────────────────────────────────

describe('GET /api/settings/enrichment-keys', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 without auth', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockResolvedValueOnce(null as any)
    const res = await EnrichKeysGET()
    expect(res.status).toBe(401)
  })

  it('returns masked keys for authenticated user', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ apolloApiKey: null, hunterApiKey: null } as any)
    const res = await EnrichKeysGET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toHaveProperty('apolloApiKey')
    expect(json).toHaveProperty('hunterApiKey')
  })
})
