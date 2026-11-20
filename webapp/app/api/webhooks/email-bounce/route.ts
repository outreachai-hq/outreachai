// Inbound bounce webhook — handles async bounce notifications from SendGrid
// and AWS SES (via SNS). Both providers post to this single endpoint.
//
// Configure in your provider dashboard:
//   SendGrid: Settings → Mail Settings → Event Webhook → URL = /api/webhooks/email-bounce
//   SES:      SNS Topic → Subscription → HTTPS → /api/webhooks/email-bounce
//
// Authentication:
//   SES/SNS   — every message's AWS signature is verified (no config needed).
//   SendGrid  — set SENDGRID_WEBHOOK_SECRET to the "Verification Key" from
//               Settings → Mail Settings → Signed Event Webhook (base64 public key).
//   Optional  — EMAIL_BOUNCE_WEBHOOK_USER / EMAIL_BOUNCE_WEBHOOK_PASS add HTTP
//               Basic Auth in front of everything.
// In production, SendGrid events are rejected unless one of the above is set.

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { verifySnsMessage, isSnsUrl, type SnsMessage } from '@/lib/snsVerify'

// ── Helpers ───────────────────────────────────────────────────────────────────

async function suppressAddress(email: string) {
  // Find all users who have sent to this address and suppress for each
  const msgs = await prisma.emailMessage.findMany({
    where: { to: email },
    select: { userId: true },
    distinct: ['userId'],
  })
  const sends = await prisma.marketingCampaignSend.findMany({
    where: { leadEmail: email },
    select: { campaign: { select: { userId: true } } },
    distinct: ['campaignId'],
  })

  const userIds = new Set<string>([
    ...msgs.map((m) => m.userId),
    ...sends.map((s) => s.campaign.userId),
  ])

  await Promise.all(
    [...userIds].map((userId) =>
      prisma.unsubscribe.upsert({
        where: { email_userId: { email: email.toLowerCase(), userId } },
        update: {},
        create: { email: email.toLowerCase(), userId },
      }).catch(() => {})
    )
  )
}

async function markEmailMessageBounced(email: string) {
  await prisma.emailMessage.updateMany({
    where: { to: email, status: { not: 'bounced' } },
    data: { status: 'bounced' },
  }).catch(() => {})
  await prisma.marketingCampaignSend.updateMany({
    where: { leadEmail: email, status: { not: 'bounced' } },
    data: { status: 'bounced' },
  }).catch(() => {})
}

// ── SendGrid signature verification ──────────────────────────────────────────

