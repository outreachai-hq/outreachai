import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/getUserId'

const DEFAULT_STAGES = [
  { name: 'Lead',          position: 0, probability: 10,  type: 'open', color: '#94a3b8' },
  { name: 'Qualified',     position: 1, probability: 30,  type: 'open', color: '#60a5fa' },
  { name: 'Proposal Sent', position: 2, probability: 60,  type: 'open', color: '#a78bfa' },
  { name: 'Negotiating',   position: 3, probability: 80,  type: 'open', color: '#f59e0b' },
  { name: 'Won',           position: 4, probability: 100, type: 'won',  color: '#10b981' },
  { name: 'Lost',          position: 5, probability: 0,   type: 'lost', color: '#f87171' },
]

async function ensureDefaultPipeline(userId: string) {
  const existing = await prisma.pipeline.findFirst({ where: { userId } })
  if (existing) return null

  const pipeline = await prisma.pipeline.create({
    data: {
      userId,
      name: 'Sales Pipeline',
      isDefault: true,
      stages: {
        create: DEFAULT_STAGES,
      },
    },
    include: { stages: { orderBy: { position: 'asc' } } },
  })
  return pipeline
}

export async function GET(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await ensureDefaultPipeline(userId)

  const pipelines = await prisma.pipeline.findMany({
    where: { userId },
    include: {
      stages: {
        orderBy: { position: 'asc' },
        include: {
          _count: { select: { deals: true } },
        },
      },
      _count: { select: { deals: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({ pipelines })
}

export async function POST(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const name = (body.name as string)?.trim()
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const pipeline = await prisma.pipeline.create({
    data: {
      userId,
      name,
      isDefault: false,
      stages: {
        create: DEFAULT_STAGES,
      },
    },
    include: { stages: { orderBy: { position: 'asc' } } },
  })

  return NextResponse.json({ pipeline }, { status: 201 })
}
