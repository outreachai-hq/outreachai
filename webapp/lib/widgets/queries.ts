// Plan 9 — server-side query helpers per widget type.
//
// Each function takes (userId, config) and returns a serialisable value the
// renderer understands. Keep these dumb: no aggregations across widgets, no
// auth checks (the route handler already verified ownership).

import { prisma } from '../prisma'
import { computeSinceMs, type MetricKey, type WindowKey } from './catalog'

type Cfg = Record<string, unknown>

function s(v: unknown, fallback: string): string {
  return typeof v === 'string' ? v : fallback
}
function n(v: unknown, fallback: number): number {
  const x = Number(v)
  return Number.isFinite(x) ? x : fallback
}

// ─── KPI.NUMBER ───────────────────────────────────────────────────────────────
export async function runKpiNumber(userId: string, cfg: Cfg): Promise<{ value: number; label?: string }> {
  const metric = s(cfg.metric, 'emails_sent') as MetricKey
  const since  = computeSinceMs(s(cfg.window, '30d') as WindowKey)

  switch (metric) {
    case 'emails_sent': {
      const value = await prisma.emailMessage.count({
        where: { userId, ...(since ? { sentAt: { gte: since } } : {}), status: { in: ['sent', 'opened', 'replied'] } },
      })
      return { value }
    }
    case 'opens': {
      const value = await prisma.emailMessage.count({
        where: { userId, ...(since ? { openedAt: { gte: since } } : { openedAt: { not: null } }) },
      })
      return { value }
    }
    case 'clicks': {
      const value = await prisma.emailEvent.count({
        where: { type: 'clicked', ...(since ? { createdAt: { gte: since } } : {}) },
      })
      return { value }
    }
    case 'replies': {
      const value = await prisma.emailMessage.count({
        where: { userId, status: 'replied', ...(since ? { repliedAt: { gte: since } } : {}) },
      })
      return { value }
    }
    case 'bounces': {
      const value = await prisma.emailMessage.count({
        where: { userId, status: 'bounced', ...(since ? { sentAt: { gte: since } } : {}) },
      })
      return { value }
    }
    case 'linkedin_sent': {
      const value = await prisma.linkedInAction.count({
        where: { userId, status: 'done', actionType: 'chat_message', ...(since ? { doneAt: { gte: since } } : {}) },
      })
      return { value }
    }
    case 'meetings_booked': {
      // Use a heuristic: count Conversations labelled 'meeting_booked' within window.
      const value = await prisma.conversation.count({
        where: { userId, labels: { has: 'meeting_booked' }, ...(since ? { updatedAt: { gte: since } } : {}) },
      })
      return { value }
    }
    case 'hot_leads': {
      const value = await prisma.lead.count({ where: { leadList: { userId }, score: { gte: 70 } } })
      return { value }
    }
    case 'tasks_pending': {
      const value = await prisma.task.count({ where: { userId, completedAt: null } })
      return { value }
    }
    default:
      return { value: 0, label: 'unknown metric' }
  }
}

// ─── CHART.LINE ───────────────────────────────────────────────────────────────
type SeriesPoint = { bucket: string; value: number }

export async function runChartLine(userId: string, cfg: Cfg): Promise<SeriesPoint[]> {
  const metric      = s(cfg.metric, 'emails_sent') as MetricKey
  const window      = s(cfg.window, '30d') as WindowKey
  const granularity = s(cfg.granularity, 'day') as 'day' | 'week' | 'month'
  const since       = computeSinceMs(window) ?? new Date(Date.now() - 30 * 86_400_000)

  // Pick the column to aggregate on per metric.
  const config = (() => {
    switch (metric) {
      case 'emails_sent':   return { table: '"EmailMessage"', column: '"sentAt"',    where: `"userId" = $1 AND "sentAt" >= $2` }
      case 'opens':         return { table: '"EmailMessage"', column: '"openedAt"',  where: `"userId" = $1 AND "openedAt" >= $2` }
      case 'replies':       return { table: '"EmailMessage"', column: '"repliedAt"', where: `"userId" = $1 AND "status" = 'replied' AND "repliedAt" >= $2` }
      case 'bounces':       return { table: '"EmailMessage"', column: '"sentAt"',    where: `"userId" = $1 AND "status" = 'bounced' AND "sentAt" >= $2` }
      case 'clicks':        return { table: '"EmailEvent"',   column: '"createdAt"', where: `"type" = 'clicked' AND "createdAt" >= $2` }
      case 'linkedin_sent': return { table: '"LinkedInAction"', column: '"doneAt"',  where: `"userId" = $1 AND "status" = 'done' AND "doneAt" >= $2` }
      default:              return { table: '"EmailMessage"', column: '"sentAt"',    where: `"userId" = $1 AND "sentAt" >= $2` }
    }
  })()

  // Use $queryRawUnsafe carefully: only `config.table` / `config.column` /
  // `config.where` / `granularity` interpolate, all hard-coded above.
  const sql = `
    SELECT to_char(date_trunc('${granularity}', ${config.column}), 'YYYY-MM-DD') AS bucket,
           COUNT(*)::int                                                          AS value
      FROM ${config.table}
     WHERE ${config.where}
     GROUP BY bucket
     ORDER BY bucket
  `
  const rows = await prisma.$queryRawUnsafe<SeriesPoint[]>(sql, userId, since)
  return rows
}

