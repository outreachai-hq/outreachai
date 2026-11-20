// SES Event Poller — polls SQS queue for SES bounce/complaint/delivery events.
// Runs as a singleton background loop started once on app boot.
//
// Queue: outreachai-ses-events (SNS → SQS, deployed via mf-cdk)
// All 4 event types (bounce, complaint, delivery, open/click) flow here.
//
// Correlation: sesMessageId → MarketingCampaignSend row (set at send time).

import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs'
import { prisma } from '@/lib/prisma'
import { suppressAcrossUsers } from '@/lib/suppression'

const QUEUE_URL   = process.env.SES_EVENT_QUEUE_URL ?? ''
const AWS_REGION  = process.env.SES_EVENT_QUEUE_REGION ?? process.env.AWS_REGION ?? 'ap-south-1'
const POLL_DELAY  = 5_000   // ms between polls when queue is empty
const BATCH_SIZE  = 10      // SQS max per receive

// SES event payload shapes from SNS notifications
interface SesRecipient { emailAddress: string }
interface SesBounce {
  bounceType: 'Permanent' | 'Transient' | 'Undetermined'
  bouncedRecipients: SesRecipient[]
  timestamp: string
}
interface SesComplaint {
  complainedRecipients: SesRecipient[]
  timestamp: string
}
interface SesDelivery {
  recipients: string[]
  timestamp: string
}
interface SesNotification {
  notificationType: 'Bounce' | 'Complaint' | 'Delivery' | 'Open' | 'Click'
  mail: { messageId: string; destination: string[] }
  bounce?: SesBounce
  complaint?: SesComplaint
  delivery?: SesDelivery
}

function makeSqsClient() {
  return new SQSClient({
    region: AWS_REGION,
    credentials:
      process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          }
        : undefined, // falls back to IAM role on ECS
  })
}

// ── Event handlers ────────────────────────────────────────────────────────────

async function handleBounce(notification: SesNotification) {
  const bounce = notification.bounce!
  const sesMessageId = notification.mail.messageId
  const isPermanent = bounce.bounceType === 'Permanent'

  for (const r of bounce.bouncedRecipients) {
    const email = r.emailAddress.toLowerCase()

    // Update send record via sesMessageId (most accurate) or email fallback
    await prisma.marketingCampaignSend.updateMany({
      where: sesMessageId
        ? { sesMessageId }
        : { leadEmail: email },
      data: { status: 'bounced' },
    })

    // Permanent bounce → auto-suppress
    if (isPermanent) {
      await suppressAcrossUsers(email)
    }

    console.log(`[ses-poller] bounce (${bounce.bounceType}) → ${email} | msgId: ${sesMessageId}`)
  }
}

async function handleComplaint(notification: SesNotification) {
  const complaint = notification.complaint!
  const sesMessageId = notification.mail.messageId

  for (const r of complaint.complainedRecipients) {
    const email = r.emailAddress.toLowerCase()

    await prisma.marketingCampaignSend.updateMany({
      where: sesMessageId
        ? { sesMessageId }
        : { leadEmail: email },
      data: { status: 'complained', complainedAt: new Date() },
    })

    // Always suppress on complaint — no exceptions
    await suppressAcrossUsers(email)
    console.log(`[ses-poller] complaint → ${email} | msgId: ${sesMessageId}`)
  }
}

async function handleDelivery(notification: SesNotification) {
  const delivery = notification.delivery!
  const sesMessageId = notification.mail.messageId

  for (const email of delivery.recipients) {
    await prisma.marketingCampaignSend.updateMany({
      where: sesMessageId
        ? { sesMessageId }
        : { leadEmail: email.toLowerCase() },
      data: { status: 'delivered', deliveredAt: new Date() },
    })
    console.log(`[ses-poller] delivered → ${email} | msgId: ${sesMessageId}`)
  }
}


// ── Main poll loop ────────────────────────────────────────────────────────────

async function processMessage(body: string) {
  let outer: Record<string, unknown>
  try {
    outer = JSON.parse(body)
  } catch {
    return // not JSON — skip
  }

  // SNS wraps the SES event in a "Message" string field
  if (outer.Type !== 'Notification' || typeof outer.Message !== 'string') return

  let notification: SesNotification
  try {
    notification = JSON.parse(outer.Message as string)
  } catch {
    return
  }

  switch (notification.notificationType) {
    case 'Bounce':    await handleBounce(notification);    break
    case 'Complaint': await handleComplaint(notification); break
    case 'Delivery':  await handleDelivery(notification);  break
    // Open/Click: already tracked via custom pixel/redirect — no action needed here
    default: break
  }
}

let pollerStarted = false

export function startSesEventPoller() {
  if (pollerStarted || !QUEUE_URL) {
    if (!QUEUE_URL) console.warn('[ses-poller] SES_EVENT_QUEUE_URL not set — poller disabled')
    return
  }
  pollerStarted = true

  const sqs = makeSqsClient()
  console.log('[ses-poller] started — polling', QUEUE_URL)

  async function poll() {
    try {
      const resp = await sqs.send(
        new ReceiveMessageCommand({
          QueueUrl: QUEUE_URL,
          MaxNumberOfMessages: BATCH_SIZE,
          WaitTimeSeconds: 5, // long-polling — reduces empty receives
        })
      )

      const messages = resp.Messages ?? []

      await Promise.all(
        messages.map(async (msg) => {
          try {
            await processMessage(msg.Body ?? '')
          } catch (err) {
            console.error('[ses-poller] message processing error:', err)
            return // don't delete — let it retry via visibility timeout
          }

          // Delete from SQS only after successful processing
          await sqs.send(
            new DeleteMessageCommand({
              QueueUrl: QUEUE_URL,
              ReceiptHandle: msg.ReceiptHandle!,
            })
          )
        })
      )

      // Back-off only when queue is empty
      const delay = messages.length === 0 ? POLL_DELAY : 0
      setTimeout(poll, delay)
    } catch (err) {
      console.error('[ses-poller] poll error:', err)
      setTimeout(poll, POLL_DELAY) // retry after delay on error
    }
  }

  poll()
}
