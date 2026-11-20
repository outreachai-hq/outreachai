// Plan 5 — run an AI column for one entity row.
//
// Loads the def, loads the row, renders the prompt, calls generateText, and
// writes the value + AI-run status. All failures (no AI key, LLM error)
// surface as JSON errors so the UI can show a per-row error indicator.

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateText } from '@/lib/ai'
import { renderPrompt, updateEntityCustomField, type EntityKind } from '@/lib/customFields'
import { Activity } from '@/lib/activity'

type AIProvider = 'anthropic' | 'openai' | 'gemini'

async function loadRow(entity: EntityKind, entityId: string, userId: string) {
  if (entity === 'lead') {
    return prisma.lead.findFirst({ where: { id: entityId, leadList: { userId } } })
  }
  if (entity === 'contact') {
    return prisma.contact.findFirst({ where: { id: entityId, userId } })
  }
  return prisma.company.findFirst({ where: { id: entityId, userId } })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const def = await prisma.customFieldDef.findFirst({
    where: { id, userId: session.user.id, type: 'ai' },
  })
  if (!def) return NextResponse.json({ error: 'Field not found or not an AI column' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const entityId = typeof body.entityId === 'string' ? body.entityId : ''
  if (!entityId) return NextResponse.json({ error: 'entityId required' }, { status: 400 })

  const row = await loadRow(def.entity as EntityKind, entityId, session.user.id)
  if (!row) return NextResponse.json({ error: 'Entity not found' }, { status: 404 })

  const prompt = renderPrompt(def.aiPrompt ?? '', row as Record<string, unknown>)

  let value: string
  try {
    value = (await generateText(prompt, {
      userId:    session.user.id,
      maxTokens: def.aiMaxTokens ?? 200,
      provider:  (def.aiProvider as AIProvider | undefined) ?? undefined,
      model:     def.aiModel ?? undefined,
    })).trim()
  } catch (e) {
    // Record the failure on the row so the UI can show a retry button.
    await updateEntityCustomField({
      entity: def.entity as EntityKind,
      entityId,
      userId: session.user.id,
      key: def.key,
      value: null,
      runStatus: { status: 'failed', lastRunAt: new Date().toISOString(), error: e instanceof Error ? e.message : String(e) },
    }).catch(() => {})
    return NextResponse.json({ error: e instanceof Error ? e.message : 'AI error' }, { status: 502 })
  }

  await updateEntityCustomField({
    entity: def.entity as EntityKind,
    entityId,
    userId: session.user.id,
    key: def.key,
    value,
    runStatus: { status: 'done', lastRunAt: new Date().toISOString(), error: null },
  })

  // Activity timeline — fire-and-forget. Only meaningful for lead rows
  // because Activity.enrichmentCompleted is a lead-shaped event.
  if (def.entity === 'lead') {
    Activity.enrichmentCompleted({
      userId:   session.user.id,
      leadId:   entityId,
      provider: `AI column: ${def.label}`,
    }).catch(() => {})
  }

  return NextResponse.json({ value, entityId, defId: def.id })
}
