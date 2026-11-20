import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveTrackedDestination } from '@/lib/trackedRedirect'
import { fireWebhook } from '@/lib/webhooks'
import { Activity } from '@/lib/activity'
import { recordLeadClick } from '@/lib/leadScore'

export async function GET(req: NextRequest) {
  const trackingId = req.nextUrl.searchParams.get('id')
  const url        = req.nextUrl.searchParams.get('url')

  let isKnownSend = false
  if (trackingId && url) {
    try {
      await prisma.emailEvent.create({ data: { trackingId, type: 'clicked', url } })

      const msg = await prisma.emailMessage.findFirst({
        where: { trackingId },
        select: { id: true, userId: true, to: true },
      })
      const sentActivity = msg ? await prisma.leadActivity.findFirst({
        where: { messageId: msg.id, type: 'email.sent' },
        select: { campaignId: true, sequenceStepId: true },
      }).catch(() => null) : null
      isKnownSend = !!msg
      if (msg) {
        const decoded = decodeURIComponent(url)
        fireWebhook(msg.userId, 'email.clicked', {
          trackingId,
          url: decoded,
          email: msg.to,
          clickedAt: new Date().toISOString(),
        })

        // Activity timeline — resolve the matching lead via (userId, email).
        const lead = await prisma.lead.findFirst({
          where: { email: msg.to, leadList: { userId: msg.userId } },
          select: { id: true },
        }).catch(() => null)
        if (lead) {
          Activity.emailClicked({
            userId: msg.userId,
            leadId: lead.id,
            url: decoded,
            messageId: msg.id,
            campaignId: sentActivity?.campaignId ?? undefined,
            sequenceStepId: sentActivity?.sequenceStepId ?? undefined,
          }).catch(() => {})
          recordLeadClick(lead.id).catch(() => {})
        }
      }
    } catch {}
  }

  return NextResponse.redirect(resolveTrackedDestination(url, isKnownSend))
}
