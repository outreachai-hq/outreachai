import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { runWorkflowsForEvent } from '@/lib/workflowEngine'

// GET — auth via CRON_SECRET header
// Checks deal.close_date_passed and task.overdue for all users
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  // Allow Vercel cron (no secret header) or explicit CRON_SECRET bearer
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  let tasksProcessed = 0
  let dealsProcessed = 0

  // ── Overdue tasks ───────────────────────────────────────────────────────────
  const overdueTasks = await prisma.task.findMany({
    where: {
      completedAt: null,
      dueAt: { lt: now },
    },
    select: { id: true, userId: true, leadId: true },
    take: 500,
  })

  for (const task of overdueTasks) {
    runWorkflowsForEvent('task.overdue', task.userId, {
      taskId: task.id,
      leadId: task.leadId ?? undefined,
    }).catch(() => {})
    tasksProcessed++
  }

  // ── Deals past close date ───────────────────────────────────────────────────
  const overdueDeals = await prisma.deal.findMany({
    where: {
      status: 'open',
      closeDate: { lt: now },
    },
    select: { id: true, userId: true },
    take: 500,
  })

  for (const deal of overdueDeals) {
    runWorkflowsForEvent('deal.close_date_passed', deal.userId, {
      dealId: deal.id,
    }).catch(() => {})
    dealsProcessed++
  }

  return NextResponse.json({
    ok: true,
    tasksProcessed,
    dealsProcessed,
    checkedAt: now.toISOString(),
  })
}
