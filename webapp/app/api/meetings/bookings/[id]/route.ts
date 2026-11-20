import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Auth-gated. PATCH to cancel a booking.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  if (body.status !== 'cancelled') {
    return NextResponse.json({ error: 'Only cancellation is supported' }, { status: 400 })
  }

  // Verify the booking belongs to this user's meeting page
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { meetingPage: { select: { userId: true } } },
  })

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }

  if (booking.meetingPage.userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const updated = await prisma.booking.update({
    where: { id },
    data: { status: 'cancelled' },
  })

  return NextResponse.json({ booking: { id: updated.id, status: updated.status } })
}
