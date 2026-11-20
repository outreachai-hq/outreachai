import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/getUserId'
import { safeDecrypt } from '@/lib/encryption'
import { isWithinSendWindow, parseSendWindow } from '@/lib/timezone'
import { applyVars } from '@/lib/sequenceRunner'
import nodemailer from 'nodemailer'

const RATE_LIMIT = 10
const WINDOW_MS  = 60_000

async function checkRateLimit(userId: string): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MS)
  const count = await prisma.emailMessage.count({ where: { userId, sentAt: { gte: since } } })
  return count < RATE_LIMIT
}


function buildHtml(text: string, trackingId: string, appUrl: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  // Wrap bare URLs with click-tracking
  const linked = escaped.replace(
    /(https?:\/\/[^\s<>"]+)/g,
    (url) => `<a href="${appUrl}/api/email/track/click?id=${trackingId}&url=${encodeURIComponent(url)}">${url}</a>`
  )
  const withBr = linked.replace(/\n/g, '<br>\n')
  const pixel  = `<img src="${appUrl}/api/email/track/open?id=${trackingId}" width="1" height="1" style="display:none" alt="" />`
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;font-size:14px;line-height:1.6">${withBr}${pixel}</body></html>`
}

export async function POST(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!await checkRateLimit(userId))
    return NextResponse.json({ error: 'Rate limit: max 10 emails per minute' }, { status: 429 })

  const body = await req.json()
  const { emailAccountId, to, subject, bodyText, vars = {}, contactId, campaignId } = body

  if (!emailAccountId || !to || !subject || !bodyText)
    return NextResponse.json({ error: 'emailAccountId, to, subject, bodyText required' }, { status: 400 })

  // Timezone send-window guard
  if (campaignId) {
    const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, userId } })
    if (campaign) {
      const [start, end] = parseSendWindow(campaign.sendWindow)
      if (!isWithinSendWindow(campaign.timezone, start, end)) {
        return NextResponse.json(
          { error: `Outside send window (${start}:00–${end}:00 ${campaign.timezone})` },
          { status: 425 }
        )
      }
    }
  }

  const account = await prisma.emailAccount.findFirst({ where: { id: emailAccountId, userId } })
  if (!account) return NextResponse.json({ error: 'Email account not found' }, { status: 404 })
  if (!account.smtpHost || !account.smtpUser || !account.smtpPass)
    return NextResponse.json({ error: 'SMTP not configured on this account' }, { status: 400 })

  const finalSubject = applyVars(subject, vars)
  const finalBody    = applyVars(bodyText, vars)
  const smtpPass     = safeDecrypt(account.smtpPass)

  // Create EmailMessage FIRST to get trackingId for the pixel
  const msg = await prisma.emailMessage.create({
    data: { userId, emailAccountId: account.id, contactId: contactId ?? null, to, subject: finalSubject, body: finalBody, status: 'sent' },
  })

  const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const htmlBody = appUrl ? buildHtml(finalBody, msg.trackingId, appUrl) : undefined

  const transporter = nodemailer.createTransport({
    host:      account.smtpHost,
    port:      account.smtpPort ?? 587,
    secure:    (account.smtpPort ?? 587) === 465,
    auth:      { user: account.smtpUser, pass: smtpPass ?? '' },
    ignoreTLS: account.smtpPort === 1025,
  })

  try {
    await transporter.sendMail({
      from:    `"${account.name}" <${account.email}>`,
      to,
      subject: finalSubject,
      text:    finalBody,
      ...(htmlBody ? { html: htmlBody } : {}),
    })
  } catch (err: unknown) {
    // Roll back the premature EmailMessage record on SMTP failure
    await prisma.emailMessage.delete({ where: { id: msg.id } }).catch(() => {})
    const message = err instanceof Error ? err.message : 'SMTP error'
    return NextResponse.json({ error: `Failed to send: ${message}` }, { status: 502 })
  }

  return NextResponse.json({ messageId: msg.id, trackingId: msg.trackingId }, { status: 201 })
}
