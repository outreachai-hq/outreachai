import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin'

const PAGE_SIZE_MAX = 100

// GET /api/admin/users?q=&plan=&page=1&pageSize=50
// Admin-only: lists every registered user. Never returns secrets/API keys.
export async function GET(req: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) {
    return NextResponse.json(
      { error: gate.status === 401 ? 'Unauthorized' : 'Forbidden' },
      { status: gate.status },
    )
  }

  const sp = req.nextUrl.searchParams
  const q = sp.get('q')?.trim() ?? ''
  const plan = sp.get('plan')?.trim() ?? ''
  const page = Math.max(1, parseInt(sp.get('page') ?? '1', 10) || 1)
  const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, parseInt(sp.get('pageSize') ?? '50', 10) || 50))

  const where: Prisma.UserWhereInput = {}
  if (q) {
    where.OR = [
      { email: { contains: q, mode: 'insensitive' } },
      { name: { contains: q, mode: 'insensitive' } },
    ]
  }
  if (plan) where.plan = plan

  try {
    const [total, users, planGroups] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          email: true,
          name: true,
          plan: true,
          password: true, // only used to derive auth method; stripped below
          onboardingCompleted: true,
          extensionConnected: true,
          createdAt: true,
          _count: { select: { contacts: true, campaigns: true, sequences: true } },
        },
      }),
      prisma.user.groupBy({ by: ['plan'], _count: { _all: true } }),
    ])

    const allTotal = planGroups.reduce((n, g) => n + g._count._all, 0)

    return NextResponse.json({
      users: users.map(({ password, _count, ...u }) => ({
        ...u,
        authMethod: password ? 'password' : 'oauth',
        contacts: _count.contacts,
        campaigns: _count.campaigns,
        sequences: _count.sequences,
      })),
      total,
      page,
      pageSize,
      stats: {
        totalUsers: allTotal,
        byPlan: Object.fromEntries(planGroups.map(g => [g.plan, g._count._all])),
      },
    })
  } catch (err) {
    console.error('[admin/users] GET error:', err)
    return NextResponse.json({ error: 'Failed to load users' }, { status: 500 })
  }
}
