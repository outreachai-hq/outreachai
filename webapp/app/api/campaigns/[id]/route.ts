import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const campaign = await prisma.campaign.findFirst({
    where: { id, userId: session.user!.id },
    include: {
      sequence: true,
      leadList: {
        include: {
          leads: {
            orderBy: { createdAt: 'asc' },
          },
        },
      },
      leads: {
        include: {
          lead: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              company: true,
              linkedinUrl: true,
              headline: true,
              aiOpener: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(campaign)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { status, name, emailAccountIds, dailyEmailLimit, scheduleId } = body

  const existing = await prisma.campaign.findFirst({ where: { id, userId: session.user!.id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (emailAccountIds !== undefined) {
    if (!Array.isArray(emailAccountIds) || emailAccountIds.some((x) => typeof x !== 'string')) {
      return NextResponse.json({ error: 'emailAccountIds must be string[]' }, { status: 400 })
    }
    // All ids must belong to this user
    if (emailAccountIds.length) {
      const count = await prisma.emailAccount.count({
        where: { userId: session.user!.id, id: { in: emailAccountIds } },
      })
      if (count !== emailAccountIds.length) {
        return NextResponse.json({ error: 'One or more email accounts do not belong to you' }, { status: 400 })
      }
    }
  }

  if (dailyEmailLimit !== undefined) {
    const n = Number(dailyEmailLimit)
    if (!Number.isFinite(n) || n < 0 || n > 100_000) {
      return NextResponse.json({ error: 'dailyEmailLimit must be 0–100000' }, { status: 400 })
    }
  }

  // Plan 7 — scheduleId must reference one of this user's schedules (or null).
  if (scheduleId !== undefined && scheduleId !== null) {
    if (typeof scheduleId !== 'string') {
      return NextResponse.json({ error: 'scheduleId must be a string or null' }, { status: 400 })
    }
    const ok = await prisma.schedule.findFirst({
      where: { id: scheduleId, userId: session.user!.id },
      select: { id: true },
    })
    if (!ok) return NextResponse.json({ error: 'Schedule not found' }, { status: 400 })
  }

  const updated = await prisma.campaign.update({
    where: { id },
    data: {
      ...(status !== undefined && { status }),
      ...(name !== undefined && { name }),
      ...(emailAccountIds !== undefined && { emailAccountIds }),
      ...(dailyEmailLimit !== undefined && { dailyEmailLimit: Number(dailyEmailLimit) }),
      ...(scheduleId !== undefined && { scheduleId }),
    },
  })

  return NextResponse.json(updated)
}
