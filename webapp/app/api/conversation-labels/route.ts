// Plan 7 — Conversation Labels list + create endpoint.
//
// GET implicitly seeds the five built-in labels on first call so the inbox
// always has a populated picker. POST creates a custom label (builtIn=false).

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureBuiltinLabels, slugifyLabelKey } from '@/lib/conversationLabels'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await ensureBuiltinLabels(session.user.id)

  const labels = await prisma.conversationLabel.findMany({
    where: { userId: session.user.id },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
  })
  return NextResponse.json({ labels })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const label = typeof body.label === 'string' ? body.label.trim() : ''
  if (!label) return NextResponse.json({ error: 'label required' }, { status: 400 })

  const key = slugifyLabelKey(typeof body.key === 'string' ? body.key : label)
  const color = typeof body.color === 'string' ? body.color : '#888'

  // Position: append at end of user's custom labels
  const count = await prisma.conversationLabel.count({ where: { userId: session.user.id } })

  try {
    const created = await prisma.conversationLabel.create({
      data: { userId: session.user.id, key, label, color, builtIn: false, position: count + 1 },
    })
    return NextResponse.json({ label: created }, { status: 201 })
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === 'P2002') {
      return NextResponse.json({ error: `Key "${key}" already in use.` }, { status: 409 })
    }
    throw err
  }
}
