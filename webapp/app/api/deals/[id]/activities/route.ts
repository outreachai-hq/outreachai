import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/getUserId'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const deal = await prisma.deal.findFirst({ where: { id, userId } })
  if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const activities = await prisma.dealActivity.findMany({
    where: { dealId: id },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ activities })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const deal = await prisma.deal.findFirst({ where: { id, userId } })
  if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const { type, body: noteBody } = body

  if (!noteBody?.trim()) return NextResponse.json({ error: 'body is required' }, { status: 400 })

  const activity = await prisma.dealActivity.create({
    data: {
      dealId: id,
      userId,
      type: type ?? 'note',
      title: type === 'note' ? 'Note added' : type,
      body: noteBody.trim(),
      actorUserId: userId,
    },
  })

  return NextResponse.json({ activity }, { status: 201 })
}
