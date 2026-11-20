import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/getUserId'
import { marketingSendQueue, type MarketingSendJob } from '@/lib/queues/marketing-send.queue'
import { startMarketingSendWorker } from '@/lib/queues/marketing-send.worker'
import { startSesEventPoller } from '@/lib/ses-event-poller'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? ''

// Start background services when this route is first loaded
startMarketingSendWorker()
startSesEventPoller()

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

  // 1. Fetch campaign + email account
  const campaign = await prisma.marketingCampaign.findFirst({
    where: { id, userId },
    include: { emailAccount: true },
  })
  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!['draft', 'scheduled'].includes(campaign.status)) {
    return NextResponse.json(
      { error: `Campaign status "${campaign.status}" cannot be sent` },
      { status: 409 }
    )
  }

  // 2. Validate email account credentials
  const account = campaign.emailAccount
  if (account.provider === 'ses' && (!account.awsRegion || !account.awsAccessKeyId || !account.awsSecretAccessKey)) {
    return NextResponse.json({ error: 'SES credentials not configured' }, { status: 400 })
  } else if (account.provider === 'sendgrid' && !account.sendgridApiKey) {
    return NextResponse.json({ error: 'SendGrid API key not configured' }, { status: 400 })
  } else if (!['ses', 'sendgrid'].includes(account.provider) && (!account.smtpHost || !account.smtpUser || !account.smtpPass)) {
    return NextResponse.json({ error: 'SMTP not configured' }, { status: 400 })
  }

  // 2b. Reputation health check — block send if bounce or complaint rate is too high.
  // SES suspends accounts at 2% bounce / 0.1% complaint — check before queuing 1L+ sends.
  const recentSends = await prisma.marketingCampaignSend.findMany({
    where: { campaign: { userId }, sentAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    select: { status: true },
  })
  if (recentSends.length >= 100) {
    const totalRecent    = recentSends.length
    const bouncedRecent  = recentSends.filter((s) => s.status === 'bounced').length
    const complainedRecent = recentSends.filter((s) => s.status === 'complained').length
    const bounceRate     = bouncedRecent / totalRecent
    const complaintRate  = complainedRecent / totalRecent

    if (bounceRate > 0.02) {
      return NextResponse.json({
        error: `Send blocked: bounce rate ${(bounceRate * 100).toFixed(1)}% exceeds 2% threshold. Clean your list before sending.`,
      }, { status: 422 })
    }
    if (complaintRate > 0.001) {
      return NextResponse.json({
        error: `Send blocked: complaint rate ${(complaintRate * 100).toFixed(2)}% exceeds 0.1% threshold. Review your content.`,
      }, { status: 422 })
    }
  }

  // 3. Fetch leads + suppression list
  const [leads, unsubRecords] = await Promise.all([
    prisma.lead.findMany({
      where: { leadListId: campaign.recipientListId, email: { not: null } },
    }),
    prisma.unsubscribe.findMany({ where: { userId } }),
  ])

  const unsubEmails = new Set(unsubRecords.map((u) => u.email.toLowerCase()))
  const eligibleLeads = leads.filter((l) => !unsubEmails.has((l.email ?? '').toLowerCase()))
  const skipped = leads.length - eligibleLeads.length

  // 4. Handle zero-eligible-leads edge case — mark complete immediately
  if (eligibleLeads.length === 0) {
    await prisma.marketingCampaign.update({
      where: { id },
      data: { status: 'sent', sentAt: new Date(), stats: { total: 0, sent: 0, skipped } },
    })
    return NextResponse.json({ success: true, queued: 0, skipped, message: 'All leads suppressed — campaign marked sent.' })
  }

  // 5. Mark campaign as sending immediately — don't make the caller wait
  await prisma.marketingCampaign.update({
    where: { id },
    data: {
      status: 'sending',
      stats: { total: eligibleLeads.length, sent: 0, skipped },
    },
  })

  // 6. Create send records + enqueue jobs
  // Credentials are NOT included in job data — worker fetches + decrypts from DB.
  // This ensures decrypted secrets never live in Redis.
  const totalEligible = eligibleLeads.length
  const abSplitCount  = campaign.abEnabled
    ? Math.floor((campaign.abSplitPercent / 100) * totalEligible)
    : 0

  const jobs = await Promise.all(
    eligibleLeads.map(async (lead, index) => {
      const abVariant = campaign.abEnabled
        ? (index < abSplitCount ? 'B' : 'A')
        : undefined

      const subject = abVariant === 'B' && campaign.abSubjectB
        ? campaign.abSubjectB
        : campaign.subject

      const send = await prisma.marketingCampaignSend.create({
        data: { campaignId: id, leadId: lead.id, leadEmail: lead.email!, abVariant },
      })

      const personalised = personalise(campaign.htmlBody, lead)
      const finalHtml    = injectTracking(personalised, send.trackingId)

      return {
        name: `send-${send.id}`,
        data: {
          campaignId: id,
          sendId:     send.id,
          leadEmail:  lead.email!,
          leadFirstName: lead.firstName,
          leadLastName:  lead.lastName,
          leadCompany:   lead.company,
          subject,
          htmlBody:   finalHtml,
          fromName:   campaign.fromName,
          fromEmail:  account.email,
          trackingId: send.trackingId,
          listUnsubscribeUrl: `${APP_URL}/api/marketing/unsubscribe?sid=${send.trackingId}`,
          abVariant,
          accountId:  account.id, // credentials fetched by worker at send time
        } satisfies MarketingSendJob,
      }
    })
  )

  await marketingSendQueue.addBulk(jobs.map((j) => ({ name: j.name, data: j.data })))

  return NextResponse.json({
    success: true,
    queued: eligibleLeads.length,
    skipped,
    message: `${eligibleLeads.length} emails queued. Sending at ~14/sec.`,
  })
}
