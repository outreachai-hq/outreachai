import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

import { GET as listCampaigns, POST as createCampaign } from '@/app/api/marketing/campaigns/route'
import { GET as trackOpen } from '@/app/api/marketing/track/open/route'
import { GET as trackClick } from '@/app/api/marketing/track/click/route'
import { GET as unsubscribeGet } from '@/app/api/marketing/unsubscribe/route'

const MOCK_USER_ID = 'user_test_123'

const mockCampaign = {
  id: 'mc_1',
  userId: MOCK_USER_ID,
  name: 'Summer Sale',
  subject: 'Big deals inside',
  htmlBody: '<p>Hello {{firstName}}</p>',
  fromName: 'Marketing Team',
  emailAccountId: 'ea_1',
  recipientListId: 'll_1',
  status: 'draft',
  scheduledAt: null,
  sentAt: null,
  stats: {},
  createdAt: new Date(),
  updatedAt: new Date(),
  _count: { sends: 0 },
  emailAccount: { id: 'ea_1', name: 'SMTP Acct', email: 'send@example.com' },
  leadList: { id: 'll_1', name: 'Newsletter List' },
}

function makeRequest(method: string, url: string, body?: object) {
  return new NextRequest(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

// ---- GET /api/marketing/campaigns ----

describe('GET /api/marketing/campaigns', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 without auth', async () => {
    // Override auth to return null for this test
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockResolvedValueOnce(null as any)

    const req = makeRequest('GET', 'http://localhost:3000/api/marketing/campaigns')
    const res = await listCampaigns(req)
    expect(res.status).toBe(401)
  })

  it('returns campaigns list for authed user', async () => {
    vi.mocked(prisma.marketingCampaign.findMany).mockResolvedValueOnce([mockCampaign] as any)
    const req = makeRequest('GET', 'http://localhost:3000/api/marketing/campaigns')
    const res = await listCampaigns(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toHaveLength(1)
    expect(json[0].name).toBe('Summer Sale')
  })
})

// ---- POST /api/marketing/campaigns ----

describe('POST /api/marketing/campaigns', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 if required fields are missing', async () => {
    const req = makeRequest('POST', 'http://localhost:3000/api/marketing/campaigns', {
      name: 'Incomplete Campaign',
      // missing subject, htmlBody, fromName, emailAccountId, recipientListId
    })
    const res = await createCampaign(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/required/)
  })

  it('returns 400 if emailAccountId is missing', async () => {
    const req = makeRequest('POST', 'http://localhost:3000/api/marketing/campaigns', {
      name: 'Test',
      subject: 'Hello',
      htmlBody: '<p>Hi</p>',
      fromName: 'Team',
      recipientListId: 'll_1',
      // emailAccountId missing
    })
    const res = await createCampaign(req)
    expect(res.status).toBe(400)
  })

  it('creates a campaign when all fields present', async () => {
    vi.mocked(prisma.emailAccount.findFirst).mockResolvedValueOnce({ id: 'ea_1' } as any)
    vi.mocked(prisma.leadList.findFirst).mockResolvedValueOnce({ id: 'll_1' } as any)
    vi.mocked(prisma.marketingCampaign.create).mockResolvedValueOnce(mockCampaign as any)

    const req = makeRequest('POST', 'http://localhost:3000/api/marketing/campaigns', {
      name: 'Summer Sale',
      subject: 'Big deals inside',
      htmlBody: '<p>Hello</p>',
      fromName: 'Marketing Team',
      emailAccountId: 'ea_1',
      recipientListId: 'll_1',
    })
    const res = await createCampaign(req)
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.name).toBe('Summer Sale')
    expect(json.status).toBe('draft')
  })
})

// ---- GET /api/marketing/track/open ----

