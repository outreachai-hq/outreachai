import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { fireWebhook } from '@/lib/webhooks'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const ep = await prisma.webhookEndpoint.findFirst({ where: { id, userId: session.user.id } })
  if (!ep) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  fireWebhook(session.user.id, 'email.opened', {
    test: true,
    message: 'Test payload from OutReachAI',
    timestamp: new Date().toISOString(),
  })

  return NextResponse.json({ ok: true })
}