// ─── FUNNEL.LEAD ──────────────────────────────────────────────────────────────
export async function runFunnelLead(userId: string, _cfg: Cfg): Promise<{ stage: string; value: number }[]> {
  const where = { leadList: { userId } }
  const [pending, inProgress, completed, replied] = await Promise.all([
    prisma.lead.count({ where: { ...where, status: 'pending'     } }),
    prisma.lead.count({ where: { ...where, status: 'in_progress' } }),
    prisma.lead.count({ where: { ...where, status: 'completed'   } }),
    prisma.lead.count({ where: { ...where, status: 'replied'     } }),
  ])
  return [
    { stage: 'Pending',     value: pending     },
    { stage: 'In progress', value: inProgress  },
    { stage: 'Completed',   value: completed   },
    { stage: 'Replied',     value: replied     },
  ]
}

// ─── TABLE.HOT_LEADS ──────────────────────────────────────────────────────────
type HotLeadRow = { id: string; name: string; company: string | null; score: number; status: string }
export async function runTableHotLeads(userId: string, cfg: Cfg): Promise<HotLeadRow[]> {
  const limit = Math.min(n(cfg.limit, 10), 50)
  const rows = await prisma.lead.findMany({
    where: { leadList: { userId } },
    orderBy: [{ score: 'desc' }, { lastOpenedAt: 'desc' }],
    take: limit,
    select: { id: true, firstName: true, lastName: true, company: true, score: true, status: true },
  })
  return rows.map((r) => ({
    id: r.id,
    name: `${r.firstName} ${r.lastName ?? ''}`.trim(),
    company: r.company,
    score: r.score,
    status: r.status,
  }))
}

// ─── TABLE.RECENT_REPLIES ─────────────────────────────────────────────────────
type ReplyRow = { id: string; participantName: string; channel: string; lastMessage: string; at: string }
export async function runTableRecentReplies(userId: string, cfg: Cfg): Promise<ReplyRow[]> {
  const limit = Math.min(n(cfg.limit, 10), 50)
  const rows = await prisma.conversation.findMany({
    where:   { userId, lastSenderIsMe: false },
    orderBy: { lastMessageAt: 'desc' },
    take:    limit,
    select:  {
      id: true, participantName: true, channel: true, lastMessageAt: true,
      messages: { orderBy: { sentAt: 'desc' }, take: 1, select: { body: true } },
    },
  })
  return rows.map((r) => ({
    id:              r.id,
    participantName: r.participantName,
    channel:         r.channel,
    lastMessage:     r.messages[0]?.body ?? '',
    at:              r.lastMessageAt?.toISOString() ?? '',
  }))
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────
export async function runWidget(
  userId: string,
  type: string,
  cfg: Cfg,
): Promise<unknown> {
  switch (type) {
    case 'kpi.number':         return runKpiNumber(userId, cfg)
    case 'chart.line':         return runChartLine(userId, cfg)
    case 'funnel.lead':        return runFunnelLead(userId, cfg)
    case 'table.hot_leads':    return runTableHotLeads(userId, cfg)
    case 'table.recent_replies': return runTableRecentReplies(userId, cfg)
    default: throw new Error(`Unknown widget type: ${type}`)
  }
}
