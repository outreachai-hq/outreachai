// Plan 1 — Sequence runner extracted from lib/mcp/tools/execution.ts
//
// `runPendingStepsForUser` walks all pending CampaignLead rows whose
// `nextActionAt <= now` and either sends the next step inline (email) or
// queues a LinkedInAction for the Chrome extension to execute.
//
// Both the MCP tool (`batchRunPendingSteps`) and the Vercel cron route
// (`/api/cron/run-sequence-steps`) call into this single helper, so behaviour
// stays in sync.

import nodemailer from 'nodemailer'
import { prisma } from './prisma'
import { safeDecrypt } from './encryption'
import { isWithinSendWindow, parseSendWindow, isWithinSchedule, type ScheduleShape } from './timezone'
import { pickSenderForCampaign } from './senderRotation'
import { sendViaAccount, isSESPermanentBounce, isSendGridPermanentBounce } from './email/transport'
import { Activity } from './activity'
import { runWorkflowsForEvent } from './workflowEngine'

type ABVariant = {
  id: string
  label: string
  subject: string
  message: string
  weight: number
}

type SequenceStep = {
  id?: string
  type: 'visit_profile' | 'connection_request' | 'chat_message' | 'email' | 'wait' | 'wait_until_accepted' | 'condition' | 'whatsapp_message'
  waitDays?: number
  message?: string
  subject?: string
  emailAccountId?: string | null
  linkedinAccountId?: string | null
  markAsManual?: boolean
  // A/B testing
  abEnabled?: boolean
  variants?: ABVariant[]
  // Plan 6 — condition-step fields
  on?: 'opened' | 'clicked' | 'replied' | 'bounced' | 'accepted_invite' | 'custom'
  windowDays?: number
  ifTrueStepId?: string
  ifFalseStepId?: string
}

// Plan 6 — evaluate a condition step against the lead's recent history.
async function evaluateCondition(
  step: SequenceStep,
  cl: { leadId: string; campaignId: string; campaign: { userId: string } },
): Promise<boolean> {
  const sinceMs = Date.now() - (step.windowDays ?? 7) * 86_400_000
  const since   = new Date(sinceMs)
  const userId  = cl.campaign.userId

  switch (step.on) {
    case 'opened': {
      const lead = await prisma.lead.findUnique({
        where: { id: cl.leadId },
        select: { lastOpenedAt: true },
      })
      return !!lead?.lastOpenedAt && lead.lastOpenedAt >= since
    }
    case 'clicked': {
      const lead = await prisma.lead.findUnique({
        where: { id: cl.leadId },
        select: { lastClickedAt: true },
      })
      return !!lead?.lastClickedAt && lead.lastClickedAt >= since
    }
    case 'replied': {
      const replies = await prisma.emailMessage.count({
        where: { userId, status: 'replied', repliedAt: { gte: since } },
      })
      return replies > 0
    }
    case 'bounced': {
      const bounces = await prisma.emailMessage.count({
        where: { userId, status: 'bounced', sentAt: { gte: since } },
      })
      return bounces > 0
    }
    // 'accepted_invite' and 'custom' fall back to false in v1 — UI can't
    // create them yet, runner won't loop because falsy steps still
    // advance to the false branch.
    default:
      return false
  }
}

export type RunResult = {
  emailsSent: number
  linkedInQueued: number
  tasksCreated: number
  skipped: number
  bounced: number
  failed: number
  errors: string[]
  /**
   * Set when the per-user time budget was hit before all pending leads were
   * processed. The unprocessed leads stay status='pending' and will be picked
   * up on the next cron tick.
   */
  deferred?: number
}

const LINKEDIN_STEPS = new Set(['visit_profile', 'connection_request', 'chat_message'])

// Maximum SMTP attempts per lead per step before we give up and mark `failed`.
export const MAX_ATTEMPTS = 5

// Backoff schedule (in minutes) for transient SMTP failures.
// Attempt 1 -> wait 15m, 2 -> 1h, 3 -> 4h, 4 -> 12h, 5 -> 24h before re-marking failed.
const BACKOFF_MINUTES = [15, 60, 240, 720, 1440]

/**
 * Classify a thrown SMTP error as a permanent bounce or transient retryable.
 * Permanent = 5xx response codes (e.g. 550 "no such user"). Anything else
 * (4xx, network errors, timeouts) is treated as retryable.
 */
