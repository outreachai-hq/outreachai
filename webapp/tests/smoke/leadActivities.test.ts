// Plan 4 (Iter 23) — smoke tests for the per-lead and company activity routes.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/lib/prisma'

import { GET as getLeadActivities, POST as postLeadActivity } from '@/app/api/leads/[id]/activities/route'
import { GET as getCompanyActivities } from '@/app/api/companies/[id]/activities/route'

function mkReq(url: string, init?: RequestInit) {
  return new Request(url, init) as unknown as Parameters<typeof getLeadActivities>[0]
}

describe('GET /api/leads/[id]/activities', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 404 if the lead does not belong to the user', async () => {
    vi.mocked(prisma.lead.findFirst).mockResolvedValue(null)
    const res = await getLeadActivities(
      mkReq('http://x/api/leads/abc/activities'),
      { params: Promise.resolve({ id: 'abc' }) }
    )
    expect(res.status).toBe(404)
  })

  it('returns activities when the lead is owned', async () => {
    vi.mocked(prisma.lead.findFirst).mockResolvedValue({ id: 'lead_1' } as any)
    vi.mocked(prisma.leadActivity.findMany).mockResolvedValue([
      { id: 'a1', type: 'email.sent', title: 'Sent email', body: null, occurredAt: new Date(), createdAt: new Date() },
    ] as any)
    const res = await getLeadActivities(
      mkReq('http://x/api/leads/lead_1/activities'),
      { params: Promise.resolve({ id: 'lead_1' }) }
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.activities).toHaveLength(1)
    expect(data.activities[0].type).toBe('email.sent')
  })

  it('caps limit at 500', async () => {
    vi.mocked(prisma.lead.findFirst).mockResolvedValue({ id: 'lead_1' } as any)
    vi.mocked(prisma.leadActivity.findMany).mockResolvedValue([])
    await getLeadActivities(
      mkReq('http://x/api/leads/lead_1/activities?limit=10000'),
      { params: Promise.resolve({ id: 'lead_1' }) }
    )
    expect(vi.mocked(prisma.leadActivity.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ take: 500 })
    )
  })
})

describe('POST /api/leads/[id]/activities', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects empty body', async () => {
    vi.mocked(prisma.lead.findFirst).mockResolvedValue({ id: 'lead_1' } as any)
    const res = await postLeadActivity(
      mkReq('http://x/api/leads/lead_1/activities', {
        method: 'POST',
        body: JSON.stringify({ body: '   ' }),
      }),
      { params: Promise.resolve({ id: 'lead_1' }) }
    )
    expect(res.status).toBe(400)
  })

  it('creates a note activity for an owned lead', async () => {
    vi.mocked(prisma.lead.findFirst).mockResolvedValue({ id: 'lead_1' } as any)
    // emitActivity will resolve companyId via lead.findUnique
    vi.mocked(prisma.lead.findUnique).mockResolvedValue({ companyId: null } as any)
    vi.mocked(prisma.leadActivity.create).mockResolvedValue({ id: 'la_1', type: 'note.added' } as any)
    const res = await postLeadActivity(
      mkReq('http://x/api/leads/lead_1/activities', {
        method: 'POST',
        body: JSON.stringify({ body: 'spoke with them on the phone' }),
      }),
      { params: Promise.resolve({ id: 'lead_1' }) }
    )
    expect(res.status).toBe(201)
    expect(vi.mocked(prisma.leadActivity.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'note.added',
          body: 'spoke with them on the phone',
          leadId: 'lead_1',
        }),
      })
    )
  })
})

describe('GET /api/companies/[id]/activities', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 404 when the company is not owned', async () => {
    vi.mocked(prisma.company.findFirst).mockResolvedValue(null)
    const res = await getCompanyActivities(
      mkReq('http://x/api/companies/c1/activities'),
      { params: Promise.resolve({ id: 'c1' }) }
    )
    expect(res.status).toBe(404)
  })

  it('returns rollup activities for an owned company', async () => {
    vi.mocked(prisma.company.findFirst).mockResolvedValue({ id: 'c1' } as any)
    vi.mocked(prisma.leadActivity.findMany).mockResolvedValue([
      { id: 'a1', type: 'email.sent', title: 'Sent email', occurredAt: new Date() },
      { id: 'a2', type: 'note.added', title: 'Note added', occurredAt: new Date() },
    ] as any)
    const res = await getCompanyActivities(
      mkReq('http://x/api/companies/c1/activities'),
      { params: Promise.resolve({ id: 'c1' }) }
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.activities).toHaveLength(2)
    expect(vi.mocked(prisma.leadActivity.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: 'c1' } })
    )
  })
})
