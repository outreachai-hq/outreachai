// Plan 1 — Vercel-cron entry point for the sequence runner.
//
// Walks every user with at least one active campaign and asks the shared
// runner in lib/sequenceRunner.ts to advance their pending CampaignLead rows.
// Bearer-auth gated by env.CRON_SECRET, matching the convention used by the
// existing /api/cron/linkedin-publish route.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { runPendingStepsForUser } from '@/lib/sequenceRunner'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const users = await prisma.user.findMany({
    where: { campaigns: { some: { status: 'active' } } },
    select: { id: true },
  })

  // 60s Vercel function ceiling - keep 5s headroom for the response trip.
  const TOTAL_BUDGET_MS = 55_000
  const cronStartedAt = Date.now()
  const totals = {
    emailsSent: 0, linkedInQueued: 0, tasksCreated: 0,
    skipped: 0, bounced: 0, failed: 0, deferred: 0, errors: 0,
  }
  let processedUsers = 0
  let deferredUsers = 0

  // Sequential per-user. Each user gets a fair share of the remaining budget,
  // so one slow user can't starve the rest.
  for (let i = 0; i < users.length; i++) {
    const remaining = TOTAL_BUDGET_MS - (Date.now() - cronStartedAt)
    if (remaining <= 1000) {
      deferredUsers = users.length - i
      break
    }
    const perUserBudget = Math.max(5_000, Math.floor(remaining / Math.max(1, users.length - i)))
    const u = users[i]
    try {
      const r = await runPendingStepsForUser(u.id, 50, { maxRuntimeMs: perUserBudget })
      totals.emailsSent     += r.emailsSent
      totals.linkedInQueued += r.linkedInQueued
      totals.tasksCreated   += r.tasksCreated
      totals.skipped        += r.skipped
      totals.bounced        += r.bounced
      totals.failed         += r.failed
      totals.deferred       += r.deferred ?? 0
      totals.errors         += r.errors.length
      processedUsers++
      if (r.errors.length) {
        console.warn('[cron/run-sequence-steps]', u.id, r.errors.slice(0, 5))
      }
    } catch (err) {
      console.error('[cron/run-sequence-steps] user failed', u.id, err)
      totals.errors++
      processedUsers++
    }
  }

  return NextResponse.json({
    usersProcessed: processedUsers,
    deferredUsers,
    ...totals,
    elapsedMs: Date.now() - cronStartedAt,
  })
}
