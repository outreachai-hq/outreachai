// Plan 8 — cron that promotes drafts whose scheduledFor has passed.
//
// On Vercel Hobby this runs daily (see vercel.json). Bearer-authenticated against
// CRON_SECRET. Walks rows where status IN (pending, edited) AND
// scheduledFor <= now, then defers each to internalApproveAndSend so the
// same lifecycle as user-clicked Approve & send applies.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { internalApproveAndSend, ApproveSendError } from '@/lib/drafts'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const due = await prisma.draftMessage.findMany({
    where: {
      status:       { in: ['pending', 'edited'] },
      scheduledFor: { lte: now, not: null },
    },
    orderBy: { scheduledFor: 'asc' },
    take: 100,
  })

  let sent = 0, failed = 0
  for (const draft of due) {
    // Mark approved up-front so a parallel manual approve-send 404s.
    const claimed = await prisma.draftMessage.updateMany({
      where: { id: draft.id, status: { in: ['pending', 'edited'] } },
      data:  { status: 'approved', approvedAt: now },
    })
    if (claimed.count === 0) continue

    try {
      await internalApproveAndSend({ draft, userId: draft.userId })
      sent++
    } catch (err) {
      // Roll status back; surface the error message on the row so the user
      // can see what happened in the queue UI.
      const errMsg = err instanceof ApproveSendError ? err.message : err instanceof Error ? err.message : String(err)
      await prisma.draftMessage.update({
        where: { id: draft.id },
        data:  { status: draft.status, approvedAt: null, aiPrompt: (draft.aiPrompt ?? '') + `\n[send error] ${errMsg}` },
      }).catch(() => {})
      failed++
    }
  }

  return NextResponse.json({ checked: due.length, sent, failed })
}
