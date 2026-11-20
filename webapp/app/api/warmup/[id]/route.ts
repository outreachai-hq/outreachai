import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/getUserId'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const warmupAccount = await prisma.warmupAccount.findFirst({
    where: { id, userId },
    include: {
      emailAccount: { select: { id: true, name: true, email: true } },
      sentEmails: {
        orderBy: { sentAt: 'desc' },
        take: 20,
      },
    },
  })

  if (!warmupAccount)
    return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ account: warmupAccount })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { status, dailyTarget } = body

  if (status !== undefined && status !== 'active' && status !== 'paused')
    return NextResponse.json({ error: 'status must be "active" or "paused"' }, { status: 400 })

  const existing = await prisma.warmupAccount.findFirst({ where: { id, userId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updated = await prisma.warmupAccount.update({
    where: { id },
    data: {
      ...(status !== undefined ? { status } : {}),
      ...(dailyTarget !== undefined
        ? { dailyTarget: Math.min(Math.max(Number(dailyTarget), 1), 20) }
        : {}),
    },
    include: {
      emailAccount: { select: { id: true, name: true, email: true } },
    },
  })

  return NextResponse.json({ account: updated })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  await prisma.warmupAccount.deleteMany({ where: { id, userId } })
  return NextResponse.json({ ok: true })
}
