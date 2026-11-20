import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/getUserId'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; stageId: string }> },
) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, stageId } = await params

  const pipeline = await prisma.pipeline.findFirst({ where: { id, userId } })
  if (!pipeline) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const stage = await prisma.pipelineStage.findFirst({ where: { id: stageId, pipelineId: id } })
  if (!stage) return NextResponse.json({ error: 'Stage not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const data: Record<string, unknown> = {}
  if (body.name !== undefined) data.name = body.name
  if (body.color !== undefined) data.color = body.color
  if (body.probability !== undefined) data.probability = body.probability
  if (body.position !== undefined) data.position = body.position
  if (body.type !== undefined) data.type = body.type

  const updated = await prisma.pipelineStage.update({ where: { id: stageId }, data })
  return NextResponse.json({ stage: updated })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; stageId: string }> },
) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, stageId } = await params

  const pipeline = await prisma.pipeline.findFirst({ where: { id, userId } })
  if (!pipeline) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const stage = await prisma.pipelineStage.findFirst({ where: { id: stageId, pipelineId: id } })
  if (!stage) return NextResponse.json({ error: 'Stage not found' }, { status: 404 })

  // Move deals in this stage to the previous stage
  const previousStage = await prisma.pipelineStage.findFirst({
    where: { pipelineId: id, position: { lt: stage.position } },
    orderBy: { position: 'desc' },
  })

  if (previousStage) {
    await prisma.deal.updateMany({
      where: { stageId },
      data: { stageId: previousStage.id },
    })
  }

  await prisma.pipelineStage.delete({ where: { id: stageId } })
  return NextResponse.json({ ok: true })
}
