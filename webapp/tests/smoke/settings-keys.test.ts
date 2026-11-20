import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

import { GET as getEnrichmentKeys, POST as saveEnrichmentKeys } from '@/app/api/settings/enrichment-keys/route'
import { GET as getLinkedInSettings, POST as saveLinkedInSettings } from '@/app/api/linkedin-posts/settings/route'

vi.mock('@/lib/encryption', () => ({
  encrypt:     (v: string) => `enc:${v}`,
  decrypt:     (v: string) => v.replace('enc:', ''),
  safeDecrypt: (v: string | null) => v ? v.replace('enc:', '') : null,
}))

function makeReq(method: string, body?: unknown) {
  return new NextRequest('http://localhost/api/test', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

const mockSession = { user: { id: 'user_test_123', email: 'test@example.com', name: 'Test User' } }

// ─── Enrichment Keys ──────────────────────────────────────────────────────────

describe('GET /api/settings/enrichment-keys', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as any)
    const res = await getEnrichmentKeys()
    expect(res.status).toBe(401)
  })

  it('returns masked keys when set', async () => {
    vi.mocked(auth).mockResolvedValueOnce(mockSession as any)
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      apolloApiKey: 'enc:myapollokey12345',
      hunterApiKey: null,
    } as any)
    const res = await getEnrichmentKeys()
    expect(res.status).toBe(200)
    const json = await res.json()
    // Apollo key is set — should be masked (last 4 chars visible)
    expect(json.apolloApiKey).toMatch(/^\*+\d{4}$|^.{4,}$/)
    // Hunter key is null — should return null
    expect(json.hunterApiKey).toBeNull()
  })

  it('returns null for both keys when none set', async () => {
    vi.mocked(auth).mockResolvedValueOnce(mockSession as any)
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      apolloApiKey: null, hunterApiKey: null,
    } as any)
    const res = await getEnrichmentKeys()
    const json = await res.json()
    expect(json.apolloApiKey).toBeNull()
    expect(json.hunterApiKey).toBeNull()
  })
})

describe('POST /api/settings/enrichment-keys', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as any)
    const res = await saveEnrichmentKeys(makeReq('POST', { apolloApiKey: 'key123' }))
    expect(res.status).toBe(401)
  })

  it('saves Apollo key when provided', async () => {
    vi.mocked(auth).mockResolvedValueOnce(mockSession as any)
    vi.mocked(prisma.user.update).mockResolvedValueOnce({} as any)
    const res = await saveEnrichmentKeys(makeReq('POST', { apolloApiKey: 'apollo_key_123' }))
    expect(res.status).toBe(200)
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ apolloApiKey: expect.stringContaining('enc:') }),
    }))
  })

  it('saves Hunter key when provided', async () => {
    vi.mocked(auth).mockResolvedValueOnce(mockSession as any)
    vi.mocked(prisma.user.update).mockResolvedValueOnce({} as any)
    const res = await saveEnrichmentKeys(makeReq('POST', { hunterApiKey: 'hunter_key_456' }))
    expect(res.status).toBe(200)
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ hunterApiKey: expect.stringContaining('enc:') }),
    }))
  })
})

// ─── LinkedIn Post Settings ───────────────────────────────────────────────────

describe('GET /api/linkedin-posts/settings', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as any)
    const res = await getLinkedInSettings()
    expect(res.status).toBe(401)
  })

  it('returns current hour and timezone', async () => {
    vi.mocked(auth).mockResolvedValueOnce(mockSession as any)
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      linkedInPostHour: 9, linkedInPostTz: 'America/New_York',
    } as any)
    const res = await getLinkedInSettings()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.hour).toBe(9)
    expect(json.timezone).toBe('America/New_York')
  })
})

describe('POST /api/linkedin-posts/settings', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as any)
    const res = await saveLinkedInSettings(makeReq('POST', { hour: 9, timezone: 'UTC' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 for hour < 0', async () => {
    vi.mocked(auth).mockResolvedValueOnce(mockSession as any)
    const res = await saveLinkedInSettings(makeReq('POST', { hour: -1, timezone: 'UTC' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for hour > 23', async () => {
    vi.mocked(auth).mockResolvedValueOnce(mockSession as any)
    const res = await saveLinkedInSettings(makeReq('POST', { hour: 24, timezone: 'UTC' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for non-integer hour', async () => {
    vi.mocked(auth).mockResolvedValueOnce(mockSession as any)
    const res = await saveLinkedInSettings(makeReq('POST', { hour: 9.5, timezone: 'UTC' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid IANA timezone', async () => {
    vi.mocked(auth).mockResolvedValueOnce(mockSession as any)
    const res = await saveLinkedInSettings(makeReq('POST', { hour: 9, timezone: 'Fake/Zone' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/invalid.*timezone/i)
  })

  it('saves valid hour and timezone', async () => {
    vi.mocked(auth).mockResolvedValueOnce(mockSession as any)
    vi.mocked(prisma.user.update).mockResolvedValueOnce({
      linkedInPostHour: 14, linkedInPostTz: 'Europe/London',
    } as any)
    const res = await saveLinkedInSettings(makeReq('POST', { hour: 14, timezone: 'Europe/London' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.hour).toBe(14)
    expect(json.timezone).toBe('Europe/London')
  })

  it('accepts all boundary hours (0 and 23)', async () => {
    for (const hour of [0, 23]) {
      vi.mocked(auth).mockResolvedValueOnce(mockSession as any)
      vi.mocked(prisma.user.update).mockResolvedValueOnce({
        linkedInPostHour: hour, linkedInPostTz: 'UTC',
      } as any)
      const res = await saveLinkedInSettings(makeReq('POST', { hour, timezone: 'UTC' }))
      expect(res.status).toBe(200)
    }
  })
})
