import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendBookingEmails } from '@/lib/email/bookingEmails'
import { runWorkflowsForEvent } from '@/lib/workflowEngine'

// Public — no auth required.
// POST /api/meetings/[slug]/book
// Body: { startAt, guestName, guestEmail, notes? }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params

  const page = await prisma.meetingPage.findUnique({ where: { slug } })
  if (!page || !page.active) {
    return NextResponse.json({ error: 'Meeting page not found' }, { status: 404 })
  }

  const body = await req.json()
  const { startAt: startAtStr, guestName, guestEmail, notes } = body

  if (!startAtStr || !guestName?.trim() || !guestEmail?.trim()) {
    return NextResponse.json({ error: 'startAt, guestName, and guestEmail are required' }, { status: 400 })
  }

  const startAt = new Date(startAtStr)
  if (isNaN(startAt.getTime())) {
    return NextResponse.json({ error: 'Invalid startAt date' }, { status: 400 })
  }

  const endAt = new Date(startAt.getTime() + page.duration * 60 * 1000)

  // Check slot is still available — no confirmed booking at this time
  const conflict = await prisma.booking.findFirst({
    where: {
      meetingPageId: page.id,
      status: 'confirmed',
      startAt: startAt,
    },
  })

  if (conflict) {
    return NextResponse.json({ error: 'This slot is no longer available' }, { status: 409 })
  }

  // Create booking
  const booking = await prisma.booking.create({
    data: {
      meetingPageId: page.id,
      guestName: guestName.trim(),
      guestEmail: guestEmail.trim().toLowerCase(),
      startAt,
      endAt,
      notes: notes?.trim() ?? null,
      status: 'confirmed',
    },
  })

  // Send calendar invite emails to both guest and host (fire-and-forget)
  const owner = await prisma.user.findUnique({
    where: { id: page.userId },
    select: { email: true, name: true },
  })

  if (owner?.email) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
    const cancelUrl = `${appUrl}/api/meetings/cancel?token=${booking.cancelToken}`

    sendBookingEmails({
      booking: {
        id: booking.id,
        guestName: booking.guestName,
        guestEmail: booking.guestEmail,
        startAt: booking.startAt,
        endAt: booking.endAt,
        notes: booking.notes,
      },
      page: {
        title: page.title,
        duration: page.duration,
        timezone: page.timezone,
      },
      ownerName: owner.name ?? 'Your host',
      ownerEmail: owner.email,
      cancelUrl,
    }).catch(() => {})
  }

  runWorkflowsForEvent('booking.confirmed', page.userId, {
    bookingId: booking.id,
    guestEmail: booking.guestEmail,
    startAt: booking.startAt.toISOString(),
  }).catch(() => {})

  return NextResponse.json({
    booking: {
      id: booking.id,
      startAt: booking.startAt.toISOString(),
      endAt: booking.endAt.toISOString(),
      cancelToken: booking.cancelToken,
      guestName: booking.guestName,
    },
  })
}
