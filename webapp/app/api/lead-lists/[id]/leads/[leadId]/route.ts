import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { buildCustomFieldsPatch } from '@/lib/customFields'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; leadId: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, leadId } = await params

  // Verify ownership
  const list = await prisma.leadList.findFirst({
    where: { id, userId: session.user!.id },
  })
  if (!list) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()

  // Plan 5 — merge custom fields into the existing JSON. The patch arrives
  // as `customFields: { <defKey>: <value> }`; we validate against the user's
  // CustomFieldDef rows and coerce per-type before persisting.
  let mergedCustomFields: Prisma.InputJsonValue | undefined
  if (body.customFields && typeof body.customFields === 'object') {
    const sanitized = await buildCustomFieldsPatch({
      userId: session.user!.id,
      entity: 'lead',
      patch:  body.customFields as Record<string, unknown>,
    })
    if (Object.keys(sanitized).length > 0) {
      const existing = await prisma.lead.findUnique({ where: { id: leadId }, select: { customFields: true } })
      mergedCustomFields = {
        ...((existing?.customFields as Record<string, unknown>) ?? {}),
        ...sanitized,
      } as Prisma.InputJsonValue
    }
  }

  const lead = await prisma.lead.update({
    where: { id: leadId },
    data: {
      ...(body.firstName   !== undefined && { firstName:   body.firstName }),
      ...(body.lastName    !== undefined && { lastName:    body.lastName    ?? null }),
      ...(body.email       !== undefined && { email:       body.email       ?? null }),
      ...(body.company     !== undefined && { company:     body.company     ?? null }),
      ...(body.linkedinUrl !== undefined && { linkedinUrl: body.linkedinUrl ?? null }),
      ...(body.headline    !== undefined && { headline:    body.headline    ?? null }),
      ...(mergedCustomFields !== undefined && { customFields: mergedCustomFields }),
    },
  })

  return NextResponse.json({ lead })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; leadId: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, leadId } = await params

  const list = await prisma.leadList.findFirst({
    where: { id, userId: session.user!.id },
  })
  if (!list) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.lead.delete({ where: { id: leadId } })
  return NextResponse.json({ ok: true })
}
