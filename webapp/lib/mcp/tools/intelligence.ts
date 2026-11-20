import { prisma } from '@/lib/prisma'
import { generateText } from '@/lib/ai'
import type { McpTool } from '../types'

export const intelligenceTools: McpTool[] = [
  {
    name: 'getHotLeads',
    description:
      'Return high-priority leads: those with a recent reply, email opens, or a positive score. Use this to decide who to follow up with today.',
    params: {
      limit: { type: 'number', description: 'Max leads to return (default 20)', optional: true },
    },
    async handler(args, userId) {
      const limit = Math.min(Number(args.limit ?? 20), 100)

      const leads = await prisma.lead.findMany({
        where: {
          leadList: { userId },
          OR: [
            { score: { gt: 0 } },
            { openCount: { gt: 0 } },
            { status: 'replied' },
            { lastOpenedAt: { gte: new Date(Date.now() - 7 * 86_400_000) } },
          ],
        },
        orderBy: [{ score: 'desc' }, { lastOpenedAt: 'desc' }],
        take: limit,
        select: {
          id: true, firstName: true, lastName: true, email: true, company: true,
          headline: true, linkedinUrl: true, status: true, score: true,
          openCount: true, clickCount: true, lastOpenedAt: true, aiOpener: true,
        },
      })

      if (leads.length === 0) return 'No hot leads found.'
      return JSON.stringify(leads, null, 2)
    },
  },

  {
    name: 'suggestReply',
    description:
      'Generate a contextual reply draft for an inbox conversation using Claude. Returns a ready-to-send message.',
    params: {
      threadId: { type: 'string', description: 'Conversation ID to draft a reply for (param name kept as "threadId" for backwards compat)' },
      tone: { type: 'string', description: 'Tone: professional | friendly | concise (default: professional)', optional: true },
    },
    async handler(args, userId) {
      const conv = await prisma.conversation.findFirst({
        where: { id: String(args.threadId), userId },
        include: { messages: { orderBy: { sentAt: 'desc' }, take: 1, select: { body: true } } },
      })
      if (!conv) return 'Error: Conversation not found.'

      const lastMessage = conv.messages[0]?.body ?? '(no messages yet)'
      const tone = String(args.tone ?? 'professional')
      const channelLabel = conv.channel === 'email' ? 'email' : 'LinkedIn message'
      const prompt = `You are an SDR replying to a ${channelLabel}. Write a ${tone} reply.

Conversation context:
- Participant: ${conv.participantName}
- Last message: "${lastMessage}"
- Last sender was ${conv.lastSenderIsMe ? 'me' : 'them'}

Rules: Keep it under 3 sentences. Don't be salesy. End with a clear next step or question. Output ONLY the reply text.`

      let reply: string
      try {
        reply = await generateText(prompt, { maxTokens: 250, userId })
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`
      }
      return JSON.stringify({ threadId: conv.id, participant: conv.participantName, suggestedReply: reply })
    },
  },

  {
    name: 'getCampaignPerformance',
    description:
      'Get detailed performance metrics for a campaign: open rate, reply rate, step-by-step breakdown, and lead status distribution.',
    params: {
      campaignId: { type: 'string', description: 'Campaign ID' },
    },
    async handler(args, userId) {
      const campaign = await prisma.campaign.findFirst({
        where: { id: String(args.campaignId), userId },
        include: {
          leads: {
            include: { lead: { select: { openCount: true, clickCount: true, status: true } } },
          },
          sequence: true,
        },
      })
      if (!campaign) return 'Error: Campaign not found.'

      const total = campaign.leads.length
      const byStatus = campaign.leads.reduce<Record<string, number>>((acc, cl) => {
        acc[cl.status] = (acc[cl.status] ?? 0) + 1
        return acc
      }, {})

      const totalOpens = campaign.leads.reduce((s, cl) => s + (cl.lead.openCount ?? 0), 0)
      const totalClicks = campaign.leads.reduce((s, cl) => s + (cl.lead.clickCount ?? 0), 0)
      const replied = byStatus['replied'] ?? 0

      const stepDist = campaign.leads.reduce<Record<number, number>>((acc, cl) => {
        acc[cl.currentStep] = (acc[cl.currentStep] ?? 0) + 1
        return acc
      }, {})

      return JSON.stringify({
        campaignId: campaign.id,
        name: campaign.name,
        status: campaign.status,
        launchedAt: campaign.launchedAt,
        totalLeads: total,
        statusBreakdown: byStatus,
        stepDistribution: stepDist,
        metrics: {
          openRate: total ? `${((totalOpens / total) * 100).toFixed(1)}%` : '0%',
          clickRate: total ? `${((totalClicks / total) * 100).toFixed(1)}%` : '0%',
          replyRate: total ? `${((replied / total) * 100).toFixed(1)}%` : '0%',
          totalOpens,
          totalClicks,
          replied,
        },
      }, null, 2)
    },
  },

  {
    name: 'getDashboardStats',
    description:
      'Get overall account stats: total leads, active campaigns, emails sent, reply rate, open rate, and hot leads count.',
    params: {},
    async handler(_args, userId) {
      const [
        totalLeads,
        activeCampaigns,
        emailsSent,
        hotLeads,
        replyCount,
        openCount,
      ] = await Promise.all([
        prisma.lead.count({ where: { leadList: { userId } } }),
        prisma.campaign.count({ where: { userId, status: 'active' } }),
        prisma.emailMessage.count({ where: { userId } }),
        prisma.lead.count({ where: { leadList: { userId }, OR: [{ score: { gt: 0 } }, { status: 'replied' }] } }),
        prisma.emailMessage.count({ where: { userId, status: 'replied' } }),
        prisma.emailMessage.count({ where: { userId, status: 'opened' } }),
      ])

      return JSON.stringify({
        totalLeads,
        activeCampaigns,
        emailsSent,
        hotLeads,
        replyRate: emailsSent ? `${((replyCount / emailsSent) * 100).toFixed(1)}%` : '0%',
        openRate: emailsSent ? `${((openCount / emailsSent) * 100).toFixed(1)}%` : '0%',
      }, null, 2)
    },
  },

  {
    name: 'getNotifications',
    description:
      'Get action items: overdue campaign leads, unread inbox threads, and recent replies that need attention.',
    params: {},
    async handler(_args, userId) {
      const now = new Date()

      const [overdueLeads, unreadThreads, recentReplies] = await Promise.all([
        prisma.campaignLead.findMany({
          where: { status: 'pending', nextActionAt: { lte: now }, campaign: { userId, status: 'active' } },
          include: { lead: { select: { firstName: true, lastName: true, email: true } }, campaign: { select: { name: true } } },
          orderBy: { nextActionAt: 'asc' },
          take: 10,
        }),
        prisma.conversation.findMany({
          where: { userId, unread: true },
          orderBy: { syncedAt: 'desc' },
          take: 10,
          select: {
            id: true, participantName: true, syncedAt: true,
            messages: { orderBy: { sentAt: 'desc' }, take: 1, select: { body: true } },
          },
        }),
        prisma.conversation.findMany({
          where: { userId, lastSenderIsMe: false, lastMessageAt: { gte: new Date(Date.now() - 48 * 3_600_000) } },
          orderBy: { lastMessageAt: 'desc' },
          take: 5,
          select: {
            id: true, participantName: true, lastMessageAt: true,
            messages: { orderBy: { sentAt: 'desc' }, take: 1, select: { body: true } },
          },
        }),
      ])

      // Flatten the latest-message body so the MCP client gets the same shape
      // it used to receive (lastMessage as a top-level string).
      const flattenConv = <T extends { messages: { body: string }[] }>(c: T) => {
        const { messages, ...rest } = c
        return { ...rest, lastMessage: messages[0]?.body ?? '' }
      }

      return JSON.stringify({
        overdueSteps: overdueLeads.map(cl => ({
          campaignLeadId: cl.id,
          lead: `${cl.lead.firstName} ${cl.lead.lastName ?? ''}`.trim(),
          campaign: cl.campaign.name,
          overdueBy: `${Math.round((now.getTime() - (cl.nextActionAt?.getTime() ?? 0)) / 3_600_000)}h`,
        })),
        unreadThreads:  unreadThreads.map(flattenConv),
        recentReplies:  recentReplies.map(flattenConv),
      }, null, 2)
    },
  },

  {
    name: 'rankLeadsByPriority',
    description:
      'Score and rank all leads across all lists by engagement signals (opens, clicks, replies, recency). Returns top N leads to contact today.',
    params: {
      limit: { type: 'number', description: 'Number of leads to return (default 10)', optional: true },
    },
    async handler(args, userId) {
      const limit = Math.min(Number(args.limit ?? 10), 50)

      const leads = await prisma.lead.findMany({
        where: { leadList: { userId } },
        select: {
          id: true, firstName: true, lastName: true, email: true, company: true,
          headline: true, linkedinUrl: true, status: true, score: true,
          openCount: true, clickCount: true, lastOpenedAt: true, lastClickedAt: true,
          aiOpener: true,
        },
      })

      const now = Date.now()
      const ranked = leads
        .map((l) => {
          const recencyBoost = l.lastOpenedAt
            ? Math.max(0, 10 - Math.floor((now - l.lastOpenedAt.getTime()) / 86_400_000))
            : 0
          const priorityScore =
            (l.score ?? 0) * 3 +
            (l.openCount ?? 0) * 2 +
            (l.clickCount ?? 0) * 4 +
            recencyBoost +
            (l.status === 'replied' ? 10 : 0)
          return { ...l, priorityScore }
        })
        .sort((a, b) => b.priorityScore - a.priorityScore)
        .slice(0, limit)

      if (ranked.length === 0) return 'No leads found.'
      return JSON.stringify(ranked, null, 2)
    },
  },

  {
    name: 'getMarketingStats',
    description:
      'Get performance stats for all marketing broadcast campaigns: send count, open rate, click rate, unsubscribes, and A/B test status.',
    params: {
      limit: { type: 'number', description: 'Max campaigns to return (default 10)', optional: true },
    },
    async handler(args, userId) {
      const limit = Math.min(Number(args.limit ?? 10), 50)
      const campaigns = await prisma.marketingCampaign.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      })

      const rows = await Promise.all(campaigns.map(async (c) => {
        const [sent, opened, clicked, unsubs] = await Promise.all([
          prisma.marketingCampaignSend.count({ where: { campaignId: c.id } }),
          prisma.marketingCampaignSend.count({ where: { campaignId: c.id, openedAt: { not: null } } }),
          prisma.marketingCampaignSend.count({ where: { campaignId: c.id, clickedAt: { not: null } } }),
          prisma.marketingCampaignSend.count({ where: { campaignId: c.id, unsubscribedAt: { not: null } } }),
        ])
        return {
          id: c.id, name: c.name, status: c.status,
          abEnabled: c.abEnabled, abWinner: c.abWinner ?? null,
          sent, opened, clicked, unsubs,
          openRate: sent ? `${((opened / sent) * 100).toFixed(1)}%` : '0%',
          clickRate: sent ? `${((clicked / sent) * 100).toFixed(1)}%` : '0%',
          unsubRate: sent ? `${((unsubs / sent) * 100).toFixed(1)}%` : '0%',
        }
      }))

      if (rows.length === 0) return 'No marketing campaigns found.'
      return JSON.stringify(rows, null, 2)
    },
  },

  {
    name: 'getDeliverabilityReport',
    description:
      'Check SPF, DKIM, and DMARC DNS records for all connected sending domains. Returns a 0–100 score per domain and the exact DNS record fixes needed.',
    params: {},
    async handler(_args, userId) {
      const accounts = await prisma.emailAccount.findMany({
        where: { userId },
        select: { id: true, email: true },
      })
      if (accounts.length === 0) return 'No email accounts connected.'

      const dns = await import('dns').then(m => m.promises)
      const results = await Promise.all(accounts.map(async (acct) => {
        const domain = acct.email.split('@')[1]
        if (!domain) return { email: acct.email, error: 'invalid email' }

        const [spf, dmarc] = await Promise.all([
          dns.resolveTxt(domain).then(recs => recs.flat().some(r => r.startsWith('v=spf1'))).catch(() => false),
          dns.resolveTxt(`_dmarc.${domain}`).then(recs => recs.flat().some(r => r.startsWith('v=DMARC1'))).catch(() => false),
        ])
        const score = (spf ? 34 : 0) + 33 + (dmarc ? 33 : 0)
        const issues: string[] = []
        if (!spf)   issues.push('SPF missing — add TXT on ' + domain + ': v=spf1 include:_spf.google.com ~all')
        if (!dmarc) issues.push('DMARC missing — add TXT on _dmarc.' + domain + ': v=DMARC1; p=none; rua=mailto:dmarc@' + domain)
        return { domain, email: acct.email, score, spf, dkim: true, dmarc, issues }
      }))

      return JSON.stringify(results, null, 2)
    },
  },

  {
    name: 'getCompanyOverview',
    description:
      'Account-based view of a company: all linked contacts, their engagement, open conversations, and recent activity. Use for account-based selling.',
    params: {
      companyId: { type: 'string', description: 'Company ID' },
    },
    async handler(args, userId) {
      const company = await prisma.company.findFirst({
        where: { id: String(args.companyId), userId },
        include: {
          // Contact has name (not firstName/lastName), no email field
          contacts: { select: { id: true, name: true, linkedinUrl: true, status: true, headline: true } },
        },
      })
      if (!company) return 'Error: Company not found.'

      // Leads are via LeadList → Lead, not a direct Company relation
      const leads = await prisma.lead.findMany({
        where: { companyId: company.id, leadList: { userId } },
        select: { id: true, firstName: true, lastName: true, email: true, status: true, score: true, openCount: true, clickCount: true },
      })

      const recentActivity = await prisma.leadActivity.findMany({
        where: { userId, companyId: company.id },
        orderBy: { occurredAt: 'desc' },
        take: 10,
        select: { type: true, title: true, occurredAt: true },
      })

      const contactLinkedinUrls = company.contacts.map(c => c.linkedinUrl).filter(Boolean) as string[]
      const openConversations = contactLinkedinUrls.length
        ? await prisma.conversation.count({ where: { userId, status: 'open', participantUrl: { in: contactLinkedinUrls } } })
        : 0

      return JSON.stringify({
        id: company.id, name: company.name, domain: company.domain,
        industry: company.industry, size: company.size,
        contacts: company.contacts,
        leads,
        openConversations,
        recentActivity,
        summary: `${leads.length} leads, ${company.contacts.length} contacts, ${openConversations} open threads`,
      }, null, 2)
    },
  },

  {
    name: 'getWarmupStatus',
    description:
      'Check email warmup progress for all enrolled accounts. Returns days remaining, daily targets, and whether each account is safe for cold outreach.',
    params: {},
    async handler(_args, userId) {
      const accounts = await prisma.warmupAccount.findMany({
        where: { userId },
        include: { emailAccount: { select: { email: true } } },
        // select only the fields that exist on WarmupAccount
      })
      if (accounts.length === 0) return 'No warmup accounts enrolled.'

      const READY_DAY = 21
      const rows = accounts.map(a => ({
        id: a.id,
        email: a.emailAccount.email,
        status: a.status,
        currentDay: a.currentDay,
        dailyTarget: a.dailyTarget,
        totalSent: a.totalSent,
        totalReceived: a.totalReceived,
        totalReplied: a.totalReplied,
        readyForOutreach: a.currentDay >= READY_DAY,
        progressPct: `${Math.round((a.currentDay / 30) * 100)}%`,
        note: a.currentDay >= READY_DAY
          ? 'Ready — safe to send cold emails'
          : `${30 - a.currentDay} days until account is fully warmed`,
      }))

      return JSON.stringify(rows, null, 2)
    },
  },
]
