// Plan 9 — Dashboard get / patch / delete.

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

  const dash = await prisma.dashboard.findFirst({ where: { id, userId: session.user.id } })
  if (!dash) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ dashboard: dash })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const owned = await prisma.dashboard.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  })
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const data: Record<string, unknown> = {}
  if (typeof body.name === 'string')        data.name        = body.name.trim()
  if (typeof body.description === 'string') data.description = body.description
  if (body.tabs    !== undefined)           data.tabs        = body.tabs
  if (body.filters !== undefined)           data.filters     = body.filters
  if (typeof body.position === 'number')    data.position    = body.position

  if (Object.keys(data).length === 0)
    return NextResponse.json({ error: 'no editable fields supplied' }, { status: 400 })

  const dashboard = await prisma.dashboard.update({ where: { id }, data })
  return NextResponse.json({ dashboard })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const result = await prisma.dashboard.deleteMany({ where: { id, userId: session.user.id } })
  if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
