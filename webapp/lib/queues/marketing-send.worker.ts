import { Worker, type Job } from 'bullmq'
import { prisma } from '@/lib/prisma'
import { sendViaAccount, isSESPermanentBounce, isSendGridPermanentBounce } from '@/lib/email/transport'
import { safeDecrypt } from '@/lib/encryption'
import { isPermanentBounce } from '@/lib/sequenceRunner'
import { redisConnection } from './redis'
import { type MarketingSendJob } from './marketing-send.queue'

// 1 concurrent job + 70ms delay ≈ 14 emails/sec — matches SES hard limit
const CONCURRENCY = 1
const RATE_DELAY_MS = 70

async function processSend(job: Job<MarketingSendJob>) {
  const d = job.data

  // 1a. Check suppression — must be first, list may have grown since enqueue
  const suppressed = await prisma.unsubscribe.findFirst({
    where: { email: d.leadEmail.toLowerCase() },
  })
  if (suppressed) {
    await prisma.marketingCampaignSend.update({
      where: { id: d.sendId },
      data: { status: 'failed' },
    })
    return
  }

  // 1b. Daily send limit — enforces IP warm-up schedule
  // Note: fetched again below with full account; this is a lightweight pre-check
  const limitCheck = await prisma.emailAccount.findUnique({
    where: { id: d.accountId },
    select: { dailyLimit: true, dailySendCount: true, dailySendResetAt: true },
  })
  if (limitCheck) {
    const now      = new Date()
    const sameDay  = limitCheck.dailySendResetAt?.toDateString() === now.toDateString()
    const todayCount = sameDay ? limitCheck.dailySendCount : 0
    if (todayCount >= limitCheck.dailyLimit) {
      throw new Error(`Daily send limit reached (${limitCheck.dailyLimit}/day) — will retry tomorrow`)
    }
    await prisma.emailAccount.update({
      where: { id: d.accountId },
      data: {
        dailySendCount:   sameDay ? { increment: 1 } : 1,
        dailySendResetAt: sameDay ? undefined : now,
      },
    })
  }

  // 2. Fetch credentials from DB at send time — never stored in Redis
  const emailAccount = await prisma.emailAccount.findUniqueOrThrow({ where: { id: d.accountId } })

  // 3. Send via the appropriate provider
  try {
    const { messageId } = await sendViaAccount(
      {
        id: emailAccount.id,
        provider: emailAccount.provider,
        name: d.fromName,
        email: d.fromEmail,
        awsRegion: emailAccount.awsRegion,
        awsAccessKeyId: safeDecrypt(emailAccount.awsAccessKeyId),
        awsSecretAccessKey: safeDecrypt(emailAccount.awsSecretAccessKey),
        sesConfigurationSet: emailAccount.sesConfigurationSet,
        smtpHost: emailAccount.smtpHost,
        smtpPort: emailAccount.smtpPort,
        smtpUser: emailAccount.smtpUser,
        smtpPass: safeDecrypt(emailAccount.smtpPass),
        sendgridApiKey: safeDecrypt(emailAccount.sendgridApiKey),
      },
      {
        to: d.leadEmail,
        subject: d.subject,
        html: d.htmlBody,
        listUnsubscribeUrl: d.listUnsubscribeUrl,
      }
    )

    await prisma.marketingCampaignSend.update({
      where: { id: d.sendId },
      data: {
        status: 'sent',
        sentAt: new Date(),
        ...(messageId && { sesMessageId: messageId }),
      },
    })
  } catch (err) {
    const isBounce =
      isPermanentBounce(err) ||
      isSESPermanentBounce(err) ||
      isSendGridPermanentBounce(err)

    await prisma.marketingCampaignSend.update({
      where: { id: d.sendId },
      data: { status: isBounce ? 'bounced' : 'failed' },
    })

    // Auto-suppress hard bounces immediately
    if (isBounce) {
      const userId = await prisma.marketingCampaign
        .findUnique({ where: { id: d.campaignId }, select: { userId: true } })
        .then((c) => c?.userId)

      if (userId) {
        await prisma.unsubscribe
          .upsert({
            where: { email_userId: { email: d.leadEmail, userId } },
            update: {},
            create: { email: d.leadEmail, userId },
          })
          .catch(() => {})
      }
    }

    if (!isBounce) throw err // trigger BullMQ retry for transient errors
  }

  // 3. Rate limit — stay under 14/sec SES limit
  await new Promise((r) => setTimeout(r, RATE_DELAY_MS))

  // 4. Check if all sends for this campaign are done — flip campaign to 'sent'
  await maybeCompleteCampaign(d.campaignId)
}

async function maybeCompleteCampaign(campaignId: string) {
  // Count sends still in a terminal-pending state
  const pending = await prisma.marketingCampaignSend.count({
    where: { campaignId, status: 'pending' },
  })
  if (pending > 0) return

  // All jobs processed — compute final stats and mark campaign sent
  const sends = await prisma.marketingCampaignSend.findMany({
    where: { campaignId },
    select: { status: true, openedAt: true, clickedAt: true, unsubscribedAt: true },
  })

  const total       = sends.length
  const sent        = sends.filter((s) => s.status === 'sent').length
  const bounced     = sends.filter((s) => s.status === 'bounced').length
  const complained  = sends.filter((s) => s.status === 'complained').length
  const failed      = sends.filter((s) => s.status === 'failed').length
  const opened      = sends.filter((s) => s.openedAt !== null).length
  const clicked     = sends.filter((s) => s.clickedAt !== null).length
  const unsubscribed = sends.filter((s) => s.unsubscribedAt !== null).length

  await prisma.marketingCampaign.updateMany({
    where: { id: campaignId, status: 'sending' },
    data: {
      status: 'sent',
      sentAt: new Date(),
      stats: { total, sent, bounced, complained, failed, opened, clicked, unsubscribed },
    },
  })
  console.log(`[marketing-send] campaign ${campaignId} complete — ${sent}/${total} sent`)
}

// Singleton worker — started once when this module is imported
let workerStarted = false

export function startMarketingSendWorker() {
  if (workerStarted) return
  workerStarted = true

  const worker = new Worker<MarketingSendJob>(
    'marketing-send',
    processSend,
    { connection: redisConnection, concurrency: CONCURRENCY }
  )

  worker.on('failed', (job, err) => {
    console.error(`[marketing-send] job ${job?.id} failed:`, err.message)
  })

  worker.on('completed', (job) => {
    console.log(`[marketing-send] job ${job.id} done — ${job.data.leadEmail}`)
  })

  console.log('[marketing-send] worker started')
}
