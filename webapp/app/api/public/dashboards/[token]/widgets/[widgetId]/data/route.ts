// Plan 9 follow-up — token-scoped widget-data endpoint. The token authenticates
// the request; queries run against the dashboard owner's data.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { runWidget } from '@/lib/widgets/queries'
import type { Tab } from '@/lib/widgets/catalog'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string; widgetId: string }> },
) {
  const { token, widgetId } = await params
  if (!token) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const dash = await prisma.dashboard.findUnique({
    where: { shareToken: token },
    select: { tabs: true, userId: true },
  })
  if (!dash) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const widget = ((dash.tabs ?? []) as unknown as Tab[])
    .flatMap((t) => t.widgets ?? [])
    .find((w) => w.id === widgetId)
  if (!widget) return NextResponse.json({ error: 'Widget not found' }, { status: 404 })

  try {
    const data = await runWidget(dash.userId, widget.type, widget.config ?? {})
    return NextResponse.json({ data, type: widget.type })
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Widget query failed',
    }, { status: 500 })
  }
}
