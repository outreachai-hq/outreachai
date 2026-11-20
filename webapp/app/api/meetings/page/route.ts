import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET — return current user's MeetingPage config (or null)
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const page = await prisma.meetingPage.findUnique({
    where: { userId: session.user.id },
  })

  return NextResponse.json({ page })
}

// POST — upsert the user's MeetingPage
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { slug, title, description, duration, timezone, weeklyHours, bufferMins, active } = body

  if (!slug) return NextResponse.json({ error: 'slug is required' }, { status: 400 })

  const slugPattern = /^[a-z0-9-]{3,40}$/
  if (!slugPattern.test(slug)) {
    return NextResponse.json(
      { error: 'Slug must be 3–40 lowercase letters, numbers, or hyphens' },
      { status: 400 },
    )
  }

  // Check uniqueness — slug must not be taken by another user
  const existing = await prisma.meetingPage.findUnique({ where: { slug } })
  if (existing && existing.userId !== session.user.id) {
    return NextResponse.json({ error: 'This slug is already taken' }, { status: 409 })
  }

  const page = await prisma.meetingPage.upsert({
    where: { userId: session.user.id },
    update: {
      slug,
      title: title ?? 'Book a meeting',
      description: description ?? null,
      duration: duration ?? 30,
      timezone: timezone ?? 'Asia/Kolkata',
      weeklyHours: weeklyHours ?? {},
      bufferMins: bufferMins ?? 15,
      active: active !== undefined ? active : true,
      updatedAt: new Date(),
    },
    create: {
      userId: session.user.id,
      slug,
      title: title ?? 'Book a meeting',
      description: description ?? null,
      duration: duration ?? 30,
      timezone: timezone ?? 'Asia/Kolkata',
      weeklyHours: weeklyHours ?? {},
      bufferMins: bufferMins ?? 15,
      active: active !== undefined ? active : true,
    },
  })

  return NextResponse.json({ page })
}
