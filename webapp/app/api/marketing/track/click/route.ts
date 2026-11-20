import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveTrackedDestination } from '@/lib/trackedRedirect'

export async function GET(req: NextRequest) {
  const sid = req.nextUrl.searchParams.get('sid')
  const url = req.nextUrl.searchParams.get('url')

  let isKnownSend = false
  if (sid) {
    try {
      const send = await prisma.marketingCampaignSend.findUnique({ where: { trackingId: sid } })
      isKnownSend = !!send
      if (send && send.clickedAt === null) {
        await prisma.marketingCampaignSend.update({
          where: { trackingId: sid },
          data: { clickedAt: new Date() },
        })
      }
    } catch {}
  }

  return NextResponse.redirect(resolveTrackedDestination(url, isKnownSend))
}
