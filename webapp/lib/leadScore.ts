import { prisma } from '@/lib/prisma'

// Scoring formula (max 100):
//   Opens:   min(openCount × 7, 35)  — rewards repeat opens, caps at 5 opens
//   Clicks:  min(clickCount × 25, 25) — one click is strong signal
//   Reply:   40 flat                  — strongest signal
//
// Examples:
//   1 open, 0 clicks, 0 replies → 7
//   3 opens, 1 click, 0 replies → 21 + 25 = 46
//   2 opens, 1 click, replied   → 14 + 25 + 40 = 79
//   5+ opens, 1+ click, replied → 35 + 25 + 40 = 100

function computeScore(openCount: number, clickCount: number, replied: boolean): number {
  const openPts  = Math.min(openCount * 7, 35)
  const clickPts = Math.min(clickCount * 25, 25)
  const replyPts = replied ? 40 : 0
  return Math.min(openPts + clickPts + replyPts, 100)
}

export async function updateLeadScore(leadId: string): Promise<void> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { openCount: true, clickCount: true, status: true },
  })
  if (!lead) return

  const replied = lead.status === 'replied'
  const score   = computeScore(lead.openCount, lead.clickCount, replied)

  await prisma.lead.update({ where: { id: leadId }, data: { score } })
}

// Called when an email open pixel fires for a given lead email address.
// Increments openCount, updates lastOpenedAt, then recomputes score.
export async function recordLeadOpen(leadId: string): Promise<void> {
  await prisma.lead.update({
    where: { id: leadId },
    data: { openCount: { increment: 1 }, lastOpenedAt: new Date() },
  })
  await updateLeadScore(leadId)
}

// Called when a tracked link click fires.
export async function recordLeadClick(leadId: string): Promise<void> {
  await prisma.lead.update({
    where: { id: leadId },
    data: { clickCount: { increment: 1 }, lastClickedAt: new Date() },
  })
  await updateLeadScore(leadId)
}

// Called when a reply is detected (status already set to 'replied' by caller).
export async function recordLeadReply(leadId: string): Promise<void> {
  await updateLeadScore(leadId)
}
