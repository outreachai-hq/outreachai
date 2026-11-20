// Plan 8 — Settings toggle for AI auto-drafting on inbound replies.

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const ALLOWED = new Set(['off', 'email', 'linkedin', 'both'])

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { aiReplyAutoDraft: true },
  })
  return NextResponse.json({ aiReplyAutoDraft: user?.aiReplyAutoDraft ?? 'off' })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const value = String(body.aiReplyAutoDraft ?? '')
  if (!ALLOWED.has(value))
    return NextResponse.json({ error: `aiReplyAutoDraft must be one of ${[...ALLOWED].join(', ')}` }, { status: 400 })

  await prisma.user.update({
    where: { id: session.user.id },
    data:  { aiReplyAutoDraft: value },
  })
  return NextResponse.json({ aiReplyAutoDraft: value })
}
