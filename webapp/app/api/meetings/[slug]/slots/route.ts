import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Public — no auth required.
// GET /api/meetings/[slug]/slots?date=YYYY-MM-DD
// Returns available time slots for a given date.

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

function formatLabel(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const dateParam = req.nextUrl.searchParams.get('date')

  if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return NextResponse.json({ error: 'date query param required (YYYY-MM-DD)' }, { status: 400 })
  }

  const page = await prisma.meetingPage.findUnique({ where: { slug } })
  if (!page || !page.active) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Parse the requested date in the page's timezone using Intl
  // We interpret dateParam as a local date in the page's timezone
  const [year, month, day] = dateParam.split('-').map(Number)

  // Build a Date for midnight local in timezone (approximate using UTC offset)
  // For simplicity we use the date components directly and treat slots as UTC times
  // The slot start/end are stored as UTC; we generate them from the declared weeklyHours
  // as if the hours are in the timezone context.

  // Get weekday of the requested date
  const requestedDate = new Date(Date.UTC(year, month - 1, day))
  const dayOfWeek = requestedDate.getUTCDay() // 0=Sun
  const dayKey = DAY_KEYS[dayOfWeek]

  const weeklyHours = page.weeklyHours as Record<string, number[][]>
  const ranges: number[][] = weeklyHours[dayKey] ?? []

  if (ranges.length === 0) {
    return NextResponse.json({ slots: [] })
  }

  // Generate all candidate slots
  const duration = page.duration
  const candidateSlots: { startAt: Date; endAt: Date; label: string }[] = []

  for (const [startHour, endHour] of ranges) {
    let currentMinutes = startHour * 60
    const endMinutes = endHour * 60

    while (currentMinutes + duration <= endMinutes) {
      const slotStart = new Date(Date.UTC(year, month - 1, day, Math.floor(currentMinutes / 60), currentMinutes % 60))
      const slotEnd = new Date(slotStart.getTime() + duration * 60 * 1000)
      candidateSlots.push({ startAt: slotStart, endAt: slotEnd, label: formatLabel(slotStart) })
      currentMinutes += duration
    }
  }

  if (candidateSlots.length === 0) {
    return NextResponse.json({ slots: [] })
  }

  // Find start/end of the day for the DB query
  const dayStart = new Date(Date.UTC(year, month - 1, day, 0, 0, 0))
  const dayEnd = new Date(Date.UTC(year, month - 1, day, 23, 59, 59))

  // Get existing confirmed bookings for this day
  const existingBookings = await prisma.booking.findMany({
    where: {
      meetingPageId: page.id,
      status: 'confirmed',
      startAt: { gte: dayStart, lte: dayEnd },
    },
    select: { startAt: true },
  })

  const bookedTimes = new Set(existingBookings.map((b) => b.startAt.getTime()))

  // Current time + buffer
  const now = new Date()
  const cutoff = new Date(now.getTime() + page.bufferMins * 60 * 1000)

  // Filter slots
  const availableSlots = candidateSlots.filter((slot) => {
    // Not already booked
    if (bookedTimes.has(slot.startAt.getTime())) return false
    // Not in the past (with buffer)
    if (slot.startAt <= cutoff) return false
    return true
  })

  return NextResponse.json({
    slots: availableSlots.map((s) => ({
      startAt: s.startAt.toISOString(),
      endAt: s.endAt.toISOString(),
      label: s.label,
    })),
  })
}
