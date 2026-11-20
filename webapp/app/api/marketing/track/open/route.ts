import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')

export async function GET(req: NextRequest): Promise<NextResponse> {
  const sid = req.nextUrl.searchParams.get('sid')

  if (sid) {
    try {
      const send = await prisma.marketingCampaignSend.findUnique({ where: { trackingId: sid } })
      if (send && send.openedAt === null) {
        await prisma.marketingCampaignSend.update({
          where: { trackingId: sid },
          data: { openedAt: new Date() },
        })
      }
    } catch {}
  }

  return new NextResponse(PIXEL, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      Pragma: 'no-cache',
    },
  })
}
