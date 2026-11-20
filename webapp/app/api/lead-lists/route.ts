import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const lists = await prisma.leadList.findMany({
    where: { userId: session.user!.id },
    include: { leads: { select: { id: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(
    lists.map((l) => ({
      id: l.id,
      name: l.name,
      leadCount: l.leads.length,
      createdAt: l.createdAt,
    }))
  )
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name } = await req.json()
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const list = await prisma.leadList.create({
    data: { userId: session.user!.id, name },
  })

  return NextResponse.json({ ...list, leadCount: 0 }, { status: 201 })
}
