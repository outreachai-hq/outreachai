import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { classifyReplyIfNeeded } from '@/lib/classifyReply'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { conversationId } = await req.json()
  if (!conversationId) return NextResponse.json({ error: 'conversationId required' }, { status: 400 })

  await classifyReplyIfNeeded(session.user.id, conversationId)
  return NextResponse.json({ ok: true })
}