export function isPermanentBounce(err: unknown): boolean {
  // nodemailer attaches responseCode on protocol errors
  const code = (err as { responseCode?: number })?.responseCode
  if (typeof code === 'number') return code >= 500 && code < 600
  return false
}

export function applyVars(text: string, vars: Record<string, string>): string {
  // Step 1 — evaluate {{if [not] field}}...{{else}}...{{end}} blocks
  let result = text.replace(
    /\{\{\s*if\s+(not\s+)?(\w+)\s*\}\}([\s\S]*?)\{\{\s*end\s*\}\}/gi,
    (_, notFlag: string | undefined, field: string, inner: string) => {
      const value = vars[field.toLowerCase()] ?? vars[field] ?? ''
      const truthy = value.trim().length > 0
      const conditionMet = notFlag ? !truthy : truthy

      // Split on {{else}} if present
      const elseMatch = inner.match(/^([\s\S]*?)\{\{\s*else\s*\}\}([\s\S]*)$/i)
      if (elseMatch) {
        return conditionMet ? elseMatch[1] : elseMatch[2]
      }
      return conditionMet ? inner : ''
    }
  )

  // Step 2 — simple variable substitutions (existing behaviour)
  result = result
    .replace(/\{\{firstName\}\}/gi, vars.firstName ?? '')
    .replace(/\{\{lastName\}\}/gi,  vars.lastName  ?? '')
    .replace(/\{\{company\}\}/gi,   vars.company   ?? '')
    .replace(/\{\{headline\}\}/gi,  vars.headline  ?? '')
    .replace(/\{\{aiOpener\}\}/gi,  vars.aiOpener  ?? '')

  return result
}

