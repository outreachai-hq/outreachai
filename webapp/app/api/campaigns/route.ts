import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const campaigns = await prisma.campaign.findMany({
    where: { userId: session.user!.id },
    include: {
      sequence: { select: { id: true, name: true } },
      leadList: { select: { id: true, name: true } },
      leads: { select: { id: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(
    campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      launchedAt: c.launchedAt,
      createdAt: c.createdAt,
      sequenceName: c.sequence.name,
      sequenceId: c.sequence.id,
      leadListName: c.leadList.name,
      leadListId: c.leadList.id,
      leadCount: c.leads.length,
    }))
  )
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name } = await req.json()
  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  // Auto-create a linked Sequence and LeadList, then create the Campaign
  const [sequence, leadList] = await Promise.all([
    prisma.sequence.create({
      data: {
        userId: session.user!.id,
        name: `${name} Sequence`,
        steps: [],
        active: false,
      },
    }),
    prisma.leadList.create({
      data: {
        userId: session.user!.id,
        name: `${name} Leads`,
      },
    }),
  ])

  const campaign = await prisma.campaign.create({
    data: {
      userId: session.user!.id,
      name,
      sequenceId: sequence.id,
      leadListId: leadList.id,
      status: 'draft',
    },
    include: {
      sequence: { select: { id: true, name: true } },
      leadList: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json(
    {
      ...campaign,
      sequenceId: sequence.id,
      leadListId: leadList.id,
    },
    { status: 201 }
  )
}
