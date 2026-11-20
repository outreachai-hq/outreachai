// Plan 4 (Iter 23) — company-rollup activity feed.
//
// Returns every LeadActivity where companyId == this company.id. Useful for
// the "Activity" tab on the company detail page so users see the chronological
// thread across every contact and lead at the same account.

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const company = await prisma.company.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  })
  if (!company) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const limit = Math.min(Number(searchParams.get('limit') ?? 200), 500)

  const activities = await prisma.leadActivity.findMany({
    where: { companyId: id },
    orderBy: { occurredAt: 'desc' },
    take: limit,
  })

  return NextResponse.json({ activities })
}
