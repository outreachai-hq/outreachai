// Plan 7 — Schedules patch + delete.

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

  const owned = await prisma.schedule.findFirst({ where: { id, userId: session.user.id }, select: { id: true } })
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const data: Record<string, unknown> = {}
  if (typeof body.name === 'string')     data.name        = body.name.trim()
  if (typeof body.timezone === 'string') data.timezone    = body.timezone.trim()
  if (body.weeklyHours !== undefined && typeof body.weeklyHours === 'object')
                                          data.weeklyHours = body.weeklyHours
  if (Array.isArray(body.holidays))      data.holidays    = body.holidays

  if (Object.keys(data).length === 0 && body.isDefault !== true)
    return NextResponse.json({ error: 'no editable fields supplied' }, { status: 400 })

  const schedule = await prisma.$transaction(async (tx) => {
    if (body.isDefault === true) {
      // Un-set default on every other schedule belonging to this user, then set this one
      await tx.schedule.updateMany({
        where: { userId: session.user.id, isDefault: true, NOT: { id } },
        data:  { isDefault: false },
      })
      data.isDefault = true
    }
    return tx.schedule.update({ where: { id }, data })
  })

  return NextResponse.json({ schedule })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const result = await prisma.schedule.deleteMany({ where: { id, userId: session.user.id } })
  if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
