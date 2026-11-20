// Plan 5 — CustomFieldDef list + create.

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ENTITY_KINDS, FIELD_TYPES, validateKey, slugifyKey, type EntityKind, type FieldType } from '@/lib/customFields'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const entity = searchParams.get('entity')
  if (entity && !(ENTITY_KINDS as readonly string[]).includes(entity))
    return NextResponse.json({ error: 'invalid entity' }, { status: 400 })

  const defs = await prisma.customFieldDef.findMany({
    where: { userId: session.user.id, ...(entity ? { entity } : {}) },
    orderBy: [{ entity: 'asc' }, { position: 'asc' }, { createdAt: 'asc' }],
  })
  return NextResponse.json({ defs })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))

  const entity = String(body.entity ?? '')
  if (!(ENTITY_KINDS as readonly string[]).includes(entity))
    return NextResponse.json({ error: 'entity must be lead | contact | company' }, { status: 400 })

  const type = String(body.type ?? '')
  if (!(FIELD_TYPES as readonly string[]).includes(type))
    return NextResponse.json({ error: `type must be one of ${FIELD_TYPES.join(', ')}` }, { status: 400 })

  const label = typeof body.label === 'string' ? body.label.trim() : ''
  if (!label) return NextResponse.json({ error: 'label required' }, { status: 400 })

  const key = slugifyKey(typeof body.key === 'string' && body.key.trim() ? body.key : label)
  const keyErr = validateKey(key, entity as EntityKind)
  if (keyErr) return NextResponse.json({ error: keyErr }, { status: 400 })

  // AI-specific validation
  if (type === 'ai' && (!body.aiPrompt || typeof body.aiPrompt !== 'string' || !body.aiPrompt.trim())) {
    return NextResponse.json({ error: 'aiPrompt required for type=ai' }, { status: 400 })
  }

  try {
    const def = await prisma.customFieldDef.create({
      data: {
        userId:       session.user.id,
        entity,
        key,
        label,
        type:         type as FieldType,
        options:      body.options ?? null,
        defaultValue: body.defaultValue ?? null,
        aiPrompt:     type === 'ai' ? String(body.aiPrompt).trim() : null,
        aiProvider:   type === 'ai' && typeof body.aiProvider === 'string' ? body.aiProvider : null,
        aiModel:      type === 'ai' && typeof body.aiModel === 'string'    ? body.aiModel    : null,
        aiMaxTokens:  type === 'ai' && Number.isFinite(Number(body.aiMaxTokens)) ? Number(body.aiMaxTokens) : 200,
        aiAutoRun:    type === 'ai' && body.aiAutoRun === true,
        position:     Number.isFinite(Number(body.position)) ? Number(body.position) : 0,
      },
    })
    return NextResponse.json({ def }, { status: 201 })
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === 'P2002') {
      return NextResponse.json({ error: `Field with key "${key}" already exists for ${entity}` }, { status: 409 })
    }
    throw err
  }
}
