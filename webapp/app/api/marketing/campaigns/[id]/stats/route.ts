import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/getUserId'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const campaign = await prisma.marketingCampaign.findFirst({ where: { id, userId } })
  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const sends = await prisma.marketingCampaignSend.findMany({ where: { campaignId: id } })

  const total       = sends.length
  const delivered   = sends.filter((s) => s.deliveredAt !== null).length
  const bounced     = sends.filter((s) => s.status === 'bounced').length
  const complained  = sends.filter((s) => s.status === 'complained').length
  const failed      = sends.filter((s) => s.status === 'failed').length
  const opened      = sends.filter((s) => s.openedAt !== null).length
  const clicked     = sends.filter((s) => s.clickedAt !== null).length
  const unsubscribed = sends.filter((s) => s.unsubscribedAt !== null).length

  // Base for rates: all sends that left the queue (sent + delivered + bounced + complained)
  const totalSent   = sends.filter((s) => s.sentAt !== null).length

  const openRate      = totalSent > 0 ? +(opened / totalSent).toFixed(4) : 0
  const clickRate     = totalSent > 0 ? +(clicked / totalSent).toFixed(4) : 0
  const unsubRate     = totalSent > 0 ? +(unsubscribed / totalSent).toFixed(4) : 0
  const bounceRate    = totalSent > 0 ? +(bounced / totalSent).toFixed(4) : 0
  const complaintRate = totalSent > 0 ? +(complained / totalSent).toFixed(4) : 0
  const deliveryRate  = totalSent > 0 ? +(delivered / totalSent).toFixed(4) : 0

  const response: Record<string, unknown> = {
    total, sent: totalSent, delivered, bounced, complained, failed,
    opened, clicked, unsubscribed,
    openRate, clickRate, unsubRate, bounceRate, complaintRate, deliveryRate,
  }

  if ((campaign as any).abEnabled) {
    // Worker assigns uppercase 'A'/'B' — match exactly
    const aSends   = sends.filter((s) => s.abVariant?.toUpperCase() === 'A')
    const bSends   = sends.filter((s) => s.abVariant?.toUpperCase() === 'B')
    const remainder = sends.filter((s) => s.abVariant === null)

    const countSent = (arr: typeof sends) => arr.filter((s) => s.status === 'sent').length
    const countOpened = (arr: typeof sends) => arr.filter((s) => s.openedAt !== null).length
    const countClicked = (arr: typeof sends) => arr.filter((s) => s.clickedAt !== null).length
    const rate = (n: number, d: number) => d > 0 ? +(n / d).toFixed(4) : 0

    const aSent = countSent(aSends); const bSent = countSent(bSends)
    response.ab = {
      enabled: true,
      variantA: { sent: aSent, opened: countOpened(aSends), clicked: countClicked(aSends), openRate: rate(countOpened(aSends), aSent) },
      variantB: { sent: bSent, opened: countOpened(bSends), clicked: countClicked(bSends), openRate: rate(countOpened(bSends), bSent) },
      winner: (campaign as any).abWinner ?? null,
      remainingSent: countSent(remainder),
    }
  }

  return NextResponse.json(response)
}
