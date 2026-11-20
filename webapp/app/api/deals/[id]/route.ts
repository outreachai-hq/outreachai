import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/getUserId'
import { runWorkflowsForEvent } from '@/lib/workflowEngine'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const deal = await prisma.deal.findFirst({
    where: { id, userId },
    include: {
      stage: true,
      activities: {
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Denorm contact/company
  const [contact, company] = await Promise.all([
    deal.contactId
      ? prisma.contact.findUnique({ where: { id: deal.contactId }, select: { id: true, name: true, headline: true } })
      : null,
    deal.companyId
      ? prisma.company.findUnique({ where: { id: deal.companyId }, select: { id: true, name: true, domain: true } })
      : null,
  ])

  return NextResponse.json({ deal: { ...deal, contact, company } })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const existing = await prisma.deal.findFirst({
    where: { id, userId },
    include: { stage: true },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const data: Record<string, unknown> = {}
  const activities: { type: string; title: string; payload?: Prisma.InputJsonValue }[] = []

  if (body.title !== undefined) data.title = body.title
  if (body.value !== undefined) data.value = body.value ? parseFloat(body.value) : null
  if (body.currency !== undefined) data.currency = body.currency
  if (body.closeDate !== undefined) data.closeDate = body.closeDate ? new Date(body.closeDate) : null
  if (body.description !== undefined) data.description = body.description
  if (body.contactId !== undefined) data.contactId = body.contactId
  if (body.companyId !== undefined) data.companyId = body.companyId
  if (body.probability !== undefined) data.probability = body.probability
  if (body.lostReason !== undefined) data.lostReason = body.lostReason

  // Stage change
  if (body.stageId && body.stageId !== existing.stageId) {
    const newStage = await prisma.pipelineStage.findFirst({
      where: { id: body.stageId, pipelineId: existing.pipelineId },
    })
    if (!newStage) return NextResponse.json({ error: 'Stage not found' }, { status: 404 })

    data.stageId = body.stageId
    data.probability = newStage.probability

    activities.push({
      type: 'stage_change',
      title: `Stage: ${existing.stage.name} → ${newStage.name}`,
      payload: { fromStageId: existing.stageId, toStageId: body.stageId } as Prisma.InputJsonValue,
    })
  }

  // Status change
  if (body.status && body.status !== existing.status) {
    data.status = body.status
    if (body.status === 'won') {
      data.wonAt = new Date()
      activities.push({ type: 'status_change', title: 'Marked Won' })
    } else if (body.status === 'lost') {
      data.lostAt = new Date()
      const reason = body.lostReason || ''
      activities.push({ type: 'status_change', title: reason ? `Marked Lost: ${reason}` : 'Marked Lost' })
    }
  }

  const deal = await prisma.deal.update({ where: { id }, data, include: { stage: true } })

  // Log all activities
  if (activities.length > 0) {
    await prisma.dealActivity.createMany({
      data: activities.map((a) => ({
        dealId: id,
        userId,
        type: a.type,
        title: a.title,
        ...(a.payload !== undefined ? { payload: a.payload } : {}),
        actorUserId: userId,
      })),
    })
  }

  // Fire workflow triggers
  if (body.stageId && body.stageId !== existing.stageId) {
    runWorkflowsForEvent('deal.stage_changed', userId, {
      dealId: id, fromStageId: existing.stageId, toStageId: body.stageId,
    }).catch(() => {})
  }
  if (body.status === 'won' && existing.status !== 'won') {
    runWorkflowsForEvent('deal.won', userId, {
      dealId: id, value: deal.value ?? 0,
    }).catch(() => {})
  }
  if (body.status === 'lost' && existing.status !== 'lost') {
    runWorkflowsForEvent('deal.lost', userId, {
      dealId: id, lostReason: body.lostReason ?? '',
    }).catch(() => {})
  }

  return NextResponse.json({ deal })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const existing = await prisma.deal.findFirst({ where: { id, userId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.deal.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