// Strip HTML tags and decode basic entities — used before sending plain-text
// channels (LinkedIn, WhatsApp) when message was authored in the rich editor.
export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<li>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function buildHtml(text: string, trackingId: string, signature: string | null): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const pixel = appUrl
    ? `<img src="${appUrl}/api/email/track/open?id=${trackingId}" width="1" height="1" style="display:none" alt="" />`
    : ''
  const unsubLink = appUrl
    ? `<p style="margin-top:24px;font-size:11px;color:#9ca3af;text-align:center"><a href="${appUrl}/api/email/unsubscribe?id=${trackingId}" style="color:#9ca3af">Unsubscribe</a></p>`
    : ''

  const isHtml = /<[a-z][\s\S]*>/i.test(text)

  let body: string
  if (isHtml) {
    // Message authored in rich editor — use HTML as-is, rewrite bare URLs and
    // existing <a href> links to go through the click-tracking proxy.
    const sigHtml = signature ? `<p style="margin-top:16px">${signature.replace(/\n/g, '<br>')}</p>` : ''
    const withSig = `${text}${sigHtml}`
    body = withSig
      // Rewrite existing <a href="..."> links
      .replace(/<a\s+href="(https?:\/\/[^"]+)"/gi, (_, url) =>
        `<a href="${appUrl}/api/email/track/click?id=${trackingId}&url=${encodeURIComponent(url)}"`)
      // Rewrite bare URLs not already inside an href
      .replace(/(?<!href=")(?<![">])(https?:\/\/[^\s<>"]+)/g, (url) =>
        `<a href="${appUrl}/api/email/track/click?id=${trackingId}&url=${encodeURIComponent(url)}">${url}</a>`)
  } else {
    // Legacy plain-text message — escape and convert newlines to <br>
    const fullText = signature ? `${text}\n\n${signature}` : text
    const escaped = fullText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    body = escaped
      .replace(/(https?:\/\/[^\s<>"]+)/g, (url) =>
        `<a href="${appUrl}/api/email/track/click?id=${trackingId}&url=${encodeURIComponent(url)}">${url}</a>`)
      .replace(/\n/g, '<br>\n')
  }

  return `<!DOCTYPE html><html><body style="font-family:sans-serif;font-size:14px;line-height:1.6">${body}${pixel}${unsubLink}</body></html>`
}

function emptyResult(): RunResult {
  return {
    emailsSent: 0, linkedInQueued: 0, tasksCreated: 0,
    skipped: 0, bounced: 0, failed: 0, errors: [],
  }
}

async function checkAndAutoStopRepliedLeads(
  userId: string,
  leads: Array<{ id: string; leadId: string; campaignId: string; lead: { email: string | null } }>,
): Promise<Set<string>> {
  const stoppedIds = new Set<string>()
  for (const cl of leads) {
    if (!cl.lead.email) continue
    const hasReply = await prisma.conversation.findFirst({
      where: {
        userId,
        participantEmail: cl.lead.email,
        messages: { some: { direction: 'in' } },
      },
      select: { id: true },
    })
    const emailReplied = hasReply ? null : await prisma.emailMessage.findFirst({
      where: { userId, to: cl.lead.email, status: 'replied' },
      select: { id: true },
    })
    if (hasReply || emailReplied) {
      await prisma.campaignLead.update({
        where: { id: cl.id },
        data: { status: 'replied', autoStopped: true, stoppedReason: 'reply', nextActionAt: null },
      })
      stoppedIds.add(cl.id)
      Activity.statusChanged({
        userId, leadId: cl.leadId,
        from: 'pending', to: 'replied',
      }).catch(() => {})
      runWorkflowsForEvent('lead.replied', userId, {
        leadId: cl.leadId, campaignId: cl.campaignId,
      }).catch(() => {})
    }
  }
  return stoppedIds
}

/**
 * Process one CampaignLead through its current step. Mutates the lead's
 * `currentStep` / `nextActionAt` on success. Returns a delta to add to the
 * caller's `RunResult`.
 *
 * Exported so individual leads can be advanced from MCP/admin tools too.
 */
export async function runStepForCampaignLead(
  cl: {
    id: string
    leadId: string
    campaignId: string
    currentStep: number
    attempts?: number
    lead: {
      firstName: string
      lastName: string | null
      email: string | null
      company: string | null
      headline: string | null
      linkedinUrl: string | null
      aiOpener: string | null
      phone: string | null
      id: string
    }
    campaign: {
      id: string
      userId: string
      timezone: string
      sendWindow: unknown
      scheduleId?: string | null
      schedule?: ScheduleShape | null
      sequence: { steps: unknown }
    }
  }
): Promise<Partial<RunResult>> {
  const steps = (cl.campaign.sequence.steps ?? []) as SequenceStep[]

  // Plan 6 — look up the current step by id when present (supports branching
  // via condition steps). Legacy leads have currentStepId=null and fall back
  // to the index-based lookup so in-flight campaigns keep working untouched.
  const clAny = cl as unknown as { currentStepId?: string | null }
  const step = clAny.currentStepId
    ? (steps.find((s) => s.id === clAny.currentStepId) ?? steps[cl.currentStep])
    : steps[cl.currentStep]
  if (!step) return { skipped: 1 }

  // Plan 6 — CONDITION STEP. Evaluate `on` and jump to the right branch
  // immediately (no SMTP send / no LinkedIn queue). Resolves to either
  // ifTrueStepId or ifFalseStepId; if those ids aren't found in steps[],
  // we end the sequence to avoid infinite loops.
  if (step.type === 'condition') {
    const passed = await evaluateCondition(step, cl)
    const targetId = passed ? step.ifTrueStepId : step.ifFalseStepId
    const targetStep = steps.find((s) => s.id === targetId)
    const targetIndex = targetStep ? steps.indexOf(targetStep) : -1
    await prisma.campaignLead.update({
      where: { id: cl.id },
      data: {
        currentStep:   targetIndex >= 0 ? targetIndex : steps.length,
        currentStepId: targetId ?? null,
        status:        targetStep ? 'pending' : 'completed',
        nextActionAt:  targetStep
          ? new Date(Date.now() + (targetStep.waitDays ?? 0) * 86_400_000)
          : null,
        attempts: 0,
        lastError: null,
      },
    })
    return { skipped: 1 }
  }

  const userId = cl.campaign.userId
  const nextStep = steps[cl.currentStep + 1]
  // Advance also resets the retry counter for the next step.
  const advanceData = {
    currentStep: cl.currentStep + 1,
    currentStepId: nextStep?.id ?? null,
    status: nextStep ? 'pending' : 'completed',
    nextActionAt: nextStep
      ? new Date(Date.now() + (nextStep.waitDays ?? 1) * 86_400_000)
      : null,
    attempts: 0,
    lastError: null,
  } as const

  // ── EMAIL STEP ──────────────────────────────────────────────────────────────
  if (step.type === 'email') {
    // Plan 7 — prefer the linked Schedule when set; fall back to the legacy
    // timezone + sendWindow pair so unmodified campaigns keep working.
    const within = cl.campaign.schedule
      ? isWithinSchedule(cl.campaign.schedule)
      : (() => {
          const [winStart, winEnd] = parseSendWindow(cl.campaign.sendWindow)
          return isWithinSendWindow(cl.campaign.timezone, winStart, winEnd)
        })()
    if (!within) return { skipped: 1 }

    const vars = {
      firstName: cl.lead.firstName,
      lastName: cl.lead.lastName ?? '',
      company: cl.lead.company ?? '',
      headline: cl.lead.headline ?? '',
      aiOpener: cl.lead.aiOpener ?? '',
    }

    // A/B variant selection — stable split using leadId charCode
    let abVariant: string | undefined
    let subject = applyVars(step.subject ?? '(no subject)', vars)
    let bodyText = applyVars(step.message ?? '', vars)

    if (step.abEnabled && Array.isArray(step.variants) && step.variants.length >= 2) {
      const idx = cl.leadId.charCodeAt(0) % step.variants.length
      const variant = step.variants[idx]
      subject = applyVars(variant.subject ?? step.subject ?? '(no subject)', vars)
      bodyText = applyVars(variant.message ?? step.message ?? '', vars)
      abVariant = variant.id
    }

    // If marked manual, create a Task and advance — no auto-send.
    if (step.markAsManual) {
      const task = await prisma.task.create({
        data: {
          userId,
          leadId: cl.leadId,
          campaignId: cl.campaignId,
          type: 'email',
          title: subject,
          notes: bodyText,
        },
      })
      await prisma.campaignLead.update({ where: { id: cl.id }, data: advanceData })
      Activity.taskCreated({
        userId, leadId: cl.leadId, campaignId: cl.campaignId,
        taskId: task.id, title: subject, type: 'email',
      }).catch(() => {})
      return { tasksCreated: 1 }
    }

    if (!cl.lead.email) {
      return { errors: [`Lead ${cl.id}: no email address`] }
    }

    // Check global unsubscribe list
    if (cl.lead.email) {
      const unsub = await prisma.unsubscribe.findFirst({
        where: { email: cl.lead.email, userId },
        select: { id: true },
      })
      if (unsub) {
        await prisma.campaignLead.update({
          where: { id: cl.id },
          data: { status: 'completed', autoStopped: true, stoppedReason: 'unsubscribe', nextActionAt: null },
        })
        return { skipped: 1 }
      }
    }

    // Sender rotation
    const account = await pickSenderForCampaign({
      userId,
      campaignId: cl.campaignId,
      stepEmailAccountId: step.emailAccountId,
    })
    if (!account) {
      return { skipped: 1, errors: [`Lead ${cl.id}: no eligible sender (over daily limit?)`] }
    }

    const msg = await prisma.emailMessage.create({
      data: {
        userId,
        emailAccountId: account.id,
        to: cl.lead.email,
        subject,
        body: bodyText,
        status: 'sent',
      },
    })

    try {
      await sendViaAccount(account, {
        to: cl.lead.email,
        subject,
        text: account.signature ? `${bodyText}\n\n${account.signature}` : bodyText,
        html: buildHtml(bodyText, msg.trackingId, account.signature),
      })
    } catch (err) {
      await prisma.emailMessage.delete({ where: { id: msg.id } }).catch(() => {})
      const errMsg = err instanceof Error ? err.message : String(err)

      // Permanent bounce (SMTP 5xx, SES MessageRejected, SendGrid 400/422) -> mark bounced, never retry.
      if (isPermanentBounce(err) || isSESPermanentBounce(err) || isSendGridPermanentBounce(err)) {
        await prisma.campaignLead.update({
          where: { id: cl.id },
          data: {
            status: 'bounced',
            nextActionAt: null,
            lastError: errMsg.slice(0, 500),
            lastAttemptAt: new Date(),
          },
        })
        // Auto-suppress: add bounced address to unsubscribe list so future
        // campaigns and sequences skip it without manual intervention.
        if (cl.lead.email) {
          await prisma.unsubscribe.upsert({
            where: { email_userId: { email: cl.lead.email, userId } },
            update: {},
            create: { email: cl.lead.email, userId },
          }).catch(() => {})
        }
        Activity.emailBounced({ userId, leadId: cl.leadId, reason: errMsg.slice(0, 200) }).catch(() => {})
        return { bounced: 1, errors: [`Lead ${cl.id}: bounced - ${errMsg}`] }
      }

      // Transient (4xx, network, timeout) -> increment attempts; if we've hit
      // the cap, mark `failed`; otherwise re-queue with backoff.
      const nextAttempts = (cl.attempts ?? 0) + 1
      if (nextAttempts >= MAX_ATTEMPTS) {
        await prisma.campaignLead.update({
          where: { id: cl.id },
          data: {
            status: 'failed',
            nextActionAt: null,
            attempts: nextAttempts,
            lastError: errMsg.slice(0, 500),
            lastAttemptAt: new Date(),
          },
        })
        Activity.emailFailed({ userId, leadId: cl.leadId, reason: errMsg.slice(0, 200), attempts: nextAttempts }).catch(() => {})
        return { failed: 1, errors: [`Lead ${cl.id}: failed after ${MAX_ATTEMPTS} attempts - ${errMsg}`] }
      }

      const backoffMin = BACKOFF_MINUTES[nextAttempts - 1] ?? 60
      await prisma.campaignLead.update({
        where: { id: cl.id },
        data: {
          // status stays 'pending' so the cron picks it up after backoff
          attempts: nextAttempts,
          lastError: errMsg.slice(0, 500),
          lastAttemptAt: new Date(),
          nextActionAt: new Date(Date.now() + backoffMin * 60_000),
        },
      })
      return {
        errors: [`Lead ${cl.id}: attempt ${nextAttempts}/${MAX_ATTEMPTS} - ${errMsg} (retry in ${backoffMin}m)`],
      }
    }

    await prisma.campaignLead.update({ where: { id: cl.id }, data: advanceData })
    Activity.emailSent({
      userId, leadId: cl.leadId, subject,
      campaignId: cl.campaignId, sequenceStepId: step.id ?? undefined,
      messageId: msg.id,
      abVariant,
    }).catch(() => {})
    return { emailsSent: 1 }
  }

  // ── LINKEDIN STEPS ──────────────────────────────────────────────────────────
  if (LINKEDIN_STEPS.has(step.type)) {
    if (!cl.lead.linkedinUrl) return { skipped: 1 }

    const profileId = cl.lead.linkedinUrl.replace(/\/$/, '').split('/').pop() ?? cl.leadId

    await prisma.linkedInAction.create({
      data: {
        userId,
        campaignLeadId: cl.id,
        campaignId: cl.campaignId,
        leadId: cl.leadId,
        profileId,
        profileUrl: cl.lead.linkedinUrl,
        actionType: step.type,
        message: step.message
          ? stripHtml(applyVars(step.message, {
              firstName: cl.lead.firstName,
              lastName: cl.lead.lastName ?? '',
              company: cl.lead.company ?? '',
              headline: cl.lead.headline ?? '',
              aiOpener: cl.lead.aiOpener ?? '',
            }))
          : null,
      },
    })

    // Mark in_progress until extension confirms; don't advance currentStep yet.
    await prisma.campaignLead.update({ where: { id: cl.id }, data: { status: 'in_progress' } })
    Activity.linkedInQueued({
      userId, leadId: cl.leadId,
      actionType: step.type as 'visit_profile' | 'connection_request' | 'chat_message',
      campaignId: cl.campaignId, sequenceStepId: step.id ?? undefined,
    }).catch(() => {})
    return { linkedInQueued: 1 }
  }

  // ── WHATSAPP STEP ───────────────────────────────────────────────────────────
  // Sends via mfapis-v2 when the user has configured WA credentials.
  // Falls back to a manual Task when not configured.
  // Skips (advances) if the lead has no phone number.
  if (step.type === 'whatsapp_message') {
    if (!cl.lead.phone) {
      await prisma.campaignLead.update({ where: { id: cl.id }, data: advanceData })
      return { skipped: 1 }
    }
    const vars = {
      firstName: cl.lead.firstName,
      lastName: cl.lead.lastName ?? '',
      company: cl.lead.company ?? '',
      headline: cl.lead.headline ?? '',
      aiOpener: cl.lead.aiOpener ?? '',
    }
    const body = stripHtml(applyVars(step.message ?? '', vars))

    // Load user WA settings
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { waApiKey: true, waPhone: true, waBaseUrl: true },
    })
    const waApiKey  = user?.waApiKey  ? (safeDecrypt(user.waApiKey)  ?? null) : null
    const waPhone   = user?.waPhone   ?? null
    const waBaseUrl = user?.waBaseUrl ?? null

    if (waApiKey && waPhone && waBaseUrl) {
      // WhatsApp JID format: strip non-digits then append @s.whatsapp.net
      const chatId = `${cl.lead.phone.replace(/\D/g, '')}@s.whatsapp.net`
      const res = await fetch(`${waBaseUrl}/api/v2/wa/message/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${waApiKey}`,
          'x-phone': waPhone,
        },
        body: JSON.stringify({ chat_id: chatId, message: body }),
      })
      if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText)
        return { errors: [`WhatsApp send failed for lead ${cl.id}: ${errText.slice(0, 200)}`] }
      }
      await prisma.campaignLead.update({ where: { id: cl.id }, data: advanceData })
      Activity.whatsappSent({ userId, leadId: cl.leadId, campaignId: cl.campaignId, phone: cl.lead.phone }).catch(() => {})
      return { tasksCreated: 1 } // reuse tasksCreated counter for whatsapp sends
    }

    // Fallback: create a manual Task
    const task = await prisma.task.create({
      data: {
        userId,
        leadId: cl.leadId,
        campaignId: cl.campaignId,
        type: 'whatsapp',
        title: `WhatsApp ${cl.lead.firstName} · ${cl.lead.phone}`,
        notes: body,
      },
    })
    await prisma.campaignLead.update({ where: { id: cl.id }, data: advanceData })
    Activity.taskCreated({
      userId, leadId: cl.leadId, campaignId: cl.campaignId,
      taskId: task.id, title: task.title, type: 'whatsapp',
    }).catch(() => {})
    return { tasksCreated: 1 }
  }

  // ── WAIT / WAIT_UNTIL_ACCEPTED ──────────────────────────────────────────────
  if (step.type === 'wait' || step.type === 'wait_until_accepted') {
    await prisma.campaignLead.update({ where: { id: cl.id }, data: advanceData })
    return { skipped: 1 }
  }

  return { skipped: 1 }
}

