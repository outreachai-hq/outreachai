// Vercel Cron — drains a batch of SES events from SQS every minute.
// For Docker/VPS deployments the ses-event-poller runs as a continuous
// background loop instead — this endpoint is a Vercel-only fallback.
//
// Add to vercel.json crons:
//   { "path": "/api/cron/process-ses-events", "schedule": "* * * * *" }

import { NextRequest, NextResponse } from 'next/server'
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs'
import { prisma } from '@/lib/prisma'
import { suppressAcrossUsers } from '@/lib/suppression'

export const runtime  = 'nodejs'
export const maxDuration = 60

const QUEUE_URL  = process.env.SES_EVENT_QUEUE_URL ?? ''
const AWS_REGION = process.env.SES_EVENT_QUEUE_REGION ?? process.env.AWS_REGION ?? 'ap-south-1'

interface SesRecipient { emailAddress: string }
interface SesNotification {
  notificationType: 'Bounce' | 'Complaint' | 'Delivery' | 'Open' | 'Click'
  mail: { messageId: string; destination: string[] }
  bounce?: { bounceType: string; bouncedRecipients: SesRecipient[] }
  complaint?: { complainedRecipients: SesRecipient[] }
  delivery?: { recipients: string[] }
}


async function handleNotification(notification: SesNotification) {
  const sesMessageId = notification.mail.messageId

  if (notification.notificationType === 'Bounce') {
    const bounce = notification.bounce!
    for (const r of bounce.bouncedRecipients) {
      const email = r.emailAddress.toLowerCase()
      await prisma.marketingCampaignSend.updateMany({
        where: sesMessageId ? { sesMessageId } : { leadEmail: email },
        data: { status: 'bounced' },
      })
      if (bounce.bounceType === 'Permanent') await suppressAcrossUsers(email)
    }
  }

  if (notification.notificationType === 'Complaint') {
    const complaint = notification.complaint!
    for (const r of complaint.complainedRecipients) {
      const email = r.emailAddress.toLowerCase()
      await prisma.marketingCampaignSend.updateMany({
        where: sesMessageId ? { sesMessageId } : { leadEmail: email },
        data: { status: 'complained', complainedAt: new Date() },
      })
      await suppressAcrossUsers(email)
    }
  }

  if (notification.notificationType === 'Delivery') {
    const delivery = notification.delivery!
    for (const email of delivery.recipients) {
      await prisma.marketingCampaignSend.updateMany({
        where: sesMessageId ? { sesMessageId } : { leadEmail: email.toLowerCase() },
        data: { status: 'delivered', deliveredAt: new Date() },
      })
    }
  }
}

export async function GET(req: NextRequest) {
  // Auth — same CRON_SECRET pattern as other cron routes
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization') ?? ''
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  if (!QUEUE_URL) {
    return NextResponse.json({ ok: true, processed: 0, note: 'SES_EVENT_QUEUE_URL not set' })
  }

  const sqs = new SQSClient({
    region: AWS_REGION,
    credentials:
      process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY }
        : undefined,
  })

  let processed = 0
  let errors = 0

  // Process up to 100 messages per cron run (10 batches of 10)
  for (let i = 0; i < 10; i++) {
    const resp = await sqs.send(new ReceiveMessageCommand({
      QueueUrl: QUEUE_URL,
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 1,
    }))

    const messages = resp.Messages ?? []
    if (messages.length === 0) break

    await Promise.all(messages.map(async (msg) => {
      try {
        const outer = JSON.parse(msg.Body ?? '{}')
        if (outer.Type === 'Notification' && typeof outer.Message === 'string') {
          const notification = JSON.parse(outer.Message) as SesNotification
          await handleNotification(notification)
          processed++
        }
        await sqs.send(new DeleteMessageCommand({
          QueueUrl: QUEUE_URL,
          ReceiptHandle: msg.ReceiptHandle!,
        }))
      } catch {
        errors++
      }
    }))
  }

  return NextResponse.json({ ok: true, processed, errors })
}
