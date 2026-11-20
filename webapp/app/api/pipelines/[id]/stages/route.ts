import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/getUserId'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const pipeline = await prisma.pipeline.findFirst({ where: { id, userId } })
  if (!pipeline) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const name = (body.name as string)?.trim()
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  // Get max position
  const maxStage = await prisma.pipelineStage.findFirst({
    where: { pipelineId: id },
    orderBy: { position: 'desc' },
  })
  const position = maxStage ? maxStage.position + 1 : 0

  const stage = await prisma.pipelineStage.create({
    data: {
      pipelineId: id,
      name,
      position: body.position ?? position,
      probability: body.probability ?? 50,
      type: body.type ?? 'open',
      color: body.color ?? '#6366f1',
    },
  })

  return NextResponse.json({ stage }, { status: 201 })
}
