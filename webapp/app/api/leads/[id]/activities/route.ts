// Plan 4 (Iter 23) — per-lead activity timeline read + manual-note write.

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Activity } from '@/lib/activity'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  // Confirm ownership via the lead's leadList
  const lead = await prisma.lead.findFirst({
    where: { id, leadList: { userId: session.user.id } },
    select: { id: true },
  })
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const limit = Math.min(Number(searchParams.get('limit') ?? 200), 500)

  const activities = await prisma.leadActivity.findMany({
    where: { leadId: id },
    orderBy: { occurredAt: 'desc' },
    take: limit,
  })

  return NextResponse.json({ activities })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const lead = await prisma.lead.findFirst({
    where: { id, leadList: { userId: session.user.id } },
    select: { id: true },
  })
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const text = typeof body.body === 'string' ? body.body.trim() : ''
  if (!text) return NextResponse.json({ error: 'body required' }, { status: 400 })

  const activity = await Activity.noteAdded({
    userId: session.user.id,
    leadId: id,
    body: text,
    actorUserId: session.user.id,
  })

  return NextResponse.json({ activity }, { status: 201 })
}
