import { type NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fireWebhook } from '@/lib/webhooks'
import { Activity } from '@/lib/activity'
import { recordLeadOpen } from '@/lib/leadScore'
import { runWorkflowsForEvent } from '@/lib/workflowEngine'

const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')

export const runtime = 'nodejs'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const trackingId = req.nextUrl.searchParams.get('id')

  if (trackingId) {
    try {
      await prisma.emailMessage.updateMany({
        where: { trackingId },
        data: { status: 'opened', openedAt: new Date() },
      })
      await prisma.emailEvent.create({ data: { trackingId, type: 'opened' } })

      // Fire webhook (fire-and-forget)
      const msg = await prisma.emailMessage.findFirst({
        where: { trackingId },
        select: { id: true, userId: true, to: true },
      })
      const sentActivity = msg ? await prisma.leadActivity.findFirst({
        where: { messageId: msg.id, type: 'email.sent' },
        select: { campaignId: true, sequenceStepId: true },
      }).catch(() => null) : null
      if (msg) {
        fireWebhook(msg.userId, 'email.opened', {
          trackingId,
          email: msg.to,
          openedAt: new Date().toISOString(),
        })

        // Activity timeline emit — resolve a matching lead via (userId, email)
        // so the lead-detail timeline picks up the open.
        const lead = await prisma.lead.findFirst({
          where: { email: msg.to, leadList: { userId: msg.userId } },
          select: { id: true, openCount: true },
        }).catch(() => null)
        if (lead) {
          Activity.emailOpened({
            userId: msg.userId,
            leadId: lead.id,
            messageId: msg.id,
            campaignId: sentActivity?.campaignId ?? undefined,
            sequenceStepId: sentActivity?.sequenceStepId ?? undefined,
          }).catch(() => {})
          recordLeadOpen(lead.id).catch(() => {})
          runWorkflowsForEvent('lead.email_opened', msg.userId, {
            leadId: lead.id, campaignId: sentActivity?.campaignId ?? undefined,
            openCount: (lead as { openCount?: number }).openCount ?? 1,
          }).catch(() => {})
        }
      }
    } catch {}
  }

  return new NextResponse(PIXEL, {
    status: 200,
    headers: {
      'Content-Type':  'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma':        'no-cache',
    },
  })
}
