import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { GET as listCompanies, POST as createCompany } from '@/app/api/companies/route'
import { GET as getCompany, PATCH as patchCompany, DELETE as deleteCompany } from '@/app/api/companies/[id]/route'

const USER = 'user_test_123'
const mockSession = { user: { id: USER, email: 'me@x.com', name: 'Me' } } as any

function listReq(qs = '') {
  return new NextRequest(`http://localhost:3000/api/companies${qs ? `?${qs}` : ''}`, { method: 'GET' })
}
function postReq(body: object) {
  return new NextRequest('http://localhost:3000/api/companies', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
}
function patchReq(body: object) {
  return new NextRequest('http://localhost:3000/api/companies/cmp_1', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
}

const ctx1 = { params: Promise.resolve({ id: 'cmp_1' }) }

function company(over: Partial<{ id: string; name: string; industry: string | null; country: string | null }> = {}) {
  return {
    id: over.id ?? 'cmp_1',
    userId: USER,
    name: over.name ?? 'Stripe',
    normalizedName: 'stripe',
    domain: 'stripe.com',
    websiteUrl: 'https://stripe.com',
    linkedinUrl: null,
    industry: over.industry ?? 'fintech',
    market: null, type: null, size: null,
    employeeCount: null, foundedYear: null,
    city: null, state: null, region: null, country: over.country ?? 'US',
    technologies: [], lastFundingDate: null, lastFundingAmount: null, lastFundingStage: null,
    notes: null, tags: [],
    contactCount: 0, leadCount: 0, lastActivityAt: null,
    createdAt: new Date(), updatedAt: new Date(),
  }
}

// ─── GET /api/companies ──────────────────────────────────────────────────────

describe('GET /api/companies', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue(mockSession)
  })

  it('401s when not authenticated', async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as any)
    const res = await listCompanies(listReq())
    expect(res.status).toBe(401)
  })

  it('returns the user’s companies', async () => {
    vi.mocked(prisma.company.findMany).mockResolvedValueOnce([company(), company({ id: 'cmp_2', name: 'OpenAI' })] as any)
    const res = await listCompanies(listReq())
    expect(res.status).toBe(200)
    const j = await res.json()
    expect(j.companies).toHaveLength(2)
    const findCall = vi.mocked(prisma.company.findMany).mock.calls[0]?.[0] as any
    expect(findCall.where.userId).toBe(USER)
  })

  it('filters by q (name or domain)', async () => {
    vi.mocked(prisma.company.findMany).mockResolvedValueOnce([])
    await listCompanies(listReq('q=stripe'))
    const call = vi.mocked(prisma.company.findMany).mock.calls[0]?.[0] as any
    expect(call.where.OR).toHaveLength(2)
  })

  it('filters by industry/country/size', async () => {
    vi.mocked(prisma.company.findMany).mockResolvedValueOnce([])
    await listCompanies(listReq('industry=fintech&country=US&size=51-200'))
    const call = vi.mocked(prisma.company.findMany).mock.calls[0]?.[0] as any
    expect(call.where.industry).toBe('fintech')
    expect(call.where.country).toBe('US')
    expect(call.where.size).toBe('51-200')
  })

  it('caps limit at 1000', async () => {
    vi.mocked(prisma.company.findMany).mockResolvedValueOnce([])
    await listCompanies(listReq('limit=99999'))
    const call = vi.mocked(prisma.company.findMany).mock.calls[0]?.[0] as any
    expect(call.take).toBe(1000)
  })
})

// ─── POST /api/companies ─────────────────────────────────────────────────────

describe('POST /api/companies', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue(mockSession)
  })

  it('400 when name missing', async () => {
    const res = await createCompany(postReq({ name: '   ' }))
    expect(res.status).toBe(400)
  })

  it('creates a new Company (201)', async () => {
    vi.mocked(prisma.company.findUnique).mockResolvedValueOnce(null)
    vi.mocked(prisma.company.create).mockResolvedValueOnce({ id: 'cmp_new' } as any)
    vi.mocked(prisma.company.findUnique).mockResolvedValueOnce(company({ id: 'cmp_new' }) as any)
    const res = await createCompany(postReq({ name: 'New Co', websiteUrl: 'newco.com' }))
    expect(res.status).toBe(201)
    const j = await res.json()
    expect(j.created).toBe(true)
    expect(j.company.id).toBe('cmp_new')
  })

  it('returns existing Company (200, created=false)', async () => {
    vi.mocked(prisma.company.findUnique).mockResolvedValueOnce({ id: 'cmp_existing' } as any)
    vi.mocked(prisma.company.update).mockResolvedValueOnce({ id: 'cmp_existing' } as any)
    vi.mocked(prisma.company.findUnique).mockResolvedValueOnce(company({ id: 'cmp_existing' }) as any)
    const res = await createCompany(postReq({ name: 'Stripe, Inc.' }))
    expect(res.status).toBe(200)
    const j = await res.json()
    expect(j.created).toBe(false)
  })
})

// ─── GET /api/companies/[id] ─────────────────────────────────────────────────

describe('GET /api/companies/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue(mockSession)
  })

  it('returns company + contacts + leads', async () => {
    const c = { ...company(), contacts: [{ id: 'cnt_1' }], leads: [{ id: 'lea_1' }] }
    vi.mocked(prisma.company.findFirst).mockResolvedValueOnce(c as any)
    const res = await getCompany(new NextRequest('http://x/api/companies/cmp_1'), ctx1)
    expect(res.status).toBe(200)
    const j = await res.json()
    expect(j.company.contacts).toHaveLength(1)
    expect(j.company.leads).toHaveLength(1)
  })

  it('404 when not owned by user', async () => {
    vi.mocked(prisma.company.findFirst).mockResolvedValueOnce(null)
    const res = await getCompany(new NextRequest('http://x/api/companies/cmp_1'), ctx1)
    expect(res.status).toBe(404)
  })
})

