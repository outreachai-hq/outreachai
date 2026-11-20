import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { WEBHOOK_EVENTS } from '@/lib/webhooks'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { deliveries: true } } },
  })

  return NextResponse.json(endpoints.map(ep => ({
    id: ep.id, url: ep.url, active: ep.active, createdAt: ep.createdAt,
    events: JSON.parse(ep.events) as string[],
    hasSecret: !!ep.secret,
    deliveryCount: ep._count.deliveries,
  })))
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { url, events, secret } = await req.json()
  if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 })
  if (!Array.isArray(events) || events.length === 0)
    return NextResponse.json({ error: 'events[] required' }, { status: 400 })

  const validEvents = events.filter((e: string) => WEBHOOK_EVENTS.includes(e as never))
  const ep = await prisma.webhookEndpoint.create({
    data: { userId: session.user.id, url, events: JSON.stringify(validEvents), secret: secret || null },
  })

  return NextResponse.json({ ...ep, events: validEvents, hasSecret: !!ep.secret }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, active } = await req.json()
  await prisma.webhookEndpoint.updateMany({ where: { id, userId: session.user.id }, data: { active } })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  await prisma.webhookEndpoint.deleteMany({ where: { id, userId: session.user.id } })
  return NextResponse.json({ ok: true })
}
