import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { websiteTrackingId: true },
  })

  // Auto-generate trackingId if not set
  if (!user?.websiteTrackingId) {
    const trackingId = crypto.randomBytes(12).toString('base64url')
    user = await prisma.user.update({
      where: { id: session.user.id },
      data: { websiteTrackingId: trackingId },
      select: { websiteTrackingId: true },
    })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://outreachai.in'
  const snippet = `<script src="${appUrl}/api/track/snippet?t=${user!.websiteTrackingId}" async></script>`

  return NextResponse.json({
    trackingId: user!.websiteTrackingId,
    snippet,
    beaconUrl: `${appUrl}/api/track/visit`,
  })
}