describe('GET /api/marketing/track/open', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns image/gif content-type', async () => {
    vi.mocked(prisma.marketingCampaignSend.findUnique).mockResolvedValueOnce(null)
    const req = makeRequest('GET', 'http://localhost:3000/api/marketing/track/open?sid=nonexistent')
    const res = await trackOpen(req)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('image/gif')
  })

  it('returns image/gif even with no sid param', async () => {
    const req = makeRequest('GET', 'http://localhost:3000/api/marketing/track/open')
    const res = await trackOpen(req)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('image/gif')
  })

  it('marks send as opened when sid is valid and openedAt is null', async () => {
    const mockSend = { id: 'send_1', trackingId: 'tid_abc', openedAt: null }
    vi.mocked(prisma.marketingCampaignSend.findUnique).mockResolvedValueOnce(mockSend as any)
    vi.mocked(prisma.marketingCampaignSend.update).mockResolvedValueOnce({ ...mockSend, openedAt: new Date() } as any)

    const req = makeRequest('GET', 'http://localhost:3000/api/marketing/track/open?sid=tid_abc')
    const res = await trackOpen(req)
    expect(res.status).toBe(200)
    expect(prisma.marketingCampaignSend.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { trackingId: 'tid_abc' } })
    )
  })
})

// ---- GET /api/marketing/track/click ----

describe('GET /api/marketing/track/click', () => {
  beforeEach(() => vi.clearAllMocks())

  it('redirects to / when no url param', async () => {
    vi.mocked(prisma.marketingCampaignSend.findUnique).mockResolvedValueOnce(null)
    const req = makeRequest('GET', 'http://localhost:3000/api/marketing/track/click?sid=tid_abc')
    const res = await trackClick(req)
    expect(res.status).toBe(307)
    // Falls back to NEXT_PUBLIC_APP_URL/ or localhost:3000/
    expect(res.headers.get('Location')).toMatch(/\/$/)
  })

  it('redirects to the target url for a known tracking id', async () => {
    vi.mocked(prisma.marketingCampaignSend.findUnique).mockResolvedValueOnce(
      { trackingId: 'tid_abc', clickedAt: new Date() } as never,
    )
    const target = encodeURIComponent('https://example.com/promo')
    const req = makeRequest('GET', `http://localhost:3000/api/marketing/track/click?sid=tid_abc&url=${target}`)
    const res = await trackClick(req)
    expect(res.status).toBe(307)
    expect(res.headers.get('Location')).toBe('https://example.com/promo')
  })

  it('does not act as an open redirect for unknown tracking ids', async () => {
    vi.mocked(prisma.marketingCampaignSend.findUnique).mockResolvedValueOnce(null)
    const target = encodeURIComponent('https://evil.example.com/phish')
    const req = makeRequest('GET', `http://localhost:3000/api/marketing/track/click?sid=forged&url=${target}`)
    const res = await trackClick(req)
    expect(res.status).toBe(307)
    expect(res.headers.get('Location')).not.toContain('evil.example.com')
  })
})

// ---- GET /api/marketing/unsubscribe ----

describe('GET /api/marketing/unsubscribe', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns HTML page (not 500) with invalid sid', async () => {
    vi.mocked(prisma.marketingCampaignSend.findUnique).mockResolvedValueOnce(null)
    const req = makeRequest('GET', 'http://localhost:3000/api/marketing/unsubscribe?sid=bad_sid')
    const res = await unsubscribeGet(req)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('text/html')
  })

  it('returns HTML confirmation page with no sid', async () => {
    const req = makeRequest('GET', 'http://localhost:3000/api/marketing/unsubscribe')
    const res = await unsubscribeGet(req)
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('Unsubscribed')
  })

  it('processes valid unsubscribe and returns HTML', async () => {
    const mockSend = {
      id: 'send_1',
      trackingId: 'tid_valid',
      leadEmail: 'user@example.com',
      unsubscribedAt: null,
      campaign: { userId: MOCK_USER_ID },
    }
    vi.mocked(prisma.marketingCampaignSend.findUnique).mockResolvedValueOnce(mockSend as any)
    vi.mocked(prisma.marketingCampaignSend.update).mockResolvedValueOnce({ ...mockSend, unsubscribedAt: new Date() } as any)
    vi.mocked(prisma.unsubscribe.upsert).mockResolvedValueOnce({} as any)

    const req = makeRequest('GET', 'http://localhost:3000/api/marketing/unsubscribe?sid=tid_valid')
    const res = await unsubscribeGet(req)
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('user@example.com')
  })
})
