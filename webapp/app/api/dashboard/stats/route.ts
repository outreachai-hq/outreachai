import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user!.id

  const now = new Date()
  const todayEnd = new Date(now)
  todayEnd.setHours(23, 59, 59, 999)

  const [leadLists, campaigns, contacts, sequences, emailMessages, conversations, hotLeadsCount, tasksDueToday] = await Promise.all([
    prisma.leadList.findMany({ where: { userId }, include: { leads: { select: { id: true } } } }),
    prisma.campaign.findMany({ where: { userId }, select: { id: true, status: true } }),
    prisma.contact.findMany({ where: { userId }, select: { id: true, status: true } }),
    prisma.sequence.count({ where: { userId } }),
    prisma.emailMessage.findMany({ where: { userId }, select: { status: true } }),
    prisma.conversation.findMany({ where: { userId }, select: { lastSenderIsMe: true } }),
    prisma.lead.count({
      where: {
        leadList: { userId },
        OR: [
          { score: { gt: 0 } },
          { status: 'replied' },
        ],
      },
    }),
    prisma.task.count({
      where: {
        userId,
        completedAt: null,
        dueAt: { lte: todayEnd },
      },
    }),
  ])

  const totalLeads      = leadLists.reduce((sum, list) => sum + list.leads.length, 0)
  const activeCampaigns = campaigns.filter((c) => c.status === 'active').length
  const totalContacts   = contacts.length
  const totalReplies    = contacts.filter((c) => c.status === 'replied').length
  const replyRate       = totalContacts > 0 ? Number(((totalReplies / totalContacts) * 100).toFixed(1)) : 0
  const emailsSent      = emailMessages.length
  const emailReplied    = emailMessages.filter(m => m.status === 'replied').length
  const conversationsTotal   = conversations.length
  const conversationsReplied = conversations.filter(c => !c.lastSenderIsMe).length

  // 7-day daily sparkline data
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000)
  const recentActivities = await prisma.leadActivity.findMany({
    where: { userId, occurredAt: { gte: sevenDaysAgo } },
    select: { type: true, occurredAt: true },
  })

  // Build daily buckets [day-6, day-5, ..., today]
  const dailyBuckets = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    const dateStr = d.toISOString().slice(0, 10)
    const dayActivities = recentActivities.filter((a) => a.occurredAt.toISOString().slice(0, 10) === dateStr)
    return {
      date: dateStr,
      emailsSent: dayActivities.filter((a) => a.type === 'email.sent').length,
      replies: dayActivities.filter((a) => a.type === 'email.replied' || a.type === 'linkedin.message_received').length,
    }
  })

  const sparklineEmailsSent = dailyBuckets.map((b) => b.emailsSent)
  const sparklineReplies = dailyBuckets.map((b) => b.replies)

  return NextResponse.json({
    totalLeads,
    activeCampaigns,
    totalContacts,
    totalReplies,
    replyRate,
    totalSequences: sequences,
    emailsSent,
    emailReplied,
    // Kept the legacy `inboxThreads` key name on the response so the analytics
    // page doesn't need a coordinated change. Source data now spans every
    // channel (LinkedIn + email) via Conversation, not just LinkedIn DMs.
    inboxThreads: conversationsTotal,
    inboxReplied: conversationsReplied,
    hotLeadsCount,
    tasksDueToday,
    sparklineEmailsSent,
    sparklineReplies,
  })
}
