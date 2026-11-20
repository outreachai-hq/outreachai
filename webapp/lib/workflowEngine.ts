// lib/workflowEngine.ts
//
// runWorkflowsForEvent — called fire-and-forget from trigger sites.
// Finds all active workflows matching the triggerKey for the user,
// evaluates conditions, executes actions, logs WorkflowRun.

import { prisma } from './prisma'

interface Condition {
  field: string
  operator: string   // 'eq' | 'not_eq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'not_contains' | 'is_empty' | 'not_empty'
  value: string | number
}

interface WorkflowAction {
  key: string
  config: Record<string, unknown>
}

export async function runWorkflowsForEvent(
  triggerKey: string,
  userId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const workflows = await prisma.workflow.findMany({
    where: { triggerKey, userId, active: true },
  })

  for (const wf of workflows) {
    try {
      const conditions = wf.conditions as unknown as Condition[]
      const actions = wf.actions as unknown as WorkflowAction[]

      // Evaluate conditions — all must pass (AND logic)
      const pass = conditions.every((c) => evaluateCondition(c, payload))
      if (!pass) {
        await logRun(wf.id, userId, payload, 'skipped', 0, undefined, getEntityInfo(payload))
        continue
      }

      // Execute actions sequentially
      let actionsRun = 0
      for (const action of actions) {
        await executeAction(action, userId, payload)
        actionsRun++
      }

      await logRun(wf.id, userId, payload, 'success', actionsRun, undefined, getEntityInfo(payload))
      await prisma.workflow.update({
        where: { id: wf.id },
        data: { runCount: { increment: 1 }, lastRunAt: new Date() },
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      await logRun(wf.id, userId, payload, 'error', 0, msg, getEntityInfo(payload))
    }
  }
}

function evaluateCondition(c: Condition, payload: Record<string, unknown>): boolean {
  // Resolve field value from payload using dot notation: 'lead.score' → payload.score
  const parts = c.field.split('.')
  const key = parts[parts.length - 1]
  const raw = payload[key]
  const val = typeof raw === 'string' ? raw : typeof raw === 'number' ? raw : String(raw ?? '')
  const cval = c.value

  switch (c.operator) {
    case 'eq':           return String(val) === String(cval)
    case 'not_eq':       return String(val) !== String(cval)
    case 'gt':           return Number(val) > Number(cval)
    case 'lt':           return Number(val) < Number(cval)
    case 'gte':          return Number(val) >= Number(cval)
    case 'lte':          return Number(val) <= Number(cval)
    case 'contains':     return String(val).toLowerCase().includes(String(cval).toLowerCase())
    case 'not_contains': return !String(val).toLowerCase().includes(String(cval).toLowerCase())
    case 'is_empty':     return !val || String(val).trim() === ''
    case 'not_empty':    return !!val && String(val).trim() !== ''
    default:             return true
  }
}

async function executeAction(
  action: WorkflowAction,
  userId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const cfg = action.config ?? {}
  const leadId = payload.leadId as string | undefined
  const dealId = payload.dealId as string | undefined
  const conversationId = payload.conversationId as string | undefined

  switch (action.key) {
    // ── Lead actions ────────────────────────────────────────────────────────
    case 'lead.add_tag': {
      if (!leadId) return
      const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { tags: true } })
      if (!lead) return
      const tag = String(cfg.tag ?? '')
      if (tag && !lead.tags.includes(tag)) {
        await prisma.lead.update({ where: { id: leadId }, data: { tags: { push: tag } } })
      }
      break
    }
    case 'lead.remove_tag': {
      if (!leadId) return
      const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { tags: true } })
      if (!lead) return
      await prisma.lead.update({
        where: { id: leadId },
        data: { tags: lead.tags.filter((t) => t !== String(cfg.tag ?? '')) },
      })
      break
    }
    case 'lead.update_status': {
      if (!leadId) return
      await prisma.lead.update({ where: { id: leadId }, data: { status: String(cfg.status ?? 'pending') } })
      break
    }

    // ── Deal actions ────────────────────────────────────────────────────────
    case 'deal.create': {
      // Find or create default pipeline for user
      let pipeline = await prisma.pipeline.findFirst({ where: { userId, isDefault: true } })
      if (!pipeline) pipeline = await prisma.pipeline.findFirst({ where: { userId } })
      if (!pipeline) return

      const stageId = cfg.stageId as string | undefined
      const stage = stageId
        ? await prisma.pipelineStage.findFirst({ where: { id: stageId, pipelineId: pipeline.id } })
        : await prisma.pipelineStage.findFirst({ where: { pipelineId: pipeline.id }, orderBy: { position: 'asc' } })
      if (!stage) return

      // Build title from payload
      let title = cfg.title as string | undefined
      if (!title && leadId) {
        const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { firstName: true, lastName: true, company: true } })
        title = lead ? `${lead.firstName} ${lead.lastName ?? ''}`.trim() + (lead.company ? ` — ${lead.company}` : '') : 'New Deal'
      }

      await prisma.deal.create({
        data: {
          userId, pipelineId: pipeline.id, stageId: stage.id,
          title: title ?? 'New Deal',
          contactId: (payload.contactId as string) ?? null,
          status: 'open',
        },
      })
      break
    }
    case 'deal.change_stage': {
      if (!dealId || !cfg.stageId) return
      await prisma.deal.update({
        where: { id: dealId },
        data: { stageId: String(cfg.stageId), updatedAt: new Date() },
      })
      break
    }
    case 'deal.mark_won': {
      if (!dealId) return
      await prisma.deal.update({ where: { id: dealId }, data: { status: 'won', wonAt: new Date() } })
      break
    }
    case 'deal.mark_lost': {
      if (!dealId) return
      await prisma.deal.update({
        where: { id: dealId },
        data: { status: 'lost', lostAt: new Date(), lostReason: cfg.reason as string ?? null },
      })
      break
    }

    // ── Task action ─────────────────────────────────────────────────────────
    case 'task.create': {
      const daysFromNow = Number(cfg.dueDaysFromNow ?? 1)
      const dueAt = new Date(Date.now() + daysFromNow * 86_400_000)
      await prisma.task.create({
        data: {
          userId, leadId: leadId ?? null,
          type: String(cfg.type ?? 'custom'),
          title: String(cfg.title ?? 'Follow up'),
          dueAt,
        },
      })
      break
    }

    // ── Conversation actions ─────────────────────────────────────────────────
    case 'conversation.add_label': {
      if (!conversationId || !cfg.label) return
      const conv = await prisma.conversation.findFirst({ where: { id: conversationId, userId }, select: { labels: true } })
      if (!conv) return
      const label = String(cfg.label)
      if (!conv.labels.includes(label)) {
        await prisma.conversation.update({ where: { id: conversationId }, data: { labels: { push: label } } })
      }
      break
    }
    case 'conversation.mark_done': {
      if (!conversationId) return
      await prisma.conversation.update({ where: { id: conversationId }, data: { status: 'done' } })
      break
    }

    // ── Notify actions ───────────────────────────────────────────────────────
    case 'notify.webhook': {
      const url = String(cfg.url ?? '')
      if (!url) return
      await fetch(url, {
        method: String(cfg.method ?? 'POST'),
        headers: { 'Content-Type': 'application/json', ...(cfg.headers as Record<string, string> ?? {}) },
        body: JSON.stringify({ trigger: payload, workflowAction: action.key }),
      }).catch(() => {})
      break
    }

    default:
      break
  }
}

function getEntityInfo(payload: Record<string, unknown>): { entityId?: string; entityType?: string } {
  if (payload.leadId)         return { entityId: String(payload.leadId),         entityType: 'lead' }
  if (payload.dealId)         return { entityId: String(payload.dealId),          entityType: 'deal' }
  if (payload.conversationId) return { entityId: String(payload.conversationId),  entityType: 'conversation' }
  if (payload.bookingId)      return { entityId: String(payload.bookingId),        entityType: 'booking' }
  return {}
}

async function logRun(
  workflowId: string,
  userId: string,
  payload: Record<string, unknown>,
  result: string,
  actionsRun: number,
  error?: string,
  entityInfo?: { entityId?: string; entityType?: string }
) {
  await prisma.workflowRun.create({
    data: {
      workflowId, userId,
      entityId: entityInfo?.entityId ?? null,
      entityType: entityInfo?.entityType ?? null,
      result, error: error ?? null, actionsRun,
      payload: payload as object,
    },
  }).catch(() => {})
}
