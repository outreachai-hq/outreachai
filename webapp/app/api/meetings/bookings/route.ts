import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Auth-gated. GET returns all bookings for the logged-in user's MeetingPage.
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const page = await prisma.meetingPage.findUnique({
    where: { userId: session.user.id },
  })

  if (!page) {
    return NextResponse.json({ bookings: [] })
  }

  const showAll = req.nextUrl.searchParams.get('all') === '1'
  const now = new Date()

  const bookings = await prisma.booking.findMany({
    where: {
      meetingPageId: page.id,
      ...(showAll ? {} : { startAt: { gte: now } }),
    },
    orderBy: { startAt: 'asc' },
  })

  return NextResponse.json({
    bookings: bookings.map((b) => ({
      id: b.id,
      guestName: b.guestName,
      guestEmail: b.guestEmail,
      startAt: b.startAt.toISOString(),
      endAt: b.endAt.toISOString(),
      notes: b.notes,
      status: b.status,
      cancelToken: b.cancelToken,
    })),
    slug: page.slug,
  })
}
