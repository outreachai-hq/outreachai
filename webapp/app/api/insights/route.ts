// Plan 10 — Insights API. SQL-derived signals computed on demand. No LLM
// calls in v1 (the full Context Center pre-prompts every AI surface — that
// piece is the bigger sibling and deferred for now).
//
// Returns up to 5 insights, each shaped:
//   { id, severity, title, body, href? }
// The UI renders them as a vertical stack of cards.

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Insight = {
  id:       string
  severity: 'info' | 'good' | 'warn' | 'critical'
  title:    string
  body:     string
  href?:    string
}

const DAY = 86_400_000

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  const now      = Date.now()
  const since7   = new Date(now - 7  * DAY)
  const since14  = new Date(now - 14 * DAY)
  const prev7Start = new Date(now - 14 * DAY)
  const prev7End   = since7

  const insights: Insight[] = []

  // ── 1. Reply rate week-over-week
  const [thisWk, lastWk] = await Promise.all([
    prisma.emailMessage.count({ where: { userId, status: 'replied', repliedAt: { gte: since7 } } }),
    prisma.emailMessage.count({ where: { userId, status: 'replied', repliedAt: { gte: prev7Start, lt: prev7End } } }),
  ])
  if (thisWk + lastWk > 0) {
    const delta = lastWk === 0 ? 100 : Math.round(((thisWk - lastWk) / lastWk) * 100)
    insights.push({
      id: 'reply_rate_wow',
      severity: delta >= 0 ? 'good' : (delta < -25 ? 'critical' : 'warn'),
      title: delta >= 0 ? `Replies up ${delta}% this week` : `Replies down ${Math.abs(delta)}% this week`,
      body: `${thisWk} reply(ies) in the last 7 days vs ${lastWk} the week before. ${
        delta < -25 ? 'Worth checking your latest sequence copy for clarity + CTA.' : ''
      }`,
      href: '/analytics',
    })
  }

  // ── 2. Hot leads going cold (score ≥ 70, no open in 14 days)
  const coldHot = await prisma.lead.count({
    where: {
      leadList: { userId },
      score: { gte: 70 },
      OR: [{ lastOpenedAt: null }, { lastOpenedAt: { lt: since14 } }],
    },
  })
  if (coldHot > 0) {
    insights.push({
      id: 'cold_hot_leads',
      severity: 'warn',
      title: `${coldHot} hot lead${coldHot === 1 ? '' : 's'} going cold`,
      body: `These were scored ≥ 70 but haven't opened anything in the last 2 weeks. Worth a manual nudge.`,
      href: '/hot-leads',
    })
  }

  // ── 3. Top company by engagement (last 30d)
  const since30 = new Date(now - 30 * DAY)
  const topCo = await prisma.leadActivity.groupBy({
    by: ['companyId'],
    where: { userId, occurredAt: { gte: since30 }, companyId: { not: null }, type: { in: ['email.opened', 'email.clicked', 'email.replied', 'linkedin.message_received'] } },
    _count: { _all: true },
    orderBy: { _count: { id: 'desc' } },
    take: 1,
  })
  if (topCo.length > 0 && topCo[0].companyId) {
    const co = await prisma.company.findFirst({
      where: { id: topCo[0].companyId, userId },
      select: { name: true, id: true },
    })
    if (co) {
      insights.push({
        id: `top_company_${co.id}`,
        severity: 'good',
        title: `${co.name} is engaging`,
        body: `${topCo[0]._count._all} engagement events from this account in the last 30 days. Consider escalating to a multi-thread account play.`,
        href: `/companies/${co.id}`,
      })
    }
  }

  // ── 4. Pending drafts piling up (Plan 8 follow-through)
  const pendingDrafts = await prisma.draftMessage.count({
    where: { userId, status: { in: ['pending', 'edited'] } },
  })
  if (pendingDrafts >= 5) {
    insights.push({
      id: 'pending_drafts',
      severity: 'warn',
      title: `${pendingDrafts} drafts waiting for review`,
      body: `Skim them in Outreach Queue — quick approve/reject keeps the auto-draft flywheel turning.`,
      href: '/outreach-queue',
    })
  }

  // ── 5. Stale active campaigns (no send in the last 7 days)
  const activeCampaigns = await prisma.campaign.findMany({
    where: { userId, status: 'active' },
    select: { id: true, name: true },
  })
  const staleCampaigns: { id: string; name: string }[] = []
  for (const c of activeCampaigns) {
    const lastEvent = await prisma.leadActivity.findFirst({
      where: { campaignId: c.id, type: { in: ['email.sent', 'linkedin.message_sent', 'linkedin.invite_sent'] } },
      orderBy: { occurredAt: 'desc' },
      select: { occurredAt: true },
    })
    if (!lastEvent || lastEvent.occurredAt < since7) staleCampaigns.push(c)
  }
  if (staleCampaigns.length > 0) {
    insights.push({
      id: 'stale_campaigns',
      severity: 'critical',
      title: `${staleCampaigns.length} active campaign${staleCampaigns.length === 1 ? '' : 's'} stuck`,
      body: `No sends in the last 7 days: ${staleCampaigns.slice(0, 3).map((c) => c.name).join(', ')}${staleCampaigns.length > 3 ? `, +${staleCampaigns.length - 3} more` : ''}. Check sender limits or schedule windows.`,
      href: '/campaigns',
    })
  }

  return NextResponse.json({ insights })
}
