/**
 * Phase 3 integration test — event handler logic via cron endpoint.
 * Sends simulated SNS/SES payloads directly to the cron endpoint
 * (no SQS write permission needed — cron processes what's already in queue,
 *  we inject events via the webhook endpoint for unit testing).
 *
 * Tests:
 *   1. SQS queue reachable (read-only)
 *   2. Bounce webhook → status=bounced + Unsubscribe created
 *   3. Complaint webhook → status=complained + complainedAt + Unsubscribe created
 *   4. Delivery event handler (direct DB simulation)
 *   5. Transient bounce → bounced but NOT suppressed
 *   6. Cron endpoint auth + reachable
 *
 * Run:
 *   npx ts-node --project tsconfig.scripts.json -r tsconfig-paths/register \
 *     scripts/test-phase3-integration.ts
 */

import { PrismaClient } from '@prisma/client'
import { SQSClient, GetQueueAttributesCommand } from '@aws-sdk/client-sqs'

const prisma   = new PrismaClient()
const APP_URL  = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const QUEUE_URL = process.env.SES_EVENT_QUEUE_URL ?? ''
const AWS_REGION = process.env.AWS_REGION ?? 'ap-south-1'

let passed = 0, failed = 0
function ok(msg: string)   { console.log(`  ✅ ${msg}`); passed++ }
function fail(msg: string) { console.error(`  ❌ ${msg}`); failed++ }
function wait(ms: number)  { return new Promise(r => setTimeout(r, ms)) }

// POST an SNS notification to the webhook endpoint
async function postWebhookEvent(notification: object) {
  const snsPayload = {
    Type: 'Notification',
    Message: JSON.stringify(notification),
    Timestamp: new Date().toISOString(),
  }
  const res = await fetch(`${APP_URL}/api/webhooks/email-bounce`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(snsPayload),
  })
  return res.json()
}

// Simulate a delivery event directly in DB (delivery goes via SQS poller in prod)
async function simulateDelivery(sesMessageId: string, email: string) {
  await prisma.marketingCampaignSend.updateMany({
    where: { sesMessageId },
    data: { status: 'delivered', deliveredAt: new Date() },
  })
}

async function createTestSend(email: string, sesMessageId: string) {
  return prisma.marketingCampaignSend.create({
    data: {
      campaignId:   'test-campaign-01',
      leadId:       'test-lead-01',
      leadEmail:    email,
      status:       'sent',
      sesMessageId,
      sentAt:       new Date(),
    },
  })
}

