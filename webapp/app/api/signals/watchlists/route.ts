import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const watchlists = await prisma.watchlist.findMany({
    where: { userId: session.user.id },
    include: {
      _count: { select: { signals: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ watchlists })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { name, signalType, description, config } = body

  if (!name || !signalType) {
    return NextResponse.json({ error: 'name and signalType required' }, { status: 400 })
  }

  const watchlist = await prisma.watchlist.create({
    data: {
      userId: session.user.id,
      name,
      signalType,
      description: description ?? null,
      config: config ?? {},
    },
  })

  return NextResponse.json({ watchlist }, { status: 201 })
}
