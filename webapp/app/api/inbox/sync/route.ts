// Chrome-extension sync endpoint. The extension scrapes the LinkedIn
// /messaging page and POSTs an array of threads here. We surface them on the
// dashboard as Conversation rows (with Message rows for the last preview).
//
// The legacy InboxThread table this used to dual-write has been retired —
// the Conversation/Message tables (Plan 2) are now the only store. The
// extension still POSTs the same wire shape; the response is unchanged.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/getUserId'
import { dualWriteLinkedInThreads } from '@/lib/conversationSync'

export async function POST(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const threads: Array<{
    profileId: string
    participantName: string
    participantUrl?: string
    avatarUrl?: string
    lastMessage: string
    lastSenderIsMe: boolean
    unread: boolean
  }> = body.threads ?? []

  if (!Array.isArray(threads) || threads.length === 0)
    return NextResponse.json({ error: 'threads array required' }, { status: 400 })

  if (threads.length > 200)
    return NextResponse.json({ error: 'max 200 threads per sync' }, { status: 400 })

  const now = new Date()

  // Auto-mark contacts as replied where the prospect sent the last message.
  // Done before the conversation write because contacts is the legacy stat
  // driver — Conversation.unread already encodes the same signal.
  const repliedProfileIds = threads.filter((t) => !t.lastSenderIsMe).map((t) => t.profileId)
  if (repliedProfileIds.length > 0) {
    await prisma.contact.updateMany({
      where: { userId, profileId: { in: repliedProfileIds }, status: { not: 'replied' } },
      data: { status: 'replied' },
    })
  }

  // Write Conversation + Message rows. Errors here are non-fatal — the
  // extension should never see a 5xx because the LinkedIn DOM scrape can't
  // be retried.
  let written = 0
  let errors = 0
  try {
    const r = await dualWriteLinkedInThreads(userId, threads, now)
    written = r.written
    errors = r.errors
  } catch (err) {
    console.error('[/api/inbox/sync] conversation write top-level failed', err)
    errors = threads.length
  }

  return NextResponse.json({ synced: threads.length, written, errors })
}
