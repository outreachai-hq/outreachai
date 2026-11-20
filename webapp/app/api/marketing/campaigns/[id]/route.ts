import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/getUserId'

const IMMUTABLE_STATUSES = ['sending', 'sent', 'ab_testing']

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const campaign = await prisma.marketingCampaign.findFirst({
    where: { id, userId },
    include: {
      _count: { select: { sends: true } },
      emailAccount: { select: { id: true, name: true, email: true } },
      leadList: { select: { id: true, name: true } },
    },
  })

  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(campaign)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const existing = await prisma.marketingCampaign.findFirst({ where: { id, userId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (IMMUTABLE_STATUSES.includes(existing.status)) {
    return NextResponse.json(
      { error: `Cannot update a campaign with status "${existing.status}"` },
      { status: 409 }
    )
  }

  const body = await req.json()
  const {
    name, subject, htmlBody, fromName, scheduledAt,
    abEnabled, abSubjectB, abSplitPercent, abWinnerMetric, abTestDurationHours,
  } = body

  const updated = await prisma.marketingCampaign.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(subject !== undefined && { subject }),
      ...(htmlBody !== undefined && { htmlBody }),
      ...(fromName !== undefined && { fromName }),
      ...(scheduledAt !== undefined && { scheduledAt: scheduledAt ? new Date(scheduledAt) : null }),
      ...(abEnabled !== undefined && { abEnabled }),
      ...(abSubjectB !== undefined && { abSubjectB }),
      ...(abSplitPercent !== undefined && { abSplitPercent }),
      ...(abWinnerMetric !== undefined && { abWinnerMetric }),
      ...(abTestDurationHours !== undefined && { abTestDurationHours }),
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const existing = await prisma.marketingCampaign.findFirst({ where: { id, userId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (IMMUTABLE_STATUSES.includes(existing.status)) {
    return NextResponse.json(
      { error: `Cannot delete a campaign with status "${existing.status}"` },
      { status: 409 }
    )
  }

  await prisma.marketingCampaign.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
