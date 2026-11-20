// Plan 2 (Iter 12) — single conversation: detail / patch / archive.

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const ALLOWED_STATUS = new Set(['open', 'done', 'snoozed', 'archived'])

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const conv = await prisma.conversation.findFirst({
    where: { id, userId: session.user.id },
    include: { messages: { orderBy: { sentAt: 'asc' } } },
  })
  if (!conv) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ conversation: conv })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const existing = await prisma.conversation.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, labels: true },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const { status, unread, labels, contactId, addLabel, removeLabel } = body

  if (status !== undefined && !ALLOWED_STATUS.has(status)) {
    return NextResponse.json({ error: `status must be one of ${[...ALLOWED_STATUS].join(', ')}` }, { status: 400 })
  }

  // Either full labels array OR addLabel/removeLabel for atomic toggles.
  let nextLabels: string[] | undefined
  if (Array.isArray(labels)) {
    nextLabels = labels.filter((l) => typeof l === 'string')
  } else if (addLabel || removeLabel) {
    const set = new Set(existing.labels)
    if (typeof addLabel === 'string') set.add(addLabel)
    if (typeof removeLabel === 'string') set.delete(removeLabel)
    nextLabels = [...set]
  }

  const updated = await prisma.conversation.update({
    where: { id },
    data: {
      ...(status !== undefined && { status }),
      ...(unread !== undefined && { unread: Boolean(unread) }),
      ...(nextLabels !== undefined && { labels: nextLabels }),
      ...(contactId !== undefined && { contactId: contactId || null }),
    },
  })

  return NextResponse.json({ conversation: updated })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  // Soft-delete by archiving (status='done') so message history is preserved.
  // Hard delete loses audit trail.
  const existing = await prisma.conversation.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.conversation.update({
    where: { id },
    data: { status: 'archived' },
  })
  return NextResponse.json({ ok: true })
}
