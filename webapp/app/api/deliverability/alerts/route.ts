import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const alerts = await prisma.deliverabilityAlert.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({ alerts })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const { metric, condition, threshold } = body
  if (!metric || !condition || threshold == null) {
    return NextResponse.json({ error: 'metric, condition, and threshold are required' }, { status: 400 })
  }

  const VALID_METRICS = ['bounce_rate', 'open_rate', 'reply_rate', 'score']
  const VALID_CONDITIONS = ['below', 'above']
  if (!VALID_METRICS.includes(metric)) {
    return NextResponse.json({ error: 'Invalid metric' }, { status: 400 })
  }
  if (!VALID_CONDITIONS.includes(condition)) {
    return NextResponse.json({ error: 'Invalid condition' }, { status: 400 })
  }

  const alert = await prisma.deliverabilityAlert.create({
    data: {
      userId: session.user.id,
      metric,
      condition,
      threshold: Number(threshold),
      active: true,
    },
  })

  return NextResponse.json({ alert }, { status: 201 })
}
