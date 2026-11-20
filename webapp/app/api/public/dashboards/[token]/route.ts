// Plan 9 follow-up — public read-only dashboard. Token in URL, no session.
//
// Returns the same shape as /api/dashboards/[id] minus userId and any other
// owner-only fields. The widget-data sibling endpoint lives one level deeper.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const dash = await prisma.dashboard.findUnique({
    where: { shareToken: token },
    select: {
      id: true, name: true, description: true, tabs: true, filters: true,
    },
  })
  if (!dash) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ dashboard: dash })
}
