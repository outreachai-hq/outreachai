import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tab = req.nextUrl.searchParams.get('tab') // today | upcoming | completed
  const now = new Date()
  const todayEnd = new Date(now)
  todayEnd.setHours(23, 59, 59, 999)

  let where: Record<string, unknown> = { userId: session.user.id }

  if (tab === 'today') {
    where = { ...where, completedAt: null, dueAt: { lte: todayEnd } }
  } else if (tab === 'upcoming') {
    where = { ...where, completedAt: null, dueAt: { gt: todayEnd } }
  } else if (tab === 'completed') {
    where = { ...where, completedAt: { not: null } }
  }

  const tasks = await prisma.task.findMany({
    where,
    orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
  })
  return NextResponse.json(tasks)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const task = await prisma.task.create({
    data: {
      userId: session.user.id,
      type: body.type ?? 'custom',
      title: body.title,
      notes: body.notes ?? null,
      dueAt: body.dueAt ? new Date(body.dueAt) : null,
      leadId: body.leadId ?? null,
      campaignId: body.campaignId ?? null,
    },
  })
  return NextResponse.json(task)
}
