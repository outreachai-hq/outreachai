import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const limit = Math.min(Number(searchParams.get('limit') ?? 50), 200)
  const cursor = searchParams.get('cursor')

  const calls = await prisma.call.findMany({
    where: { userId: session.user.id },
    orderBy: { startedAt: 'desc' },
    take: limit,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })

  return NextResponse.json({ calls, nextCursor: calls.length === limit ? calls[calls.length - 1]?.id : null })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { toNumber, leadId, contactId, durationSec, notes, outcome, direction } = body

  if (!toNumber) return NextResponse.json({ error: 'toNumber required' }, { status: 400 })

  const call = await prisma.call.create({
    data: {
      userId: session.user.id,
      toNumber,
      leadId: leadId ?? null,
      contactId: contactId ?? null,
      durationSec: durationSec ?? null,
      notes: notes ?? null,
      outcome: outcome ?? null,
      direction: direction ?? 'outbound',
    },
  })

  return NextResponse.json({ call }, { status: 201 })
}
