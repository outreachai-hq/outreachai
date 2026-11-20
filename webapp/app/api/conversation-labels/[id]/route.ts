// Plan 7 — Conversation Labels patch + delete.
// Built-in labels (builtIn=true) can be renamed/recolored but never deleted.

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const owned = await prisma.conversationLabel.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, builtIn: true },
  })
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const data: Record<string, unknown> = {}
  if (typeof body.label === 'string')  data.label = body.label.trim()
  if (typeof body.color === 'string')  data.color = body.color
  if (typeof body.position === 'number') data.position = body.position

  if (Object.keys(data).length === 0)
    return NextResponse.json({ error: 'no editable fields supplied' }, { status: 400 })

  const updated = await prisma.conversationLabel.update({ where: { id }, data })
  return NextResponse.json({ label: updated })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const row = await prisma.conversationLabel.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, builtIn: true, key: true },
  })
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (row.builtIn) return NextResponse.json({ error: 'Cannot delete a built-in label' }, { status: 400 })

  // Remove the label from any conversations that carry it. Postgres array_remove
  // is safer than read-modify-write — keeps the operation atomic.
  await prisma.$executeRaw`UPDATE "Conversation" SET "labels" = array_remove("labels", ${row.key}) WHERE "userId" = ${session.user.id}`
  await prisma.conversationLabel.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
