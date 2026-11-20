import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Public — no auth required.
// GET /api/meetings/[slug] — returns meeting page info for a slug.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params

  const page = await prisma.meetingPage.findUnique({
    where: { slug },
    include: { user: { select: { name: true } } },
  })

  if (!page || !page.active) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({
    id: page.id,
    slug: page.slug,
    title: page.title,
    description: page.description,
    duration: page.duration,
    timezone: page.timezone,
    weeklyHours: page.weeklyHours,
    bufferMins: page.bufferMins,
    active: page.active,
    ownerName: page.user.name ?? null,
  })
}