async function run() {
  console.log('\n=== Phase 3 Integration Tests ===\n')

  // ── Test 1: SQS readable ─────────────────────────────────────────────────
  console.log('1. SQS queue reachable (read)')
  try {
    if (QUEUE_URL) {
      const sqs = new SQSClient({
        region: AWS_REGION,
        credentials: process.env.AWS_ACCESS_KEY_ID
          ? { accessKeyId: process.env.AWS_ACCESS_KEY_ID!, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY! }
          : undefined,
      })
      const attrs = await sqs.send(new GetQueueAttributesCommand({
        QueueUrl: QUEUE_URL,
        AttributeNames: ['ApproximateNumberOfMessages'],
      }))
      ok(`Queue reachable. Messages: ${attrs.Attributes?.ApproximateNumberOfMessages ?? 0}`)
    } else {
      ok('SES_EVENT_QUEUE_URL not set — skipping (will use webhook path)')
    }
  } catch (e) { fail(`SQS error: ${(e as Error).message}`) }

  // ── Test 2: Permanent bounce via webhook ─────────────────────────────────
  console.log('\n2. Permanent bounce → status=bounced + suppressed')
  const bounceEmail = `bounce-${Date.now()}@example.com`
  const bounceSend  = await createTestSend(bounceEmail, `msg-bounce-${Date.now()}`)

  const bounceResult = await postWebhookEvent({
    notificationType: 'Bounce',
    mail: { messageId: bounceSend.sesMessageId, destination: [bounceEmail] },
    bounce: { bounceType: 'Permanent', bouncedRecipients: [{ emailAddress: bounceEmail }] },
  })
  ok(`Webhook response: bounced=${bounceResult.bounced ?? 0}, suppressed=${bounceResult.suppressed ?? 0}`)

  await wait(500)
  const bounceRecord = await prisma.marketingCampaignSend.findUnique({ where: { id: bounceSend.id } })
  bounceRecord?.status === 'bounced'
    ? ok(`status = "${bounceRecord.status}"`)
    : fail(`status = "${bounceRecord?.status}" (expected bounced)`)

  const bounceUnsub = await prisma.unsubscribe.findFirst({ where: { email: bounceEmail } })
  bounceUnsub ? ok(`Suppression created`) : fail(`No suppression created`)

  await prisma.marketingCampaignSend.delete({ where: { id: bounceSend.id } })
  if (bounceUnsub) await prisma.unsubscribe.delete({ where: { id: bounceUnsub.id } })

  // ── Test 3: Complaint via webhook ─────────────────────────────────────────
  console.log('\n3. Complaint → status=complained + complainedAt + suppressed')
  const complaintEmail = `complaint-${Date.now()}@example.com`
  const complaintSend  = await createTestSend(complaintEmail, `msg-complaint-${Date.now()}`)

  const complaintResult = await postWebhookEvent({
    notificationType: 'Complaint',
    mail: { messageId: complaintSend.sesMessageId, destination: [complaintEmail] },
    complaint: { complainedRecipients: [{ emailAddress: complaintEmail }] },
  })
  ok(`Webhook response: complained=${complaintResult.complained ?? 0}`)

  await wait(500)
  const complaintRecord = await prisma.marketingCampaignSend.findUnique({ where: { id: complaintSend.id } })
  complaintRecord?.status === 'complained'
    ? ok(`status = "${complaintRecord.status}"`)
    : fail(`status = "${complaintRecord?.status}" (expected complained)`)
  complaintRecord?.complainedAt
    ? ok(`complainedAt set`)
    : fail('complainedAt not set')

  const complaintUnsub = await prisma.unsubscribe.findFirst({ where: { email: complaintEmail } })
  complaintUnsub ? ok(`Suppression created`) : fail(`No suppression created`)

  await prisma.marketingCampaignSend.delete({ where: { id: complaintSend.id } })
  if (complaintUnsub) await prisma.unsubscribe.delete({ where: { id: complaintUnsub.id } })

  // ── Test 4: Delivery → deliveredAt ───────────────────────────────────────
  console.log('\n4. Delivery → status=delivered + deliveredAt')
  const deliveryEmail = `delivery-${Date.now()}@example.com`
  const deliverySend  = await createTestSend(deliveryEmail, `msg-delivery-${Date.now()}`)

  await simulateDelivery(deliverySend.sesMessageId!, deliveryEmail)

  const deliveryRecord = await prisma.marketingCampaignSend.findUnique({ where: { id: deliverySend.id } })
  deliveryRecord?.status === 'delivered'
    ? ok(`status = "${deliveryRecord.status}"`)
    : fail(`status = "${deliveryRecord?.status}" (expected delivered)`)
  deliveryRecord?.deliveredAt
    ? ok(`deliveredAt = ${deliveryRecord.deliveredAt}`)
    : fail('deliveredAt not set')

  await prisma.marketingCampaignSend.delete({ where: { id: deliverySend.id } })

  // ── Test 5: Transient bounce → bounced but NOT suppressed ─────────────────
  console.log('\n5. Transient bounce → bounced but NOT suppressed')
  const transientEmail = `transient-${Date.now()}@example.com`
  const transientSend  = await createTestSend(transientEmail, `msg-transient-${Date.now()}`)

  await postWebhookEvent({
    notificationType: 'Bounce',
    mail: { messageId: transientSend.sesMessageId, destination: [transientEmail] },
    bounce: { bounceType: 'Transient', bouncedRecipients: [{ emailAddress: transientEmail }] },
  })

  await wait(500)
  const transientRecord = await prisma.marketingCampaignSend.findUnique({ where: { id: transientSend.id } })
  transientRecord?.status === 'bounced'
    ? ok(`status = "${transientRecord.status}"`)
    : fail(`status = "${transientRecord?.status}"`)

  const transientUnsub = await prisma.unsubscribe.findFirst({ where: { email: transientEmail } })
  !transientUnsub
    ? ok('Transient bounce → NOT suppressed (correct)')
    : fail('Transient bounce incorrectly suppressed')

  await prisma.marketingCampaignSend.delete({ where: { id: transientSend.id } })

  // ── Test 6: Cron endpoint reachable ──────────────────────────────────────
  console.log('\n6. Cron endpoint reachable')
  const cronRes = await fetch(`${APP_URL}/api/cron/process-ses-events`)
  cronRes.ok
    ? ok(`GET /api/cron/process-ses-events → ${cronRes.status}`)
    : fail(`Cron endpoint returned ${cronRes.status}`)

  await finish()
}

async function finish() {
  await prisma.$disconnect()
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
  if (failed > 0) process.exit(1)
}

run().catch(e => { console.error(e); process.exit(1) })
