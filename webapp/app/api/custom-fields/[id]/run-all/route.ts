// Plan 5 — bulk-run an AI column across many entity rows.
//
// Inline implementation (per the plan, async queue is deferred to v2). Caps
// the batch at 50 rows to stay under typical serverless function timeouts
// and limits per-user API spend. Runs 5 concurrent calls at a time.

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateText } from '@/lib/ai'
import { renderPrompt, updateEntityCustomField, type EntityKind } from '@/lib/customFields'

const MAX_BATCH = 50
const CONCURRENCY = 5

type AIProvider = 'anthropic' | 'openai' | 'gemini'

async function loadRow(entity: EntityKind, entityId: string, userId: string) {
  if (entity === 'lead')    return prisma.lead.findFirst({ where: { id: entityId, leadList: { userId } } })
  if (entity === 'contact') return prisma.contact.findFirst({ where: { id: entityId, userId } })
  return prisma.company.findFirst({ where: { id: entityId, userId } })
}

export const maxDuration = 60

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
  const ids: unknown = body.entityIds
  if (!Array.isArray(ids) || ids.length === 0)
    return NextResponse.json({ error: 'entityIds[] required' }, { status: 400 })
  if (ids.length > MAX_BATCH)
    return NextResponse.json({ error: `max ${MAX_BATCH} rows per call (got ${ids.length})` }, { status: 400 })

  let done = 0, failed = 0

  async function runOne(entityId: string): Promise<void> {
    const row = await loadRow(def!.entity as EntityKind, entityId, session!.user!.id)
    if (!row) { failed++; return }
    const prompt = renderPrompt(def!.aiPrompt ?? '', row as Record<string, unknown>)
    try {
      const value = (await generateText(prompt, {
        userId:    session!.user!.id,
        maxTokens: def!.aiMaxTokens ?? 200,
        provider:  (def!.aiProvider as AIProvider | undefined) ?? undefined,
        model:     def!.aiModel ?? undefined,
      })).trim()
      await updateEntityCustomField({
        entity: def!.entity as EntityKind,
        entityId,
        userId: session!.user!.id,
        key:    def!.key,
        value,
        runStatus: { status: 'done', lastRunAt: new Date().toISOString(), error: null },
      })
      done++
    } catch (e) {
      await updateEntityCustomField({
        entity: def!.entity as EntityKind,
        entityId,
        userId: session!.user!.id,
        key:    def!.key,
        value: null,
        runStatus: { status: 'failed', lastRunAt: new Date().toISOString(), error: e instanceof Error ? e.message : String(e) },
      }).catch(() => {})
      failed++
    }
  }

  // Process the queue with a small concurrency window.
  const queue = (ids as string[]).slice()
  const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    while (queue.length > 0) {
      const next = queue.shift()
      if (next) await runOne(next)
    }
  })
  await Promise.all(workers)

  return NextResponse.json({ done, failed, total: (ids as string[]).length })
}
