// Plan 9 — Dashboards list + create.
// First GET auto-seeds a default "Overview" dashboard so the user always
// has something to look at.

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { defaultOverviewTabs } from '@/lib/widgets/catalog'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await prisma.dashboard.findMany({
    where: { userId: session.user.id },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
  })

  // Auto-seed an Overview dashboard on the user's first visit.
  if (rows.length === 0) {
    const seed = await prisma.dashboard.create({
      data: {
        userId: session.user.id,
        name:   'Overview',
        description: 'Daily metrics across email + LinkedIn',
        tabs:   defaultOverviewTabs() as unknown as Prisma.InputJsonValue,
        filters: {},
        position: 0,
      },
    })
    return NextResponse.json({ dashboards: [seed] })
  }

  return NextResponse.json({ dashboards: rows })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const count = await prisma.dashboard.count({ where: { userId: session.user.id } })
  const dashboard = await prisma.dashboard.create({
    data: {
      userId:      session.user.id,
      name,
      description: typeof body.description === 'string' ? body.description : null,
      tabs:        body.template === 'overview'
        ? (defaultOverviewTabs() as unknown as Prisma.InputJsonValue)
        : [{ id: `tab_${Math.random().toString(36).slice(2, 8)}`, name: 'Tab 1', widgets: [] }] as unknown as Prisma.InputJsonValue,
      filters:     {},
      position:    count,
    },
  })
  return NextResponse.json({ dashboard }, { status: 201 })
}
