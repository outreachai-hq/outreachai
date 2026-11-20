// Plan 8 — reject a draft. Idempotent on already-rejected rows.

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const result = await prisma.draftMessage.updateMany({
    where:  { id, userId: session.user.id, status: { in: ['pending', 'edited'] } },
    data:   { status: 'rejected', rejectedAt: new Date() },
  })
  if (result.count === 0)
    return NextResponse.json({ error: 'Not found or already processed' }, { status: 404 })

  return NextResponse.json({ ok: true })
}
