// Plan 9 — fetch live data for a single widget on a dashboard.
//
// Looks up the dashboard, finds the widget by id in the tabs JSON, then
// dispatches to lib/widgets/queries.ts. Widget config + dashboard filters
// merge with optional URL overrides so the page can swap date ranges
// without persisting.

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { runWidget } from '@/lib/widgets/queries'
import type { Tab } from '@/lib/widgets/catalog'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; widgetId: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, widgetId } = await params

  const dash = await prisma.dashboard.findFirst({
    where: { id, userId: session.user.id },
    select: { tabs: true, filters: true },
  })
  if (!dash) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const tabs = (dash.tabs ?? []) as unknown as Tab[]
  const widget = tabs.flatMap((t) => t.widgets ?? []).find((w) => w.id === widgetId)
  if (!widget) return NextResponse.json({ error: 'Widget not found' }, { status: 404 })

  // Future: merge URL overrides into widget.config before passing.
  try {
    const data = await runWidget(session.user.id, widget.type, widget.config ?? {})
    return NextResponse.json({ data, type: widget.type })
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Widget query failed',
    }, { status: 500 })
  }
}