// ─── PATCH /api/companies/[id] ───────────────────────────────────────────────

describe('PATCH /api/companies/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue(mockSession)
  })

  it('404 when not owned', async () => {
    vi.mocked(prisma.company.findFirst).mockResolvedValueOnce(null)
    const res = await patchCompany(patchReq({ name: 'X' }), ctx1)
    expect(res.status).toBe(404)
  })

  it('drops fields that are not editable', async () => {
    vi.mocked(prisma.company.findFirst).mockResolvedValueOnce({ id: 'cmp_1', name: 'Stripe' } as any)
    vi.mocked(prisma.company.update).mockResolvedValueOnce(company() as any)
    await patchCompany(patchReq({
      industry: 'saas',
      normalizedName: 'whatever',   // server-managed, must be dropped
      contactCount: 9999,           // aggregate, must be dropped
      userId: 'evil',               // must be dropped
    }), ctx1)
    const call = vi.mocked(prisma.company.update).mock.calls[0]?.[0] as any
    expect(call.data.industry).toBe('saas')
    expect(call.data.normalizedName).toBeUndefined() // only set when name changes
    expect(call.data.contactCount).toBeUndefined()
    expect(call.data.userId).toBeUndefined()
  })

  it('renames -> updates normalizedName + propagates cached name to Contact/Lead', async () => {
    vi.mocked(prisma.company.findFirst).mockResolvedValueOnce({ id: 'cmp_1', name: 'Stripe' } as any)
    vi.mocked(prisma.company.update).mockResolvedValueOnce({ ...company(), name: 'Stripe, Inc.' } as any)
    vi.mocked(prisma.contact.updateMany).mockResolvedValueOnce({ count: 2 } as any)
    vi.mocked(prisma.lead.updateMany).mockResolvedValueOnce({ count: 0 } as any)

    await patchCompany(patchReq({ name: 'Stripe, Inc.' }), ctx1)
    const call = vi.mocked(prisma.company.update).mock.calls[0]?.[0] as any
    expect(call.data.name).toBe('Stripe, Inc.')
    expect(call.data.normalizedName).toBe('stripe')

    expect(vi.mocked(prisma.contact.updateMany)).toHaveBeenCalledWith({
      where: { companyId: 'cmp_1' }, data: { company: 'Stripe, Inc.' },
    })
    expect(vi.mocked(prisma.lead.updateMany)).toHaveBeenCalledWith({
      where: { companyId: 'cmp_1' }, data: { company: 'Stripe, Inc.' },
    })
  })

  it('400 when name set to empty', async () => {
    vi.mocked(prisma.company.findFirst).mockResolvedValueOnce({ id: 'cmp_1', name: 'Stripe' } as any)
    const res = await patchCompany(patchReq({ name: '   ' }), ctx1)
    expect(res.status).toBe(400)
  })

  it('400 when name normalises to empty (e.g. just a suffix)', async () => {
    vi.mocked(prisma.company.findFirst).mockResolvedValueOnce({ id: 'cmp_1', name: 'Stripe' } as any)
    const res = await patchCompany(patchReq({ name: 'Inc.' }), ctx1)
    expect(res.status).toBe(400)
  })

  it('409 on unique-constraint collision (P2002)', async () => {
    vi.mocked(prisma.company.findFirst).mockResolvedValueOnce({ id: 'cmp_1', name: 'A' } as any)
    const err: Error & { code?: string } = new Error('dup')
    err.code = 'P2002'
    vi.mocked(prisma.company.update).mockRejectedValueOnce(err)
    const res = await patchCompany(patchReq({ name: 'Existing' }), ctx1)
    expect(res.status).toBe(409)
  })

  it('updates domain when websiteUrl changes', async () => {
    vi.mocked(prisma.company.findFirst).mockResolvedValueOnce({ id: 'cmp_1', name: 'Stripe' } as any)
    vi.mocked(prisma.company.update).mockResolvedValueOnce(company() as any)
    await patchCompany(patchReq({ websiteUrl: 'https://www.newdomain.io/path' }), ctx1)
    const call = vi.mocked(prisma.company.update).mock.calls[0]?.[0] as any
    expect(call.data.domain).toBe('newdomain.io')
  })
})

// ─── DELETE /api/companies/[id] ──────────────────────────────────────────────

describe('DELETE /api/companies/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue(mockSession)
  })

  it('hard-deletes; Contact/Lead.companyId stays as ON DELETE SET NULL (DB-enforced)', async () => {
    vi.mocked(prisma.company.findFirst).mockResolvedValueOnce({ id: 'cmp_1' } as any)
    vi.mocked(prisma.company.delete).mockResolvedValueOnce({ id: 'cmp_1' } as any)
    const res = await deleteCompany(new NextRequest('http://x/api/companies/cmp_1', { method: 'DELETE' }), ctx1)
    expect(res.status).toBe(200)
    expect(vi.mocked(prisma.company.delete)).toHaveBeenCalledWith({ where: { id: 'cmp_1' } })
  })

  it('404 when not owned', async () => {
    vi.mocked(prisma.company.findFirst).mockResolvedValueOnce(null)
    const res = await deleteCompany(new NextRequest('http://x/api/companies/cmp_1', { method: 'DELETE' }), ctx1)
    expect(res.status).toBe(404)
  })
})
