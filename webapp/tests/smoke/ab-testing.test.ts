import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { POST as AbResolvePost } from '@/app/api/marketing/campaigns/[id]/ab-resolve/route'
import { GET as StatsGet } from '@/app/api/marketing/campaigns/[id]/stats/route'

const MOCK_USER_ID = 'user_test_123'

const mockCampaignBase = {
  id: 'camp_ab_1',
  userId: MOCK_USER_ID,
  name: 'A/B Campaign',
  subject: 'Subject A',
  abSubjectB: 'Subject B',
  htmlBody: '<p>Hello</p>',
  fromName: 'Test Sender',
  status: 'ab_testing',
  abEnabled: true,
  abSplitPercent: 20,
  abWinnerMetric: 'open',
  abTestDurationHours: 4,
  abWinner: null,
  abWinnerSentAt: null,
  sentAt: new Date(),
  recipientListId: 'list_1',
  stats: {},
  createdAt: new Date(),
  updatedAt: new Date(),
}

function makeReq(method: string, url: string, body?: object) {
  return new NextRequest(`http://localhost:3000${url}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

// ── POST /api/marketing/campaigns/[id]/ab-resolve ─────────────────────────────

describe('POST /api/marketing/campaigns/[id]/ab-resolve', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 without auth', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockResolvedValueOnce(null as any)
    const mockParams = Promise.resolve({ id: 'camp_ab_1' })
    const res = await AbResolvePost(makeReq('POST', '/api/marketing/campaigns/camp_ab_1/ab-resolve'), { params: mockParams })
    expect(res.status).toBe(401)
  })

  it('returns 404 when campaign not found', async () => {
    vi.mocked(prisma.marketingCampaign.findFirst).mockResolvedValueOnce(null)
    const mockParams = Promise.resolve({ id: 'camp_missing' })
    const res = await AbResolvePost(makeReq('POST', '/api/marketing/campaigns/camp_missing/ab-resolve'), { params: mockParams })
    expect(res.status).toBe(404)
  })

  it('returns 400 when A/B testing not enabled on campaign', async () => {
    vi.mocked(prisma.marketingCampaign.findFirst).mockResolvedValueOnce({
      ...mockCampaignBase,
      abEnabled: false,
      status: 'sent',
      emailAccount: { id: 'ea_1', smtpHost: 'smtp.example.com', smtpPort: 587, smtpUser: 'user', smtpPass: 'pass', email: 'from@example.com' },
    } as any)
    const mockParams = Promise.resolve({ id: 'camp_ab_1' })
    const res = await AbResolvePost(makeReq('POST', '/api/marketing/campaigns/camp_ab_1/ab-resolve'), { params: mockParams })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/A\/B testing not enabled/i)
  })

  it('returns 409 when campaign is not in ab_testing status', async () => {
    vi.mocked(prisma.marketingCampaign.findFirst).mockResolvedValueOnce({
      ...mockCampaignBase,
      status: 'sent',
      emailAccount: { id: 'ea_1', smtpHost: 'smtp.example.com', smtpPort: 587, smtpUser: 'user', smtpPass: 'pass', email: 'from@example.com' },
    } as any)
    const mockParams = Promise.resolve({ id: 'camp_ab_1' })
    const res = await AbResolvePost(makeReq('POST', '/api/marketing/campaigns/camp_ab_1/ab-resolve'), { params: mockParams })
    expect(res.status).toBe(409)
  })

  it('returns pending=true when auto=true and duration not elapsed', async () => {
    vi.mocked(prisma.marketingCampaign.findFirst).mockResolvedValueOnce({
      ...mockCampaignBase,
      abTestDurationHours: 24,
      emailAccount: { id: 'ea_1', smtpHost: 'smtp.example.com', smtpPort: 587, smtpUser: 'user', smtpPass: 'pass', email: 'from@example.com' },
    } as any)

    const recentSentAt = new Date(Date.now() - 1_000 * 60 * 30) // 30 min ago, not 24h
    vi.mocked(prisma.marketingCampaignSend.findMany).mockResolvedValueOnce([
      { id: 's1', abVariant: 'A', status: 'sent', openedAt: null, clickedAt: null, sentAt: recentSentAt, leadId: 'l1' },
    ] as any)

    const url = 'http://localhost:3000/api/marketing/campaigns/camp_ab_1/ab-resolve?auto=true'
    const req = new NextRequest(url, { method: 'POST' })
    const mockParams = Promise.resolve({ id: 'camp_ab_1' })
    const res = await AbResolvePost(req, { params: mockParams })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.pending).toBe(true)
    expect(json.reason).toMatch(/not elapsed/i)
  })
})

// ── GET /api/marketing/campaigns/[id]/stats — A/B breakdown ──────────────────

describe('GET /api/marketing/campaigns/[id]/stats (A/B breakdown)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 without auth', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockResolvedValueOnce(null as any)
    const mockParams = Promise.resolve({ id: 'camp_ab_1' })
    const res = await StatsGet(makeReq('GET', '/api/marketing/campaigns/camp_ab_1/stats'), { params: mockParams })
    expect(res.status).toBe(401)
  })

  it('returns ab field when abEnabled is true', async () => {
    vi.mocked(prisma.marketingCampaign.findFirst).mockResolvedValueOnce({
      ...mockCampaignBase,
      abEnabled: true,
      abWinner: null,
    } as any)

    const sentAt = new Date()
    vi.mocked(prisma.marketingCampaignSend.findMany).mockResolvedValueOnce([
      { id: 's1', abVariant: 'a', status: 'sent', openedAt: sentAt, clickedAt: null, unsubscribedAt: null, leadId: 'l1' },
      { id: 's2', abVariant: 'a', status: 'sent', openedAt: null,   clickedAt: null, unsubscribedAt: null, leadId: 'l2' },
      { id: 's3', abVariant: 'b', status: 'sent', openedAt: sentAt, clickedAt: sentAt, unsubscribedAt: null, leadId: 'l3' },
      { id: 's4', abVariant: 'b', status: 'sent', openedAt: sentAt, clickedAt: null, unsubscribedAt: null, leadId: 'l4' },
    ] as any)

    const mockParams = Promise.resolve({ id: 'camp_ab_1' })
    const res = await StatsGet(makeReq('GET', '/api/marketing/campaigns/camp_ab_1/stats'), { params: mockParams })
    expect(res.status).toBe(200)
    const json = await res.json()

    expect(json.ab).toBeDefined()
    expect(json.ab.enabled).toBe(true)
    expect(json.ab.variantA.sent).toBe(2)
    expect(json.ab.variantA.opened).toBe(1)
    expect(json.ab.variantA.openRate).toBe(0.5)
    expect(json.ab.variantB.sent).toBe(2)
    expect(json.ab.variantB.opened).toBe(2)
    expect(json.ab.variantB.openRate).toBe(1.0)
    expect(json.ab.winner).toBeNull()
    expect(json.ab.remainingSent).toBe(0)
  })

  it('does NOT return ab field when abEnabled is false', async () => {
    vi.mocked(prisma.marketingCampaign.findFirst).mockResolvedValueOnce({
      ...mockCampaignBase,
      abEnabled: false,
      status: 'sent',
    } as any)

    vi.mocked(prisma.marketingCampaignSend.findMany).mockResolvedValueOnce([
      { id: 's1', abVariant: null, status: 'sent', openedAt: null, clickedAt: null, unsubscribedAt: null },
    ] as any)

    const mockParams = Promise.resolve({ id: 'camp_ab_1' })
    const res = await StatsGet(makeReq('GET', '/api/marketing/campaigns/camp_ab_1/stats'), { params: mockParams })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ab).toBeUndefined()
  })
})
