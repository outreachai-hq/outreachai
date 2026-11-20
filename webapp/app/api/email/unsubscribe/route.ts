import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const trackingId = req.nextUrl.searchParams.get('id')
  if (!trackingId) {
    return new NextResponse('<h1>Invalid unsubscribe link</h1>', { status: 400, headers: { 'Content-Type': 'text/html' } })
  }

  try {
    const msg = await prisma.emailMessage.findFirst({
      where: { trackingId },
      select: { id: true, userId: true, to: true },
    })

    if (msg) {
      // Add to global unsubscribe list (upsert — idempotent)
      await prisma.unsubscribe.upsert({
        where: { email_userId: { email: msg.to, userId: msg.userId } },
        create: { email: msg.to, userId: msg.userId },
        update: {},
      })

      // Stop any active campaign leads for this email
      const leads = await prisma.lead.findMany({
        where: { email: msg.to, leadList: { userId: msg.userId } },
        select: { id: true },
      })
      if (leads.length > 0) {
        await prisma.campaignLead.updateMany({
          where: {
            leadId: { in: leads.map((l) => l.id) },
            status: { in: ['pending', 'in_progress'] },
          },
          data: { status: 'completed', autoStopped: true, stoppedReason: 'unsubscribe', nextActionAt: null },
        })
      }
    }
  } catch {}

  return new NextResponse(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Unsubscribed</title></head>
    <body style="font-family:sans-serif;max-width:480px;margin:80px auto;text-align:center;color:#374151">
      <h1 style="font-size:24px;margin-bottom:12px">You've been unsubscribed</h1>
      <p style="color:#6b7280">You won't receive any more emails from this sender.</p>
    </body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html' } }
  )
}
