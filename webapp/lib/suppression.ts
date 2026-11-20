// Shared suppression utilities — single source of truth used by
// webhook handler, SQS poller, and cron processor.

import { prisma } from '@/lib/prisma'

/**
 * Suppresses an email address for every user who has ever sent to it.
 * Safe to call multiple times — upsert is idempotent.
 */
export async function suppressAcrossUsers(email: string): Promise<void> {
  const sends = await prisma.marketingCampaignSend.findMany({
    where: { leadEmail: email },
    select: { campaign: { select: { userId: true } } },
    distinct: ['campaignId'],
  })

  const userIds = [...new Set(sends.map((s) => s.campaign.userId))]

  await Promise.all(
    userIds.map((userId) =>
      prisma.unsubscribe
        .upsert({
          where: { email_userId: { email, userId } },
          update: {},
          create: { email, userId },
        })
        .catch((err) => {
          // Log but don't swallow — caller should know if suppression failed
          console.error(`[suppression] failed for ${email} / ${userId}:`, err.message)
        })
    )
  )
}
