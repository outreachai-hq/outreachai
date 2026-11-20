import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/getUserId'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const pipeline = await prisma.pipeline.findFirst({
    where: { id, userId },
    include: {
      stages: {
        orderBy: { position: 'asc' },
        include: {
          _count: { select: { deals: true } },
        },
      },
      _count: { select: { deals: true } },
    },
  })

  if (!pipeline) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ pipeline })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const name = (body.name as string)?.trim()
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const existing = await prisma.pipeline.findFirst({ where: { id, userId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const pipeline = await prisma.pipeline.update({ where: { id }, data: { name } })
  return NextResponse.json({ pipeline })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const existing = await prisma.pipeline.findFirst({
    where: { id, userId },
    include: { _count: { select: { deals: true } } },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (existing._count.deals > 0) {
    return NextResponse.json({ error: 'Cannot delete pipeline with deals' }, { status: 409 })
  }

  await prisma.pipeline.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
