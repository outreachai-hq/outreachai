import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/getUserId'
import { runWorkflowsForEvent } from '@/lib/workflowEngine'

export async function GET(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const pipelineId = searchParams.get('pipelineId')
  const stageId = searchParams.get('stageId')
  const status = searchParams.get('status')
  const q = searchParams.get('q')

  const where: Record<string, unknown> = { userId }
  if (pipelineId) where.pipelineId = pipelineId
  if (stageId) where.stageId = stageId
  if (status) where.status = status
  if (q) where.title = { contains: q, mode: 'insensitive' }

  const deals = await prisma.deal.findMany({
    where,
    include: {
      stage: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  // Denorm contact/company names
  const contactIds = deals.map((d) => d.contactId).filter(Boolean) as string[]
  const companyIds = deals.map((d) => d.companyId).filter(Boolean) as string[]

  const [contacts, companies] = await Promise.all([
    contactIds.length > 0
      ? prisma.contact.findMany({ where: { id: { in: contactIds } }, select: { id: true, name: true } })
      : [],
    companyIds.length > 0
      ? prisma.company.findMany({ where: { id: { in: companyIds } }, select: { id: true, name: true, domain: true } })
      : [],
  ])

  const contactMap = Object.fromEntries(contacts.map((c) => [c.id, c]))
  const companyMap = Object.fromEntries(companies.map((c) => [c.id, c]))

  const enriched = deals.map((d) => ({
    ...d,
    contact: d.contactId ? contactMap[d.contactId] ?? null : null,
    company: d.companyId ? companyMap[d.companyId] ?? null : null,
  }))

  return NextResponse.json({ deals: enriched })
}

export async function POST(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { title, pipelineId, stageId, value, currency, closeDate, contactId, companyId, description } = body

  if (!title?.trim()) return NextResponse.json({ error: 'title is required' }, { status: 400 })
  if (!pipelineId) return NextResponse.json({ error: 'pipelineId is required' }, { status: 400 })
  if (!stageId) return NextResponse.json({ error: 'stageId is required' }, { status: 400 })

  // Verify pipeline belongs to user
  const pipeline = await prisma.pipeline.findFirst({ where: { id: pipelineId, userId } })
  if (!pipeline) return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 })

  // Verify stage belongs to pipeline
  const stage = await prisma.pipelineStage.findFirst({ where: { id: stageId, pipelineId } })
  if (!stage) return NextResponse.json({ error: 'Stage not found' }, { status: 404 })

  const deal = await prisma.deal.create({
    data: {
      userId,
      pipelineId,
      stageId,
      title: title.trim(),
      value: value ? parseFloat(value) : null,
      currency: currency ?? 'USD',
      closeDate: closeDate ? new Date(closeDate) : null,
      contactId: contactId ?? null,
      companyId: companyId ?? null,
      description: description ?? null,
      probability: stage.probability,
    },
    include: { stage: true },
  })

  // Log creation activity
  await prisma.dealActivity.create({
    data: {
      dealId: deal.id,
      userId,
      type: 'note',
      title: 'Deal created',
      actorUserId: userId,
    },
  })

  runWorkflowsForEvent('deal.created', userId, {
    dealId: deal.id, pipelineId: deal.pipelineId, stageId: deal.stageId,
  }).catch(() => {})

  return NextResponse.json({ deal }, { status: 201 })
}
