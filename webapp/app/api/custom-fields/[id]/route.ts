// Plan 5 — CustomFieldDef patch + delete.

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const EDITABLE_FIELDS = ['label', 'options', 'defaultValue', 'aiPrompt', 'aiProvider', 'aiModel', 'aiMaxTokens', 'aiAutoRun', 'position'] as const

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const owned = await prisma.customFieldDef.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  })
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const data: Record<string, unknown> = {}
  for (const k of EDITABLE_FIELDS) {
    if (body[k] !== undefined) data[k] = body[k]
  }
  if (typeof data.label === 'string') data.label = data.label.trim()
  // Type-changes are intentionally NOT allowed via PATCH — values in
  // customFields JSON would silently break. To change a column's type, the
  // user should delete + recreate (and accept the orphan-value gotcha).

  if (Object.keys(data).length === 0)
    return NextResponse.json({ error: 'no editable fields supplied' }, { status: 400 })

  const def = await prisma.customFieldDef.update({ where: { id }, data })
  return NextResponse.json({ def })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const result = await prisma.customFieldDef.deleteMany({ where: { id, userId: session.user.id } })
  if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Per the plan: stored values on entity rows are NOT purged. They become
  // orphan keys in customFields JSON. Recreating with the same key restores
  // them. (See Gotcha 5 in the plan; a "Delete & purge" action lives in v2.)
  return NextResponse.json({ ok: true })
}
