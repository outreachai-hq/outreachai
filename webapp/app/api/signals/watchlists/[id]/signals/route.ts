import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const watchlist = await prisma.watchlist.findFirst({ where: { id, userId: session.user.id } })
  if (!watchlist) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const limit = Math.min(Number(searchParams.get('limit') ?? 50), 200)
  const cursor = searchParams.get('cursor')

  const signals = await prisma.watchlistSignal.findMany({
    where: { watchlistId: id },
    orderBy: { firedAt: 'desc' },
    take: limit,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })

  return NextResponse.json({ signals, nextCursor: signals.length === limit ? signals[signals.length - 1]?.id : null })
}
