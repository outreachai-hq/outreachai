// Plan 1 — Sender rotation across a per-campaign mailbox pool.
//
// Strategy: pick the mailbox with the lowest "sent today / dailyLimit" ratio.
// Excludes mailboxes with warmupActive=true (warming up should not also be
// blasting cold outbound). Falls back to isDefault when the campaign has no
// pool configured (backwards-compatible with pre-migration campaigns).
//
// "Today" is anchored to the campaign's timezone (e.g. Asia/Kolkata), not UTC,
// so daily-send counters reset at local midnight as users would expect.
//
// Supports both SMTP and SES accounts — SES accounts are eligible even though
// they have no smtpHost.

import { prisma } from './prisma'
import { startOfTodayInTz } from './timezone'

type Mailbox = {
  id: string
  provider: string
  name: string
  email: string
  // SMTP
  smtpHost: string | null
  smtpPort: number | null
  smtpUser: string | null
  smtpPass: string | null
  // SES
  awsRegion: string | null
  awsAccessKeyId: string | null
  awsSecretAccessKey: string | null
  // SendGrid
  sendgridApiKey: string | null
  signature: string | null
  dailyLimit: number
}

/** Prisma WHERE clause that matches SMTP, SES, and SendGrid eligible accounts. */
const eligibleWhere = {
  warmupActive: false as const,
  OR: [
    { smtpHost: { not: null } },       // SMTP / Gmail
    { provider: 'ses' as string },     // AWS SES
    { provider: 'sendgrid' as string}, // SendGrid
  ],
}

/**
 * Pick the best mailbox to send from for a campaign.
 *
 * @returns the mailbox row or null when no eligible sender exists
 *          (e.g. all over their daily limit, or no mailbox configured).
 */
export async function pickSenderForCampaign(opts: {
  userId: string
  campaignId: string
  stepEmailAccountId?: string | null   // step-level override (highest priority)
}): Promise<Mailbox | null> {
  // Always anchor "today" to the campaign's timezone so daily-limit counters
  // reset at the campaign's local midnight rather than UTC midnight.
  const campaign = await prisma.campaign.findUnique({
    where: { id: opts.campaignId },
    select: { emailAccountIds: true, dailyEmailLimit: true, timezone: true },
  })
  const since = startOfTodayInTz(campaign?.timezone ?? 'UTC')

  // 1) Step-level override beats everything
  if (opts.stepEmailAccountId) {
    const acc = await prisma.emailAccount.findFirst({
      where: { id: opts.stepEmailAccountId, userId: opts.userId, ...eligibleWhere },
      select: senderSelect,
    })
    if (!acc) return null
    const sentToday = await countSentSince(opts.userId, [acc.id], since)
    if ((sentToday.get(acc.id) ?? 0) >= acc.dailyLimit) return null
    return acc
  }

  const candidateIds = campaign?.emailAccountIds.length ? campaign.emailAccountIds : null

  const accounts = await prisma.emailAccount.findMany({
    where: {
      userId: opts.userId,
      ...eligibleWhere,
      ...(candidateIds ? { id: { in: candidateIds } } : { isDefault: true }),
    },
    select: senderSelect,
  })

  if (accounts.length === 0) return null

  // Enforce per-campaign daily cap when a pool is configured
  if (campaign && candidateIds) {
    const totalToday = await prisma.emailMessage.count({
      where: {
        userId: opts.userId,
        emailAccountId: { in: candidateIds },
        sentAt: { gte: since },
      },
    })
    if (totalToday >= campaign.dailyEmailLimit) return null
  }

  const sentToday = await countSentSince(opts.userId, accounts.map((a) => a.id), since)

  const eligible = accounts
    .map((a) => ({ account: a, sent: sentToday.get(a.id) ?? 0 }))
    .filter((x) => x.sent < x.account.dailyLimit)
    .map((x) => ({
      account: x.account,
      sent: x.sent,
      ratio: x.sent / Math.max(x.account.dailyLimit, 1),
    }))
    // lowest ratio first; on tie, lowest absolute count
    .sort((a, b) => a.ratio - b.ratio || a.sent - b.sent)

  return eligible[0]?.account ?? null
}

const senderSelect = {
  id: true,
  provider: true,
  name: true,
  email: true,
  smtpHost: true,
  smtpPort: true,
  smtpUser: true,
  smtpPass: true,
  awsRegion: true,
  awsAccessKeyId: true,
  awsSecretAccessKey: true,
  sendgridApiKey: true,
  signature: true,
  dailyLimit: true,
} as const

async function countSentSince(
  userId: string,
  accountIds: string[],
  since: Date
): Promise<Map<string, number>> {
  if (accountIds.length === 0) return new Map()
  const rows = await prisma.emailMessage.groupBy({
    by: ['emailAccountId'],
    where: {
      userId,
      emailAccountId: { in: accountIds },
      sentAt: { gte: since },
    },
    _count: { _all: true },
  })
  return new Map(rows.map((r) => [r.emailAccountId, r._count._all]))
}
