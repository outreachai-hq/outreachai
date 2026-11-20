import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import { upsertCompany, linkToCompany } from '@/lib/upsertCompany'

const USER = 'user_test_123'

describe('upsertCompany', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a new Company when none exists for that normalized name', async () => {
    vi.mocked(prisma.company.findUnique).mockResolvedValueOnce(null)
    vi.mocked(prisma.company.create).mockResolvedValueOnce({ id: 'cmp_1' } as any)

    const out = await upsertCompany({ userId: USER, name: 'Stripe, Inc.' })

    expect(out.id).toBe('cmp_1')
    expect(out.created).toBe(true)

    const findCall = vi.mocked(prisma.company.findUnique).mock.calls[0]?.[0] as any
    expect(findCall.where.userId_normalizedName.normalizedName).toBe('stripe')

    const createCall = vi.mocked(prisma.company.create).mock.calls[0]?.[0] as any
    expect(createCall.data.userId).toBe(USER)
    expect(createCall.data.name).toBe('Stripe, Inc.')           // display name preserved
    expect(createCall.data.normalizedName).toBe('stripe')        // dedup key
  })

  it('updates the existing Company when one is already in place (case + suffix variant)', async () => {
    vi.mocked(prisma.company.findUnique).mockResolvedValueOnce({ id: 'cmp_existing' } as any)
    vi.mocked(prisma.company.update).mockResolvedValueOnce({ id: 'cmp_existing' } as any)

    const out = await upsertCompany({
      userId: USER,
      name: 'STRIPE',
      websiteUrl: 'https://stripe.com',
      industry: 'fintech',
    })

    expect(out.id).toBe('cmp_existing')
    expect(out.created).toBe(false)

    expect(vi.mocked(prisma.company.create)).not.toHaveBeenCalled()

    const updateCall = vi.mocked(prisma.company.update).mock.calls[0]?.[0] as any
    expect(updateCall.where.id).toBe('cmp_existing')
    expect(updateCall.data.industry).toBe('fintech')
    expect(updateCall.data.domain).toBe('stripe.com')
  })

  it('extracts domain from websiteUrl when creating', async () => {
    vi.mocked(prisma.company.findUnique).mockResolvedValueOnce(null)
    vi.mocked(prisma.company.create).mockResolvedValueOnce({ id: 'cmp_2' } as any)

    await upsertCompany({
      userId: USER,
      name: 'Apex',
      websiteUrl: 'www.apex.io',
    })

    const createCall = vi.mocked(prisma.company.create).mock.calls[0]?.[0] as any
    expect(createCall.data.domain).toBe('apex.io')
  })

  it('throws on empty / blank name', async () => {
    await expect(upsertCompany({ userId: USER, name: '' })).rejects.toThrow(/empty/)
    await expect(upsertCompany({ userId: USER, name: '   ' })).rejects.toThrow(/empty/)
  })

  it('throws when the name normalises to empty (e.g. pure suffix)', async () => {
    // "Inc." alone is a suffix-only name; normalises to ""
    await expect(upsertCompany({ userId: USER, name: 'Inc.' })).rejects.toThrow(/normalises to empty/)
  })

  it('two variants of the same company map to a single row', async () => {
    // First call -> none, creates
    vi.mocked(prisma.company.findUnique).mockResolvedValueOnce(null)
    vi.mocked(prisma.company.create).mockResolvedValueOnce({ id: 'cmp_x' } as any)
    const a = await upsertCompany({ userId: USER, name: 'Stripe' })
    expect(a.created).toBe(true)

    // Second call -> finds existing, updates only
    vi.mocked(prisma.company.findUnique).mockResolvedValueOnce({ id: 'cmp_x' } as any)
    vi.mocked(prisma.company.update).mockResolvedValueOnce({ id: 'cmp_x' } as any)
    const b = await upsertCompany({ userId: USER, name: 'Stripe Inc.' })
    expect(b.created).toBe(false)
    expect(b.id).toBe(a.id)
  })

  it('passes through optional fields on create', async () => {
    vi.mocked(prisma.company.findUnique).mockResolvedValueOnce(null)
    vi.mocked(prisma.company.create).mockResolvedValueOnce({ id: 'cmp_3' } as any)

    await upsertCompany({
      userId: USER,
      name: 'Foo',
      linkedinUrl: 'https://linkedin.com/company/foo',
      industry: 'saas',
      size: '11-50',
      country: 'US',
      city: 'San Francisco',
    })

    const createCall = vi.mocked(prisma.company.create).mock.calls[0]?.[0] as any
    expect(createCall.data.linkedinUrl).toBe('https://linkedin.com/company/foo')
    expect(createCall.data.industry).toBe('saas')
    expect(createCall.data.size).toBe('11-50')
    expect(createCall.data.country).toBe('US')
    expect(createCall.data.city).toBe('San Francisco')
  })
})

