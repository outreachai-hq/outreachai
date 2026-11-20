// Plan 7 — Schedules CRUD list + create endpoint.

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

function validate(body: Record<string, unknown>): string | null {
  if (typeof body.name !== 'string' || !body.name.trim()) return 'name required'
  if (typeof body.timezone !== 'string' || !body.timezone.trim()) return 'timezone required'
  if (body.weeklyHours !== undefined && typeof body.weeklyHours !== 'object') return 'weeklyHours must be an object'
  if (body.holidays !== undefined && !Array.isArray(body.holidays)) return 'holidays must be an array'
  if (body.weeklyHours && typeof body.weeklyHours === 'object') {
    const wh = body.weeklyHours as Record<string, unknown>
    for (const k of Object.keys(wh)) {
      if (!(DAY_KEYS as readonly string[]).includes(k)) return `invalid weeklyHours key: ${k}`
      const ranges = wh[k]
      if (!Array.isArray(ranges)) return `weeklyHours.${k} must be an array`
      for (const r of ranges) {
        if (!Array.isArray(r) || r.length !== 2 || !r.every((n) => Number.isFinite(n)))
          return `weeklyHours.${k} entries must be [number, number]`
      }
    }
  }
  return null
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const schedules = await prisma.schedule.findMany({
    where: { userId: session.user.id },
    orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
  })
  return NextResponse.json({ schedules })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const err = validate(body)
  if (err) return NextResponse.json({ error: err }, { status: 400 })

  const wantsDefault = body.isDefault === true

  const schedule = await prisma.$transaction(async (tx) => {
    // If creating as default, un-set default on every other schedule first.
    if (wantsDefault) {
      await tx.schedule.updateMany({
        where: { userId: session.user.id, isDefault: true },
        data:  { isDefault: false },
      })
    }
    return tx.schedule.create({
      data: {
        userId:      session.user.id,
        name:        (body.name as string).trim(),
        timezone:    (body.timezone as string).trim(),
        weeklyHours: (body.weeklyHours ?? {}) as object,
        holidays:    (body.holidays ?? []) as object,
        isDefault:   wantsDefault,
      },
    })
  })

  return NextResponse.json({ schedule }, { status: 201 })
}
