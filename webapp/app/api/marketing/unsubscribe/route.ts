import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function unsubscribedPage(email: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Unsubscribed</title></head>
<body style="font-family:sans-serif;max-width:480px;margin:80px auto;text-align:center;color:#444;">
  <h2 style="color:#111;">You've been unsubscribed</h2>
  <p>${email} has been removed from this mailing list.</p>
  <p style="font-size:13px;color:#999;">You won't receive any further marketing emails from us.</p>
</body>
</html>`
}

export async function GET(req: NextRequest) {
  const sid = req.nextUrl.searchParams.get('sid')

  if (!sid) {
    return new NextResponse(unsubscribedPage('your email address'), {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    })
  }

  try {
    const send = await prisma.marketingCampaignSend.findUnique({
      where: { trackingId: sid },
      include: { campaign: { select: { userId: true } } },
    })

    if (!send) {
      return new NextResponse(unsubscribedPage('your email address'), {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      })
    }

    const email = send.leadEmail
    const userId = send.campaign.userId

    if (!send.unsubscribedAt) {
      await prisma.marketingCampaignSend.update({
        where: { trackingId: sid },
        data: { unsubscribedAt: new Date() },
      })
    }

    // Upsert suppression record
    await prisma.unsubscribe.upsert({
      where: { email_userId: { email, userId } },
      update: {},
      create: { email, userId },
    })

    return new NextResponse(unsubscribedPage(email), {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    })
  } catch {
    return new NextResponse(unsubscribedPage('your email address'), {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    })
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { email, userId } = body

  if (!email || !userId) {
    return NextResponse.json({ error: 'email and userId are required' }, { status: 400 })
  }

  await prisma.unsubscribe.upsert({
    where: { email_userId: { email, userId } },
    update: {},
    create: { email, userId },
  })

  return NextResponse.json({ success: true })
}