function verifySendgrid(rawBody: string, req: NextRequest, basicAuthPassed: boolean): boolean {
  const key = process.env.SENDGRID_WEBHOOK_SECRET
  if (!key) {
    // No verification key: only accept if Basic Auth protected the request,
    // or outside production (local development).
    return basicAuthPassed || process.env.NODE_ENV !== 'production'
  }
  const sig = req.headers.get('x-twilio-email-event-webhook-signature')
  const ts  = req.headers.get('x-twilio-email-event-webhook-timestamp')
  if (!sig || !ts) return false
  try {
    const publicKey = crypto.createPublicKey({ key: Buffer.from(key, 'base64'), format: 'der', type: 'spki' })
    return crypto.verify('sha256', Buffer.from(ts + rawBody, 'utf8'), publicKey, Buffer.from(sig, 'base64'))
  } catch {
    return false
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  // Optional HTTP Basic Auth guard
  const bounceUser = process.env.EMAIL_BOUNCE_WEBHOOK_USER
  const bouncePass = process.env.EMAIL_BOUNCE_WEBHOOK_PASS
  let basicAuthPassed = false
  if (bounceUser && bouncePass) {
    const auth = req.headers.get('authorization') ?? ''
    const expected = `Basic ${Buffer.from(`${bounceUser}:${bouncePass}`).toString('base64')}`
    if (auth.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(auth), Buffer.from(expected))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    basicAuthPassed = true
  }

  let payload: unknown
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const bouncedEmails          = new Set<string>() // all bounces — mark status
  const permanentBouncedEmails = new Set<string>() // permanent only — suppress
  const complainedEmails       = new Set<string>()

  // ── AWS SES via SNS ────────────────────────────────────────────────────────
  // SNS first sends a SubscriptionConfirmation — respond with 200 so SNS
  // completes the subscription automatically.
  if (typeof payload === 'object' && payload !== null && 'Type' in payload) {
    const sns = payload as Record<string, unknown>

    // Reject anything not signed by AWS SNS (prevents forged bounces and SSRF
    // via an attacker-controlled SubscribeURL).
    if (!(await verifySnsMessage(sns as unknown as SnsMessage))) {
      return NextResponse.json({ error: 'Invalid SNS signature' }, { status: 401 })
    }

    if (sns.Type === 'SubscriptionConfirmation') {
      const url = sns.SubscribeURL as string | undefined
      if (isSnsUrl(url)) await fetch(url as string).catch(() => {})
      return NextResponse.json({ ok: true })
    }

    if (sns.Type === 'Notification') {
      try {
        const msg = JSON.parse(sns.Message as string) as Record<string, unknown>

        if (msg.notificationType === 'Bounce') {
          const bounce = msg.bounce as Record<string, unknown>
          const isPermanent = bounce.bounceType === 'Permanent'
          const recipients = (bounce.bouncedRecipients as { emailAddress: string }[]) ?? []
          for (const r of recipients) {
            if (r.emailAddress) {
              bouncedEmails.add(r.emailAddress.toLowerCase())
              if (isPermanent) permanentBouncedEmails.add(r.emailAddress.toLowerCase())
            }
          }
        }

        if (msg.notificationType === 'Complaint') {
          const complaint = msg.complaint as Record<string, unknown>
          const recipients = (complaint.complainedRecipients as { emailAddress: string }[]) ?? []
          for (const r of recipients) {
            if (r.emailAddress) complainedEmails.add(r.emailAddress.toLowerCase())
          }
        }
      } catch { /* malformed SNS message — ignore */ }
    }
  }

  // ── SendGrid event webhook ─────────────────────────────────────────────────
  // Payload is a JSON array of event objects.
  if (Array.isArray(payload)) {
    if (!verifySendgrid(rawBody, req, basicAuthPassed)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
    for (const event of payload as Record<string, unknown>[]) {
      // event.event is 'bounce', 'blocked', 'dropped', or 'spamreport'
      // SendGrid only reports these after giving up on delivery, so treat as permanent
      if (['bounce', 'blocked', 'dropped'].includes(event.event as string)) {
        const email = event.email as string | undefined
        if (email) {
          bouncedEmails.add(email.toLowerCase())
          permanentBouncedEmails.add(email.toLowerCase())
        }
      }
    }
  }

  // ── Process bounces ───────────────────────────────────────────────────────
  // Mark all bounces; only suppress permanent ones (transient = temporary delivery failure)
  await Promise.all(
    [...bouncedEmails].map(async (email) => {
      await markEmailMessageBounced(email)
      if (permanentBouncedEmails.has(email)) await suppressAddress(email)
    })
  )

  // ── Process complaints (suppress + mark) ──────────────────────────────────
  await Promise.all(
    [...complainedEmails].map(async (email) => {
      await suppressAddress(email)
      await prisma.marketingCampaignSend.updateMany({
        where: { leadEmail: email, status: { not: 'complained' } },
        data: { status: 'complained', complainedAt: new Date() },
      }).catch(() => {})
    })
  )

  return NextResponse.json({
    ok: true,
    suppressed: permanentBouncedEmails.size + complainedEmails.size,
    bounced:    bouncedEmails.size,
    complained: complainedEmails.size,
  })
}