function merge(into: RunResult, delta: Partial<RunResult>) {
  if (delta.emailsSent) into.emailsSent += delta.emailsSent
  if (delta.linkedInQueued) into.linkedInQueued += delta.linkedInQueued
  if (delta.tasksCreated) into.tasksCreated += delta.tasksCreated
  if (delta.skipped) into.skipped += delta.skipped
  if (delta.bounced) into.bounced += delta.bounced
  if (delta.failed) into.failed += delta.failed
  if (delta.errors) into.errors.push(...delta.errors)
}

/**
 * Run pending sequence steps for every active campaign of a single user.
 *
 * `limit` caps the number of CampaignLead rows fetched per invocation. The
 * Vercel cron has a 60s function timeout (Hobby) — on a slow SMTP day one
 * user with many email steps could starve every other user. To protect that,
 * the runner also honours a soft `maxRuntimeMs` budget and stops iterating
 * leads once it elapses; unprocessed leads stay pending and the next cron
 * tick picks them up. Default budget = 30s.
 */
export async function runPendingStepsForUser(
  userId: string,
  limit = 50,
  opts: { maxRuntimeMs?: number } = {}
): Promise<RunResult> {
  const budget = opts.maxRuntimeMs ?? 30_000
  const startedAt = Date.now()

  const now = new Date()
  const pending = await prisma.campaignLead.findMany({
    where: {
      status: 'pending',
      nextActionAt: { lte: now },
      campaign: { userId, status: 'active' },
    },
    include: {
      lead: true,
      campaign: { include: { sequence: true, schedule: true } },
    },
    orderBy: { nextActionAt: 'asc' },
    take: Math.max(1, Math.min(limit, 200)),
  })

  const autoStoppedIds = await checkAndAutoStopRepliedLeads(userId, pending).catch(() => new Set<string>())
  const toProcess = pending.filter((p) => !autoStoppedIds.has(p.id))

  const result = emptyResult()
  for (let i = 0; i < toProcess.length; i++) {
    if (Date.now() - startedAt > budget) {
      result.deferred = toProcess.length - i
      break
    }
    const cl = toProcess[i]
    try {
      const delta = await runStepForCampaignLead(cl)
      merge(result, delta)
    } catch (err) {
      result.errors.push(`Lead ${cl.id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  return result
}
