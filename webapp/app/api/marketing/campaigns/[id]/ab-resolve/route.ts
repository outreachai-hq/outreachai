import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/getUserId'
import { safeDecrypt } from '@/lib/encryption'
import nodemailer from 'nodemailer'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? ''
const SEND_DELAY_MS = 100

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function personalise(
  html: string,
  lead: { firstName: string; lastName?: string | null; company?: string | null; email?: string | null }
) {
  return html
    .replace(/\{\{firstName\}\}/gi, lead.firstName ?? '')
    .replace(/\{\{lastName\}\}/gi, lead.lastName ?? '')
    .replace(/\{\{company\}\}/gi, lead.company ?? '')
    .replace(/\{\{email\}\}/gi, lead.email ?? '')
}

function injectTracking(html: string, trackingId: string): string {
  const pixel = `<img src="${APP_URL}/api/marketing/track/open?sid=${trackingId}" width="1" height="1" style="display:none" alt="" />`
  const unsub = `<div style="text-align:center;padding:16px;font-size:11px;color:#999;font-family:sans-serif;">You received this because you're on our list. <a href="${APP_URL}/api/marketing/unsubscribe?sid=${trackingId}" style="color:#999;">Unsubscribe</a></div>`
  const withClickTracking = html.replace(
    /href="(https?[^"]+)"/g,
    (_, url) => `href="${APP_URL}/api/marketing/track/click?sid=${trackingId}&url=${encodeURIComponent(url)}"`
  )
  if (withClickTracking.includes('</body>')) {
    return withClickTracking.replace('</body>', `${pixel}${unsub}</body>`)
  }
  return withClickTracking + pixel + unsub
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { searchParams } = new URL(req.url)
  const auto = searchParams.get('auto') === 'true'

  const campaign = await prisma.marketingCampaign.findFirst({
    where: { id, userId },
    include: { emailAccount: true },
  })
  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!campaign.abEnabled) {
    return NextResponse.json({ error: 'A/B testing not enabled for this campaign' }, { status: 400 })
  }
  if (campaign.status !== 'ab_testing') {
    return NextResponse.json(
      { error: `Campaign is not in ab_testing state (current: ${campaign.status})` },
      { status: 409 }
    )
  }

  const sends = await prisma.marketingCampaignSend.findMany({ where: { campaignId: id } })

  // If auto=true, check if enough time has elapsed
  if (auto) {
    const earliest = sends
      .filter((s) => s.sentAt !== null)
      .sort((a, b) => (a.sentAt!.getTime() - b.sentAt!.getTime()))[0]

    if (!earliest?.sentAt) {
      return NextResponse.json({ pending: true, reason: 'No sends yet' })
    }
    const elapsedHours = (Date.now() - earliest.sentAt.getTime()) / 3_600_000
    if (elapsedHours < campaign.abTestDurationHours) {
      return NextResponse.json({
        pending: true,
        reason: 'Test duration not elapsed',
        elapsedHours: +elapsedHours.toFixed(2),
        requiredHours: campaign.abTestDurationHours,
      })
    }
  }

  // Count opens/clicks per variant
  // The send route writes 'A' / 'B'; compare case-insensitively
  const aSends = sends.filter((s) => s.abVariant?.toUpperCase() === 'A' && s.status === 'sent')
  const bSends = sends.filter((s) => s.abVariant?.toUpperCase() === 'B' && s.status === 'sent')

  const aOpened = aSends.filter((s) => s.openedAt !== null).length
  const bOpened = bSends.filter((s) => s.openedAt !== null).length
  const aClicked = aSends.filter((s) => s.clickedAt !== null).length
  const bClicked = bSends.filter((s) => s.clickedAt !== null).length

  const aOpenRate = aSends.length > 0 ? aOpened / aSends.length : 0
  const bOpenRate = bSends.length > 0 ? bOpened / bSends.length : 0
  const aClickRate = aSends.length > 0 ? aClicked / aSends.length : 0
  const bClickRate = bSends.length > 0 ? bClicked / bSends.length : 0

  const winner: 'a' | 'b' =
    campaign.abWinnerMetric === 'click'
      ? aClickRate >= bClickRate ? 'a' : 'b'
      : aOpenRate >= bOpenRate ? 'a' : 'b'

  const winningSubject = winner === 'a' ? campaign.subject : (campaign.abSubjectB ?? campaign.subject)

  // Find leads that haven't been sent to yet — those with no send record at all
  const sentLeadIds = new Set(sends.map((s) => s.leadId))
  const allLeads = await prisma.lead.findMany({
    where: { leadListId: campaign.recipientListId, email: { not: null } },
  })
  const unsubRecords = await prisma.unsubscribe.findMany({ where: { userId } })
  const unsubEmails = new Set(unsubRecords.map((u) => u.email.toLowerCase()))

  const remainingLeads = allLeads.filter(
    (l) => !sentLeadIds.has(l.id) && !unsubEmails.has((l.email ?? '').toLowerCase())
  )

  // Build transporter
  const account = campaign.emailAccount
  if (!account.smtpHost || !account.smtpUser || !account.smtpPass) {
    return NextResponse.json({ error: 'SMTP not configured' }, { status: 400 })
  }
  const smtpPass = safeDecrypt(account.smtpPass)
  const transporter = nodemailer.createTransport({
    host: account.smtpHost,
    port: account.smtpPort ?? 587,
    secure: (account.smtpPort ?? 587) === 465,
    auth: { user: account.smtpUser, pass: smtpPass ?? '' },
    ignoreTLS: account.smtpPort === 1025,
  })

  let remainingSent = 0
  for (const lead of remainingLeads) {
    const send = await prisma.marketingCampaignSend.create({
      data: { campaignId: id, leadId: lead.id, leadEmail: lead.email!, abVariant: null },
    })
    const personalised = personalise(campaign.htmlBody, lead)
    const finalHtml = injectTracking(personalised, send.trackingId)
    try {
      await transporter.sendMail({
        from: `"${campaign.fromName}" <${account.email}>`,
        to: lead.email!,
        subject: winningSubject,
        html: finalHtml,
      })
      await prisma.marketingCampaignSend.update({
        where: { id: send.id },
        data: { status: 'sent', sentAt: new Date() },
      })
      remainingSent++
    } catch {
      await prisma.marketingCampaignSend.update({ where: { id: send.id }, data: { status: 'failed' } })
    }
    await sleep(SEND_DELAY_MS)
  }

  await prisma.marketingCampaign.update({
    where: { id },
    data: { abWinner: winner, abWinnerSentAt: new Date(), status: 'sent' },
  })

  return NextResponse.json({
    winner,
    aOpenRate: +aOpenRate.toFixed(4),
    bOpenRate: +bOpenRate.toFixed(4),
    aClickRate: +aClickRate.toFixed(4),
    bClickRate: +bClickRate.toFixed(4),
    remainingSent,
  })
}
