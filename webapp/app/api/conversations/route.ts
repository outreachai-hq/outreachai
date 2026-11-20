// Plan 2 (Iter 12) — list conversations across channels with optional filters.
//
// Replaces the read side of /api/inbox/sync (which only knew about LinkedIn).
// Old route stays alive for backwards compat until Iter 14.

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const channel = searchParams.get('channel')      // 'email' | 'linkedin' | 'sms' | 'whatsapp' | null=all
  const status  = searchParams.get('status') ?? 'open'  // 'all' to skip
  const label   = searchParams.get('label')        // single label key
  const q       = searchParams.get('q')?.trim()
  const limit   = Math.min(Number(searchParams.get('limit') ?? 100), 500)

  const conversations = await prisma.conversation.findMany({
    where: {
      userId: session.user.id,
      ...(channel ? { channel } : {}),
      ...(status !== 'all' ? { status } : {}),
      ...(label ? { labels: { has: label } } : {}),
      ...(q ? {
        OR: [
          { participantName:  { contains: q, mode: 'insensitive' as const } },
          { participantEmail: { contains: q, mode: 'insensitive' as const } },
          { subject:          { contains: q, mode: 'insensitive' as const } },
        ],
      } : {}),
    },
    orderBy: { lastMessageAt: { sort: 'desc', nulls: 'last' } },
    take: limit,
    // Pull the latest message snapshot so the list view can show a preview
    // without an N+1.
    include: {
      messages: { orderBy: { sentAt: 'desc' }, take: 1 },
    },
  })

  return NextResponse.json({ conversations })
}