// ─── linkToCompany ───────────────────────────────────────────────────────────

describe('linkToCompany', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns { companyId: null } when name is empty/blank', async () => {
    const out = await linkToCompany({ userId: USER, entity: 'contact', entityId: 'cnt_1', name: '' })
    expect(out.companyId).toBeNull()
    expect(vi.mocked(prisma.company.findUnique)).not.toHaveBeenCalled()
  })

  it('returns { companyId: null } when name is null/undefined', async () => {
    expect((await linkToCompany({ userId: USER, entity: 'contact', entityId: 'cnt_1', name: null })).companyId).toBeNull()
    expect((await linkToCompany({ userId: USER, entity: 'lead', entityId: 'lea_1', name: undefined })).companyId).toBeNull()
  })

  it('contact path: creates Company, links Contact, bumps contactCount=1', async () => {
    vi.mocked(prisma.company.findUnique).mockResolvedValueOnce(null)
    vi.mocked(prisma.company.create).mockResolvedValueOnce({ id: 'cmp_new' } as any)
    vi.mocked(prisma.contact.update).mockResolvedValueOnce({} as any)
    vi.mocked(prisma.company.update).mockResolvedValueOnce({} as any)

    const out = await linkToCompany({ userId: USER, entity: 'contact', entityId: 'cnt_1', name: 'Stripe' })
    expect(out.companyId).toBe('cmp_new')

    expect(vi.mocked(prisma.contact.update)).toHaveBeenCalledWith({
      where: { id: 'cnt_1' },
      data: { companyId: 'cmp_new' },
    })
    const counterCall = vi.mocked(prisma.company.update).mock.calls[0]?.[0] as any
    expect(counterCall.data.contactCount).toBe(1)
    expect(counterCall.data.lastActivityAt).toBeInstanceOf(Date)
  })

  it('lead path: creates Company, links Lead, bumps leadCount=1', async () => {
    vi.mocked(prisma.company.findUnique).mockResolvedValueOnce(null)
    vi.mocked(prisma.company.create).mockResolvedValueOnce({ id: 'cmp_new' } as any)
    vi.mocked(prisma.lead.update).mockResolvedValueOnce({} as any)
    vi.mocked(prisma.company.update).mockResolvedValueOnce({} as any)

    const out = await linkToCompany({ userId: USER, entity: 'lead', entityId: 'lea_1', name: 'Stripe' })
    expect(out.companyId).toBe('cmp_new')

    expect(vi.mocked(prisma.lead.update)).toHaveBeenCalledWith({
      where: { id: 'lea_1' },
      data: { companyId: 'cmp_new' },
    })
    const counterCall = vi.mocked(prisma.company.update).mock.calls[0]?.[0] as any
    expect(counterCall.data.leadCount).toBe(1)
  })

  it('uses increment on the existing-Company path so concurrent inserts add up', async () => {
    vi.mocked(prisma.company.findUnique).mockResolvedValueOnce({ id: 'cmp_existing' } as any)
    vi.mocked(prisma.company.update).mockResolvedValueOnce({} as any) // upsertCompany update
    vi.mocked(prisma.contact.update).mockResolvedValueOnce({} as any)
    vi.mocked(prisma.company.update).mockResolvedValueOnce({} as any) // counter update

    await linkToCompany({ userId: USER, entity: 'contact', entityId: 'cnt_2', name: 'Stripe' })

    // Find the counter-update call (it's the one with contactCount in its data).
    const counterCall = vi.mocked(prisma.company.update).mock.calls.find(
      (c) => (c[0] as { data: { contactCount?: unknown } } | undefined)?.data?.contactCount !== undefined
    )?.[0] as { data?: { contactCount?: unknown } } | undefined
    expect(counterCall?.data?.contactCount).toEqual({ increment: 1 })
  })

  it('fail-soft: a thrown upsertCompany never throws to the caller', async () => {
    vi.mocked(prisma.company.findUnique).mockRejectedValueOnce(new Error('db boom'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const out = await linkToCompany({ userId: USER, entity: 'contact', entityId: 'cnt_x', name: 'Stripe' })
    expect(out.companyId).toBeNull()

    consoleSpy.mockRestore()
  })
})
