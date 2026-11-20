import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { linkedInPostHour: true, linkedInPostTz: true },
  })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  return NextResponse.json({ hour: user.linkedInPostHour, timezone: user.linkedInPostTz })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { hour?: unknown; timezone?: unknown }
  const { hour, timezone } = body

  if (typeof hour !== 'number' || !Number.isInteger(hour) || hour < 0 || hour > 23) {
    return NextResponse.json({ error: 'hour must be an integer 0–23' }, { status: 400 })
  }
  if (typeof timezone !== 'string' || !timezone.trim()) {
    return NextResponse.json({ error: 'timezone is required' }, { status: 400 })
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone })
  } catch {
    return NextResponse.json({ error: `Invalid IANA timezone: "${timezone}"` }, { status: 400 })
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: { linkedInPostHour: hour, linkedInPostTz: timezone },
    select: { linkedInPostHour: true, linkedInPostTz: true },
  })

  return NextResponse.json({ hour: user.linkedInPostHour, timezone: user.linkedInPostTz })
}
