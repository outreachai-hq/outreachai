// Plan 8 — Drafts list + create.

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const ALLOWED_CHANNELS = new Set(['email', 'linkedin', 'sms'])
const ALLOWED_STATUSES = new Set(['pending', 'edited', 'approved', 'sent', 'rejected', 'expired'])

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status         = searchParams.get('status')
  const channel        = searchParams.get('channel')
  const campaignId     = searchParams.get('campaignId')
  const conversationId = searchParams.get('conversationId')

  if (status && !ALLOWED_STATUSES.has(status))
    return NextResponse.json({ error: 'invalid status' }, { status: 400 })
  if (channel && !ALLOWED_CHANNELS.has(channel))
    return NextResponse.json({ error: 'invalid channel' }, { status: 400 })

  const drafts = await prisma.draftMessage.findMany({
    where: {
      userId: session.user.id,
      ...(status ? { status } : { status: { in: ['pending', 'edited'] } }),
      ...(channel ? { channel } : {}),
      ...(campaignId ? { campaignId } : {}),
      ...(conversationId ? { conversationId } : {}),
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    take: 200,
  })
  return NextResponse.json({ drafts })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))

  const channel = String(body.channel ?? '')
  if (!ALLOWED_CHANNELS.has(channel)) return NextResponse.json({ error: 'channel required' }, { status: 400 })

  const text = typeof body.body === 'string' ? body.body.trim() : ''
  if (!text) return NextResponse.json({ error: 'body required' }, { status: 400 })

  const draft = await prisma.draftMessage.create({
    data: {
      userId:         session.user.id,
      channel,
      subject:        typeof body.subject === 'string' ? body.subject : null,
      body:           text,
      conversationId: typeof body.conversationId === 'string' ? body.conversationId : null,
      leadId:         typeof body.leadId         === 'string' ? body.leadId         : null,
      contactId:      typeof body.contactId      === 'string' ? body.contactId      : null,
      campaignId:     typeof body.campaignId     === 'string' ? body.campaignId     : null,
      source:         'manual_draft',
      createdByAi:    false,
      status:         'pending',
      priority:       Number.isFinite(Number(body.priority)) ? Number(body.priority) : 0,
    },
  })
  return NextResponse.json({ draft }, { status: 201 })
}
