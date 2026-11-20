import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function buildScheduledFor(dateStr: string, hour: number, tz: string): Date {
  // dateStr is YYYY-MM-DD — creates datetime at that hour in the given timezone
  const localStr = `${dateStr}T${String(hour).padStart(2, '0')}:00:00`
  const ref = new Date(localStr)
  const tzDate = new Date(ref.toLocaleString('en-US', { timeZone: tz }))
  const offset = ref.getTime() - tzDate.getTime()
  return new Date(ref.getTime() + offset)
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const posts = await prisma.linkedInPost.findMany({
    where: { userId: session.user.id },
    orderBy: { scheduledFor: 'asc' },
    select: {
      id: true, content: true, scheduledFor: true,
      status: true, postedAt: true, linkedInPostId: true,
      error: true, createdAt: true, linkedInAccountId: true,
    },
  })
  return NextResponse.json({ posts })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { posts } = await req.json()
  if (!Array.isArray(posts) || posts.length === 0)
    return NextResponse.json({ error: 'posts array required' }, { status: 400 })
  if (posts.length > 30)
    return NextResponse.json({ error: 'max 30 posts' }, { status: 400 })

  for (const p of posts) {
    if (!p.content?.trim())          return NextResponse.json({ error: 'content required for every post' }, { status: 400 })
    if (p.content.trim().length > 3000) return NextResponse.json({ error: 'LinkedIn limit: 3000 characters per post' }, { status: 400 })
    if (!p.scheduledFor)             return NextResponse.json({ error: 'scheduledFor required for every post' }, { status: 400 })
  }

  const userId = session.user.id

  // Fetch user's posting time preferences
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { linkedInPostHour: true, linkedInPostTz: true },
  })
  const postHour = user?.linkedInPostHour ?? 19
  const postTz   = user?.linkedInPostTz ?? 'Asia/Kolkata'

  // Upsert by (userId, scheduledFor) — uses the user's configured hour+tz.
  const upserts = posts.map((p: { content: string; scheduledFor: string; linkedInAccountId?: string }) => {
    // dateStr is the YYYY-MM-DD portion from the client
    const dateStr = p.scheduledFor.slice(0, 10)
    const scheduledFor = buildScheduledFor(dateStr, postHour, postTz)
    return prisma.linkedInPost.upsert({
      where: { userId_scheduledFor: { userId, scheduledFor } },
      create: {
        userId,
        content:           p.content.trim(),
        scheduledFor,
        linkedInAccountId: p.linkedInAccountId ?? null,
        status:            'scheduled',
      },
      update: {
        content:           p.content.trim(),
        scheduledFor,
        linkedInAccountId: p.linkedInAccountId ?? null,
        status:            'scheduled',
        error:             null,
      },
    })
  })

  // Delete scheduled posts for days NOT in the new submission (user cleared those slots)
  const submittedDays = posts.map((p: { scheduledFor: string }) => {
    const dateStr = p.scheduledFor.slice(0, 10)
    return buildScheduledFor(dateStr, postHour, postTz)
  })

  await prisma.$transaction([
    ...upserts,
    prisma.linkedInPost.deleteMany({
      where: { userId, status: 'scheduled', scheduledFor: { notIn: submittedDays } },
    }),
  ])

  return NextResponse.json({ saved: upserts.length }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  await prisma.linkedInPost.deleteMany({ where: { id, userId: session.user.id, status: 'scheduled' } })
  return NextResponse.json({ ok: true })
}
