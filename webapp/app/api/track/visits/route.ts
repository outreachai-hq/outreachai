import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const limit = Math.min(Number(searchParams.get('limit') ?? 50), 200)
  const matchedOnly = searchParams.get('matchedOnly') === 'true'

  const visits = await prisma.websiteVisit.findMany({
    where: {
      userId: session.user.id,
      ...(matchedOnly ? {
        OR: [
          { matchedLeadId: { not: null } },
          { matchedContactId: { not: null } },
          { matchedCompanyId: { not: null } },
        ],
      } : {}),
    },
    orderBy: { visitedAt: 'desc' },
    take: limit,
  })

  return NextResponse.json({ visits })
}
