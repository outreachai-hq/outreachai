// User-wide LeadActivity feed. Powers the /activity page.
//
// Filter `family` groups several LeadActivity.type values into a single
// concept that matches the legacy /activity page filter buttons:
//   sent     -> any outbound send (email.sent + linkedin.*_sent + invite_sent)
//   replied  -> any inbound reply (email.replied + linkedin.message_received)
//   notes    -> note.added
//   tasks    -> task.created + task.completed
//
// Cursor pagination uses occurredAt + id for stable ordering across ties.

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const TYPE_FAMILIES: Record<string, string[]> = {
  sent:    ['email.sent', 'linkedin.message_sent', 'linkedin.invite_sent', 'linkedin.visit_done'],
  replied: ['email.replied', 'linkedin.message_received'],
  notes:   ['note.added'],
  tasks:   ['task.created', 'task.completed'],
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  const { searchParams } = new URL(req.url)
  const family = searchParams.get('family')
  const cursor = searchParams.get('cursor')
  const limit = Math.min(Number(searchParams.get('limit') ?? 50), 100)

  const typeFilter = family && TYPE_FAMILIES[family] ? { type: { in: TYPE_FAMILIES[family] } } : {}

  const activities = await prisma.leadActivity.findMany({
    where: { userId, ...typeFilter },
    orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })

  const hasMore = activities.length > limit
  const data = hasMore ? activities.slice(0, limit) : activities
  const nextCursor = hasMore ? data[data.length - 1].id : null

  return NextResponse.json({ activities: data, nextCursor })
}
