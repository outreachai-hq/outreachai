// Plan 8 — Draft get / patch / delete.

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const draft = await prisma.draftMessage.findFirst({ where: { id, userId: session.user.id } })
  if (!draft) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ draft })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const existing = await prisma.draftMessage.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, body: true, status: true },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (existing.status === 'sent' || existing.status === 'rejected')
    return NextResponse.json({ error: `Cannot edit a ${existing.status} draft` }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const data: Record<string, unknown> = {}
  if (typeof body.subject  === 'string') data.subject  = body.subject
  if (typeof body.body     === 'string') data.body     = body.body.trim()
  if (typeof body.priority === 'number') data.priority = body.priority
  if (body.scheduledFor !== undefined) {
    data.scheduledFor = body.scheduledFor ? new Date(body.scheduledFor) : null
  }

  if (Object.keys(data).length === 0)
    return NextResponse.json({ error: 'no editable fields supplied' }, { status: 400 })

  // Body-changes flip pending → edited so the queue UI can surface them.
  if (typeof data.body === 'string' && data.body !== existing.body && existing.status === 'pending') {
    data.status = 'edited'
  }

  const draft = await prisma.draftMessage.update({ where: { id }, data })
  return NextResponse.json({ draft })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const result = await prisma.draftMessage.deleteMany({ where: { id, userId: session.user.id } })
  if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
