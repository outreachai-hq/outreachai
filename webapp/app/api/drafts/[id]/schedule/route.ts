// Plan 8 — schedule a draft for a future send. The cron picks it up later.
// Passing `scheduledFor: null` cancels the schedule.

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const body = await req.json().catch(() => ({}))
  const raw = body.scheduledFor
  if (raw !== null && (typeof raw !== 'string' || !Number.isFinite(new Date(raw).getTime()))) {
    return NextResponse.json({ error: 'scheduledFor must be ISO string or null' }, { status: 400 })
  }
  const scheduledFor = raw === null ? null : new Date(raw)
  if (scheduledFor && scheduledFor.getTime() < Date.now() - 60_000) {
    return NextResponse.json({ error: 'scheduledFor must be in the future' }, { status: 400 })
  }

  const result = await prisma.draftMessage.updateMany({
    where: { id, userId: session.user.id, status: { in: ['pending', 'edited'] } },
    data:  { scheduledFor },
  })
  if (result.count === 0)
    return NextResponse.json({ error: 'Not found or already processed' }, { status: 404 })

  return NextResponse.json({ ok: true })
}
