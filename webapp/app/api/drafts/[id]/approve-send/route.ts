// Plan 8 — promote a draft into a real send.
// Race-safe: status guard in WHERE clause means a concurrent call will
// see the row already-transitioned and 404 instead of double-sending.

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { internalApproveAndSend, ApproveSendError } from '@/lib/drafts'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const draft = await prisma.draftMessage.findFirst({
    where: { id, userId: session.user.id, status: { in: ['pending', 'edited'] } },
  })
  if (!draft) return NextResponse.json({ error: 'Draft not found or already processed' }, { status: 404 })

  // Mark approved up-front so a concurrent call sees status='approved' and
  // bails out of the in-clause above. Any error below rolls this back.
  await prisma.draftMessage.update({
    where: { id },
    data:  { status: 'approved', approvedAt: new Date() },
  })

  try {
    const { sentMessageId } = await internalApproveAndSend({ draft, userId: session.user.id })
    return NextResponse.json({ ok: true, sentMessageId })
  } catch (err) {
    // Roll back the optimistic 'approved' marker so the user can retry.
    await prisma.draftMessage.update({
      where: { id },
      data:  { status: draft.status, approvedAt: null },
    }).catch(() => {})

    if (err instanceof ApproveSendError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Approve-send failed' }, { status: 500 })
  }
}
