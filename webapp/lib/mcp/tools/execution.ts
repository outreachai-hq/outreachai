import { prisma } from '@/lib/prisma'
import { generateText } from '@/lib/ai'
import { runPendingStepsForUser, runStepForCampaignLead, applyVars } from '@/lib/sequenceRunner'
import type { McpTool } from '../types'

// ── helpers ───────────────────────────────────────────────────────────────────
// `applyVars` and the email-send pipeline now live in lib/sequenceRunner.ts so
// the MCP tools, the Vercel cron, and any future surface stay in sync.

type SequenceStep = {
  id: string
  type: 'visit_profile' | 'connection_request' | 'chat_message' | 'email' | 'wait' | 'wait_until_accepted'
  waitDays: number
  message?: string
  subject?: string
}

// ── tools ─────────────────────────────────────────────────────────────────────

export const executionTools: McpTool[] = [
  {
    name: 'getPendingSteps',
    description:
      'Get campaign leads where nextActionAt <= now and status=pending. Returns leads ready for the next sequence step to be executed.',
    params: {
      limit: { type: 'number', description: 'Max results to return (default 20)', optional: true },
    },
    async handler(args, userId) {
      const limit = Math.min(Number(args.limit ?? 20), 100)
      const now = new Date()

      const pending = await prisma.campaignLead.findMany({
        where: {
          status: 'pending',
          nextActionAt: { lte: now },
          campaign: { userId, status: 'active' },
        },
        include: {
          lead: { select: { id: true, firstName: true, lastName: true, email: true, company: true, headline: true, linkedinUrl: true, aiOpener: true } },
          campaign: { select: { id: true, name: true, sequenceId: true, timezone: true, sendWindow: true } },
        },
        orderBy: { nextActionAt: 'asc' },
        take: limit,
      })

      if (pending.length === 0) return 'No pending steps found.'

      const rows = await Promise.all(
        pending.map(async (cl) => {
          const seq = await prisma.sequence.findUnique({ where: { id: cl.campaign.sequenceId } })
          const steps = (seq?.steps ?? []) as SequenceStep[]
          const step = steps[cl.currentStep]
          return {
            campaignLeadId: cl.id,
            campaignId: cl.campaignId,
            campaignName: cl.campaign.name,
            leadId: cl.leadId,
            leadName: `${cl.lead.firstName} ${cl.lead.lastName ?? ''}`.trim(),
            leadEmail: cl.lead.email,
            stepIndex: cl.currentStep,
            stepType: step?.type ?? 'unknown',
            overdueSince: cl.nextActionAt?.toISOString(),
          }
        })
      )

      return JSON.stringify(rows, null, 2)
    },
  },

  {
    name: 'executeEmailStep',
    description:
      'Execute an email sequence step for a campaign lead: sends the email via SMTP, records tracking, advances the lead to the next step. Only works for steps of type "email".',
    params: {
      campaignLeadId: { type: 'string', description: 'CampaignLead ID to execute' },
    },
    async handler(args, userId) {
      const cl = await prisma.campaignLead.findFirst({
        where: { id: String(args.campaignLeadId), campaign: { userId } },
        include: { lead: true, campaign: { include: { sequence: true } } },
      })
      if (!cl) return 'Error: CampaignLead not found.'
      if (cl.status !== 'pending') return `Error: Lead status is "${cl.status}", expected "pending".`

      const steps = (cl.campaign.sequence.steps ?? []) as SequenceStep[]
      const step = steps[cl.currentStep]
      if (!step) return 'Error: No step at currentStep index — sequence may be complete.'
      if (step.type !== 'email') {
        return `Error: Step type is "${step.type}", not "email". Use queueLinkedInStep for LinkedIn steps.`
      }

      const delta = await runStepForCampaignLead(cl)
      if (delta.errors?.length) return `Error: ${delta.errors[0]}`
      if (delta.skipped) return 'Skipped: outside send window, no email on lead, or no eligible sender (over daily limit).'
      if (delta.tasksCreated) return JSON.stringify({ markedAsManualTask: true })
      if (!delta.emailsSent) return 'Error: nothing happened.'

      const nextStep = steps[cl.currentStep + 1]
      return JSON.stringify({
        sent: true,
        to: cl.lead.email,
        nextStep: nextStep ? { index: cl.currentStep + 1, type: nextStep.type } : null,
        status: nextStep ? 'pending' : 'completed',
      })
    },
  },

  {
    name: 'queueLinkedInStep',
    description:
      'Queue a LinkedIn action (visit_profile, connection_request, or chat_message) into the LinkedInAction table. The Chrome extension picks it up on the next LinkedIn page visit.',
    params: {
      campaignLeadId: { type: 'string', description: 'CampaignLead ID to queue a LinkedIn action for' },
    },
    async handler(args, userId) {
      const cl = await prisma.campaignLead.findFirst({
        where: { id: String(args.campaignLeadId), campaign: { userId } },
        include: {
          lead: true,
          campaign: { include: { sequence: true } },
        },
      })
      if (!cl) return 'Error: CampaignLead not found.'
      if (!cl.lead.linkedinUrl) return 'Error: Lead has no LinkedIn URL — cannot queue LinkedIn action.'

      const steps = (cl.campaign.sequence.steps ?? []) as SequenceStep[]
      const step = steps[cl.currentStep]
      if (!step) return 'Error: No step at currentStep index.'

      const linkedInTypes = ['visit_profile', 'connection_request', 'chat_message']
      if (!linkedInTypes.includes(step.type)) {
        return `Error: Step type is "${step.type}", not a LinkedIn action. Use executeEmailStep instead.`
      }

      // Extract profileId from LinkedIn URL (last path segment)
      const profileId = cl.lead.linkedinUrl.replace(/\/$/, '').split('/').pop() ?? cl.lead.id

      const action = await prisma.linkedInAction.create({
        data: {
          userId,
          campaignLeadId: cl.id,
          campaignId: cl.campaignId,
          leadId: cl.leadId,
          profileId,
          profileUrl: cl.lead.linkedinUrl,
          actionType: step.type,
          message: step.message ? applyVars(step.message, {
            firstName: cl.lead.firstName,
            lastName: cl.lead.lastName ?? '',
            company: cl.lead.company ?? '',
            headline: cl.lead.headline ?? '',
            aiOpener: cl.lead.aiOpener ?? '',
          }) : null,
        },
      })

      // Mark lead as in_progress until extension confirms
      await prisma.campaignLead.update({
        where: { id: cl.id },
        data: { status: 'in_progress' },
      })

      return JSON.stringify({
        queued: true,
        actionId: action.id,
        actionType: step.type,
        profileUrl: cl.lead.linkedinUrl,
        message: action.message,
        note: 'Extension will pick this up on the next LinkedIn page visit.',
      })
    },
  },

  {
    name: 'classifyReply',
    description:
      'Classify an inbound reply conversation using Claude Haiku. Returns: positive | negative | meeting_booked | ooo | neutral, with a suggested action.',
    params: {
      threadId: { type: 'string', description: 'Conversation ID to classify (param name kept as "threadId" for backwards compat)' },
    },
    async handler(args, userId) {
      const conv = await prisma.conversation.findFirst({
        where: { id: String(args.threadId), userId },
        include: { messages: { orderBy: { sentAt: 'desc' }, take: 1, select: { body: true } } },
      })
      if (!conv) return 'Error: Conversation not found.'

      const lastMessage = conv.messages[0]?.body ?? '(no messages yet)'
      const channelLabel = conv.channel === 'email' ? 'email reply' : 'LinkedIn reply'
      const prompt = `Classify this ${channelLabel}. Reply with JSON only — no prose.

Participant: ${conv.participantName}
Last message: "${lastMessage}"

Return: { "classification": "positive"|"negative"|"meeting_booked"|"ooo"|"neutral", "confidence": 0-1, "suggestedAction": "one sentence" }`

      try {
        const text = await generateText(prompt, { maxTokens: 150, userId })
        return text || 'Error: empty response'
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  },

  {
    name: 'pauseLeadOnReply',
    description:
      'Stop the sequence for a campaign lead because they replied. Sets status=replied so no further steps execute.',
    params: {
      campaignLeadId: { type: 'string', description: 'CampaignLead ID to pause' },
    },
    async handler(args, userId) {
      const cl = await prisma.campaignLead.findFirst({
        where: { id: String(args.campaignLeadId), campaign: { userId } },
      })
      if (!cl) return 'Error: CampaignLead not found.'

      await prisma.campaignLead.update({
        where: { id: cl.id },
        data: { status: 'replied', nextActionAt: null },
      })

      return JSON.stringify({ paused: true, campaignLeadId: cl.id, status: 'replied' })
    },
  },

  {
    name: 'enrichLead',
    description:
      'Generate a personalized AI opener for a single lead using Claude Haiku. Uses LinkedIn about section and recent post if available.',
    params: {
      leadId: { type: 'string', description: 'Lead ID to enrich' },
    },
    async handler(args, userId) {
      const lead = await prisma.lead.findFirst({
        where: { id: String(args.leadId), leadList: { userId } },
      })
      if (!lead) return 'Error: Lead not found.'
      if (lead.aiOpener) return JSON.stringify({ skipped: true, reason: 'Already enriched', aiOpener: lead.aiOpener })

      const seniority = (() => {
        const h = (lead.headline || '').toLowerCase()
        if (/\b(ceo|cto|coo|cfo|chief|founder|co-founder|owner|president)\b/.test(h)) return 'C-Suite / Founder'
        if (/\b(vp|vice president|head of|director)\b/.test(h)) return 'VP / Director'
        if (/\b(senior|lead|principal|staff|manager)\b/.test(h)) return 'Senior / Manager'
        return 'Mid-level'
      })()

      const hasRichContext = lead.aboutSection || lead.recentPost
      const prompt = hasRichContext
        ? `Write a 1-2 sentence personalized LinkedIn opener for ${lead.firstName}${lead.company ? ` at ${lead.company}` : ''}${lead.headline ? `, ${lead.headline}` : ''} (${seniority}).${lead.aboutSection ? `\nAbout: "${lead.aboutSection.slice(0, 400)}"` : ''}${lead.recentPost ? `\nRecent post: "${lead.recentPost.slice(0, 300)}"` : ''}\nRules: reference specifics, never use "I came across your profile", don't start with "I", max 2 sentences. Output ONLY the opener.`
        : `Write a 1-2 sentence personalized LinkedIn opener for ${lead.firstName}${lead.company ? ` at ${lead.company}` : ''}${lead.headline ? ` (${lead.headline})` : ''}. Conversational, not salesy, max 2 sentences. Output ONLY the opener.`

      let opener: string
      try {
        opener = await generateText(prompt, { maxTokens: 200, userId })
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`
      }
      if (!opener) return 'Error: empty response from AI'

      await prisma.lead.update({ where: { id: lead.id }, data: { aiOpener: opener } })
      return JSON.stringify({ enriched: true, leadId: lead.id, aiOpener: opener })
    },
  },

  {
    name: 'batchRunPendingSteps',
    description:
      'Orchestrator tool: fetches all pending campaign leads, executes email steps directly, and queues LinkedIn steps for the extension. Returns a summary. Run this from an external or Pro scheduler for sub-daily automation.',
    params: {
      limit: { type: 'number', description: 'Max leads to process per run (default 50)', optional: true },
    },
    async handler(args, userId) {
      const limit = Math.min(Number(args.limit ?? 50), 200)
      const result = await runPendingStepsForUser(userId, limit)
      return JSON.stringify(result)
    },
  },

  {
    name: 'recalculateLeadScores',
    description:
      'Backfill hot-lead scores (0–100) for all leads that have engagement data but score=0. Safe to run any time. Returns count of leads updated.',
    params: {},
    async handler(_args, userId) {
      const { updateLeadScore } = await import('@/lib/leadScore')

      const leads = await prisma.lead.findMany({
        where: {
          leadList: { userId },
          OR: [{ openCount: { gt: 0 } }, { clickCount: { gt: 0 } }, { status: 'replied' }],
        },
        select: { id: true },
      })

      await Promise.all(leads.map(l => updateLeadScore(l.id).catch(() => {})))
      return JSON.stringify({ updated: leads.length, message: `Recalculated scores for ${leads.length} leads.` })
    },
  },

  {
    name: 'searchAndEnrich',
    description:
      'Search Apollo (falling back to Hunter on quota) for leads matching a job title at a domain or company. Returns up to 20 leads with emails ready to import.',
    params: {
      title:   { type: 'string', description: 'Job title to search (e.g. "VP of Engineering")' },
      domain:  { type: 'string', description: 'Company domain (e.g. "phonepe.com")', optional: true },
      company: { type: 'string', description: 'Company name (e.g. "PhonePe")', optional: true },
      limit:   { type: 'number', description: 'Max results (default 10, max 20)', optional: true },
    },
    async handler(args, userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { apolloApiKey: true, hunterApiKey: true },
      })
      if (!user?.apolloApiKey && !user?.hunterApiKey) {
        return 'Error: No enrichment API keys configured. Add Apollo or Hunter keys in Settings → Enrichment API Keys.'
      }

      const { safeDecrypt } = await import('@/lib/encryption')
      const enrichment = await import('@/lib/enrichment')
      const apolloKey = user.apolloApiKey ? safeDecrypt(user.apolloApiKey) : null
      const hunterKey = user.hunterApiKey ? safeDecrypt(user.hunterApiKey) : null
      const limit = Math.min(Number(args.limit ?? 10), 20)

      let results: unknown[] = []
      try {
        if (apolloKey) {
          results = await enrichment.searchApollo(apolloKey, {
            title: String(args.title),
            domain: args.domain ? String(args.domain) : undefined,
            company: args.company ? String(args.company) : undefined,
            limit,
          })
        }
      } catch (e) {
        if (!(e instanceof enrichment.QuotaError)) throw e
      }

      if (results.length === 0 && hunterKey && args.domain) {
        const raw = await enrichment.searchHunterDomain(hunterKey, String(args.domain)).catch(() => [] as unknown[])
        const titleFilter = String(args.title).toLowerCase()
        results = (raw as { title?: string }[])
          .filter(r => (r.title ?? '').toLowerCase().includes(titleFilter))
          .slice(0, limit)
      }

      if (results.length === 0) return 'No leads found matching those criteria.'
      return JSON.stringify({ count: results.length, leads: results }, null, 2)
    },
  },
]
