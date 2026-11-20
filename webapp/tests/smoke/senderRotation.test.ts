import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import { pickSenderForCampaign } from '@/lib/senderRotation'

const USER = 'user_test_123'
const CAMPAIGN = 'cam_test_1'

function mailbox(over: Partial<{
  id: string
  name: string
  email: string
  smtpHost: string | null
  smtpPort: number | null
  smtpUser: string | null
  smtpPass: string | null
  signature: string | null
  dailyLimit: number
}> = {}) {
  return {
    id: over.id ?? 'mb_a',
    name: over.name ?? 'Acme',
    email: over.email ?? 'a@acme.com',
    smtpHost: over.smtpHost ?? 'smtp.acme.com',
    smtpPort: over.smtpPort ?? 587,
    smtpUser: over.smtpUser ?? 'a@acme.com',
    smtpPass: over.smtpPass ?? 'enc:xxx',
    signature: over.signature ?? null,
    dailyLimit: over.dailyLimit ?? 50,
  }
}

describe('pickSenderForCampaign', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null when no mailboxes exist', async () => {
    vi.mocked(prisma.campaign.findUnique).mockResolvedValueOnce({
      emailAccountIds: [],
      dailyEmailLimit: 50,
    } as any)
    vi.mocked(prisma.emailAccount.findMany).mockResolvedValueOnce([])

    const out = await pickSenderForCampaign({ userId: USER, campaignId: CAMPAIGN })
    expect(out).toBeNull()
  })

  it('falls back to isDefault when campaign has no pool', async () => {
    vi.mocked(prisma.campaign.findUnique).mockResolvedValueOnce({
      emailAccountIds: [],
      dailyEmailLimit: 50,
    } as any)
    const acc = mailbox({ id: 'mb_default' })
    vi.mocked(prisma.emailAccount.findMany).mockResolvedValueOnce([acc] as any)
    vi.mocked(prisma.emailMessage.groupBy).mockResolvedValueOnce([] as any)

    const out = await pickSenderForCampaign({ userId: USER, campaignId: CAMPAIGN })
    expect(out?.id).toBe('mb_default')

    // Verify the query asked for isDefault when pool is empty
    const findManyCall = vi.mocked(prisma.emailAccount.findMany).mock.calls[0]?.[0] as any
    expect(findManyCall?.where?.isDefault).toBe(true)
  })

  it('picks lowest sent-today ratio when pool is configured', async () => {
    vi.mocked(prisma.campaign.findUnique).mockResolvedValueOnce({
      emailAccountIds: ['mb_a', 'mb_b'],
      dailyEmailLimit: 100,
    } as any)
    const a = mailbox({ id: 'mb_a', dailyLimit: 50 })
    const b = mailbox({ id: 'mb_b', dailyLimit: 50 })
    vi.mocked(prisma.emailAccount.findMany).mockResolvedValueOnce([a, b] as any)

    // Per-campaign cap check
    vi.mocked(prisma.emailMessage.count).mockResolvedValueOnce(10)
    // Per-mailbox count: A has sent 30, B has sent 5
    vi.mocked(prisma.emailMessage.groupBy).mockResolvedValueOnce([
      { emailAccountId: 'mb_a', _count: { _all: 30 } },
      { emailAccountId: 'mb_b', _count: { _all: 5 } },
    ] as any)

    const out = await pickSenderForCampaign({ userId: USER, campaignId: CAMPAIGN })
    expect(out?.id).toBe('mb_b')
  })

  it('excludes mailboxes over their per-mailbox daily limit', async () => {
    vi.mocked(prisma.campaign.findUnique).mockResolvedValueOnce({
      emailAccountIds: ['mb_a', 'mb_b'],
      dailyEmailLimit: 200,
    } as any)
    const a = mailbox({ id: 'mb_a', dailyLimit: 50 })
    const b = mailbox({ id: 'mb_b', dailyLimit: 50 })
    vi.mocked(prisma.emailAccount.findMany).mockResolvedValueOnce([a, b] as any)
    vi.mocked(prisma.emailMessage.count).mockResolvedValueOnce(50)
    vi.mocked(prisma.emailMessage.groupBy).mockResolvedValueOnce([
      { emailAccountId: 'mb_a', _count: { _all: 50 } }, // over
      { emailAccountId: 'mb_b', _count: { _all: 20 } }, // under
    ] as any)

    const out = await pickSenderForCampaign({ userId: USER, campaignId: CAMPAIGN })
    expect(out?.id).toBe('mb_b')
  })

  it('returns null when ALL mailboxes are over their daily limit', async () => {
    vi.mocked(prisma.campaign.findUnique).mockResolvedValueOnce({
      emailAccountIds: ['mb_a', 'mb_b'],
      dailyEmailLimit: 1000,
    } as any)
    vi.mocked(prisma.emailAccount.findMany).mockResolvedValueOnce([
      mailbox({ id: 'mb_a', dailyLimit: 10 }),
      mailbox({ id: 'mb_b', dailyLimit: 20 }),
    ] as any)
    vi.mocked(prisma.emailMessage.count).mockResolvedValueOnce(30)
    vi.mocked(prisma.emailMessage.groupBy).mockResolvedValueOnce([
      { emailAccountId: 'mb_a', _count: { _all: 10 } },
      { emailAccountId: 'mb_b', _count: { _all: 20 } },
    ] as any)

    const out = await pickSenderForCampaign({ userId: USER, campaignId: CAMPAIGN })
    expect(out).toBeNull()
  })

  it('returns null when the campaign-wide daily cap is hit', async () => {
    vi.mocked(prisma.campaign.findUnique).mockResolvedValueOnce({
      emailAccountIds: ['mb_a', 'mb_b'],
      dailyEmailLimit: 100,
    } as any)
    vi.mocked(prisma.emailAccount.findMany).mockResolvedValueOnce([
      mailbox({ id: 'mb_a' }),
      mailbox({ id: 'mb_b' }),
    ] as any)
    // Per-campaign total already at 100
    vi.mocked(prisma.emailMessage.count).mockResolvedValueOnce(100)

    const out = await pickSenderForCampaign({ userId: USER, campaignId: CAMPAIGN })
    expect(out).toBeNull()
    // The per-mailbox groupBy shouldn't be queried once the cap is hit
    expect(vi.mocked(prisma.emailMessage.groupBy)).not.toHaveBeenCalled()
  })

  it('honours step-level emailAccountId override when under its limit', async () => {
    vi.mocked(prisma.campaign.findUnique).mockResolvedValueOnce({
      emailAccountIds: [], dailyEmailLimit: 100, timezone: 'UTC',
    } as any)
    const override = mailbox({ id: 'mb_step', dailyLimit: 100 })
    vi.mocked(prisma.emailAccount.findFirst).mockResolvedValueOnce(override as any)
    vi.mocked(prisma.emailMessage.groupBy).mockResolvedValueOnce([
      { emailAccountId: 'mb_step', _count: { _all: 5 } },
    ] as any)

    const out = await pickSenderForCampaign({
      userId: USER,
      campaignId: CAMPAIGN,
      stepEmailAccountId: 'mb_step',
    })
    expect(out?.id).toBe('mb_step')
    // Campaign is still fetched (we need its timezone) but the pool query is skipped.
    expect(vi.mocked(prisma.emailAccount.findMany)).not.toHaveBeenCalled()
  })

  it('anchors "today" to the campaign timezone, not UTC', async () => {
    // At 03:00 UTC June 23 (= 08:30 IST June 23), midnight IST is 18:30 UTC June 22.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-23T03:00:00.000Z'))

    vi.mocked(prisma.campaign.findUnique).mockResolvedValueOnce({
      emailAccountIds: ['mb_a'],
      dailyEmailLimit: 100,
      timezone: 'Asia/Kolkata',
    } as any)
    vi.mocked(prisma.emailAccount.findMany).mockResolvedValueOnce([
      mailbox({ id: 'mb_a' }),
    ] as any)
    vi.mocked(prisma.emailMessage.count).mockResolvedValueOnce(0)
    vi.mocked(prisma.emailMessage.groupBy).mockResolvedValueOnce([] as any)

    await pickSenderForCampaign({ userId: USER, campaignId: CAMPAIGN })

    const groupByCall = vi.mocked(prisma.emailMessage.groupBy).mock.calls[0]?.[0] as any
    const sinceISO = (groupByCall.where.sentAt.gte as Date).toISOString()
    // Midnight IST June 23 = 18:30 UTC June 22
    expect(sinceISO).toBe('2026-06-22T18:30:00.000Z')

    vi.useRealTimers()
  })

  it('rejects step-level override mailbox if it is over its own limit', async () => {
    const override = mailbox({ id: 'mb_step', dailyLimit: 10 })
    vi.mocked(prisma.emailAccount.findFirst).mockResolvedValueOnce(override as any)
    vi.mocked(prisma.emailMessage.groupBy).mockResolvedValueOnce([
      { emailAccountId: 'mb_step', _count: { _all: 10 } },
    ] as any)

    const out = await pickSenderForCampaign({
      userId: USER,
      campaignId: CAMPAIGN,
      stepEmailAccountId: 'mb_step',
    })
    expect(out).toBeNull()
  })

  it('returns null when step-level override mailbox does not exist (or belongs to another user)', async () => {
    vi.mocked(prisma.emailAccount.findFirst).mockResolvedValueOnce(null)

    const out = await pickSenderForCampaign({
      userId: USER,
      campaignId: CAMPAIGN,
      stepEmailAccountId: 'mb_other',
    })
    expect(out).toBeNull()
  })

  it('breaks ratio ties by lowest absolute sent count', async () => {
    vi.mocked(prisma.campaign.findUnique).mockResolvedValueOnce({
      emailAccountIds: ['mb_a', 'mb_b'],
      dailyEmailLimit: 1000,
    } as any)
    // Same ratio (0.4), different absolute counts
    vi.mocked(prisma.emailAccount.findMany).mockResolvedValueOnce([
      mailbox({ id: 'mb_a', dailyLimit: 50 }), // 20/50 = 0.4
      mailbox({ id: 'mb_b', dailyLimit: 25 }), // 10/25 = 0.4
    ] as any)
    vi.mocked(prisma.emailMessage.count).mockResolvedValueOnce(30)
    vi.mocked(prisma.emailMessage.groupBy).mockResolvedValueOnce([
      { emailAccountId: 'mb_a', _count: { _all: 20 } },
      { emailAccountId: 'mb_b', _count: { _all: 10 } },
    ] as any)

    const out = await pickSenderForCampaign({ userId: USER, campaignId: CAMPAIGN })
    expect(out?.id).toBe('mb_b')
  })

  it('excludes warmupActive mailboxes via WHERE clause', async () => {
    vi.mocked(prisma.campaign.findUnique).mockResolvedValueOnce({
      emailAccountIds: [],
      dailyEmailLimit: 50,
    } as any)
    vi.mocked(prisma.emailAccount.findMany).mockResolvedValueOnce([] as any)
    vi.mocked(prisma.emailMessage.groupBy).mockResolvedValueOnce([] as any)

    await pickSenderForCampaign({ userId: USER, campaignId: CAMPAIGN })

    const call = vi.mocked(prisma.emailAccount.findMany).mock.calls[0]?.[0] as any
    expect(call.where.warmupActive).toBe(false)
    // Eligible accounts are SMTP (smtpHost not null) OR SES provider
    expect(call.where.OR).toBeDefined()
    expect(call.where.OR[0]).toEqual({ smtpHost: { not: null } })
    expect(call.where.OR[1]).toEqual({ provider: 'ses' })
  })

  it('scopes the per-mailbox sent-today count by userId + accountIds', async () => {
    vi.mocked(prisma.campaign.findUnique).mockResolvedValueOnce({
      emailAccountIds: ['mb_a'],
      dailyEmailLimit: 100,
    } as any)
    vi.mocked(prisma.emailAccount.findMany).mockResolvedValueOnce([
      mailbox({ id: 'mb_a' }),
    ] as any)
    vi.mocked(prisma.emailMessage.count).mockResolvedValueOnce(0)
    vi.mocked(prisma.emailMessage.groupBy).mockResolvedValueOnce([] as any)

    await pickSenderForCampaign({ userId: USER, campaignId: CAMPAIGN })

    const groupByCall = vi.mocked(prisma.emailMessage.groupBy).mock.calls[0]?.[0] as any
    expect(groupByCall.where.userId).toBe(USER)
    expect(groupByCall.where.emailAccountId).toEqual({ in: ['mb_a'] })
    // The "since" boundary should be a Date (today's start)
    expect(groupByCall.where.sentAt.gte).toBeInstanceOf(Date)
  })
})
