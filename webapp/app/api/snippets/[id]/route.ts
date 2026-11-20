// Plan 7 — Snippets patch + delete by id.

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

  const owned = await prisma.snippet.findFirst({ where: { id, userId: session.user.id }, select: { id: true } })
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const data: Record<string, unknown> = {}
  if (typeof body.label === 'string') data.label = body.label.trim()
  if (typeof body.body  === 'string') data.body  = body.body.trim()
  if (Array.isArray(body.tags))       data.tags  = body.tags.filter((t: unknown) => typeof t === 'string')

  if (Object.keys(data).length === 0)
    return NextResponse.json({ error: 'no editable fields supplied' }, { status: 400 })

  const snippet = await prisma.snippet.update({ where: { id }, data })
  return NextResponse.json({ snippet })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const result = await prisma.snippet.deleteMany({ where: { id, userId: session.user.id } })
  if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
