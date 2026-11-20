// Plan 4 — LeadActivity emitter.
//
// Single entry point for every code path that wants to log a per-lead event.
// Callers should ALWAYS wrap the emit in `.catch(() => {})` so a write
// failure here can never break the surrounding business action (sending an
// email, marking a task done, etc.). The preset helpers at the bottom keep
// call sites tight.

import type { Prisma } from '@prisma/client'
import { prisma } from './prisma'

// ─── Activity type catalog ────────────────────────────────────────────────────
//
// Add a new value here when you add a new emit site. Keeping the catalog
// in one place lets the UI render appropriate icons + helps grep-ability.

export const ACTIVITY_TYPES = {
  EMAIL_SENT:                'email.sent',
  EMAIL_OPENED:              'email.opened',
  EMAIL_CLICKED:             'email.clicked',
  EMAIL_REPLIED:             'email.replied',
  EMAIL_BOUNCED:             'email.bounced',
  EMAIL_FAILED:              'email.failed',
  LINKEDIN_VISIT_QUEUED:     'linkedin.visit_queued',
  LINKEDIN_INVITE_QUEUED:    'linkedin.invite_queued',
  LINKEDIN_MESSAGE_QUEUED:   'linkedin.message_queued',
  LINKEDIN_VISIT_DONE:       'linkedin.visit_done',
  LINKEDIN_INVITE_SENT:      'linkedin.invite_sent',
  LINKEDIN_MESSAGE_SENT:     'linkedin.message_sent',
  LINKEDIN_MESSAGE_RECEIVED: 'linkedin.message_received',
  WHATSAPP_SENT:             'whatsapp.sent',
  WHATSAPP_REPLIED:          'whatsapp.replied',
  TASK_CREATED:              'task.created',
  TASK_COMPLETED:            'task.completed',
  NOTE_ADDED:                'note.added',
  STATUS_CHANGED:            'status.changed',
  ENRICHMENT_COMPLETED:      'enrichment.completed',
  SIGNAL_FIRED:              'signal.fired',
  SEQUENCE_AUTO_STOPPED:     'sequence.auto_stopped',
} as const

export type ActivityType = (typeof ACTIVITY_TYPES)[keyof typeof ACTIVITY_TYPES]

// ─── Core emit ────────────────────────────────────────────────────────────────

type EmitOpts = {
  userId: string
  type: ActivityType | string
  channel?: string | null
  source?: string | null
  leadId?: string | null
  contactId?: string | null
  companyId?: string | null
  campaignId?: string | null
  sequenceStepId?: string | null
  conversationId?: string | null
  messageId?: string | null
  taskId?: string | null
  title: string
  body?: string | null
  payload?: unknown
  actorUserId?: string | null
  occurredAt?: Date
}

/**
 * Insert a LeadActivity row. Auto-resolves `companyId` from `leadId` /
 * `contactId` when not provided, so rollups work without callers having
 * to thread the companyId through every emit site.
 */
export async function emitActivity(opts: EmitOpts) {
  let companyId = opts.companyId ?? null

  if (!companyId && opts.leadId) {
    const l = await prisma.lead.findUnique({ where: { id: opts.leadId }, select: { companyId: true } }).catch(() => null)
    companyId = l?.companyId ?? null
  }
  if (!companyId && opts.contactId) {
    const c = await prisma.contact.findUnique({ where: { id: opts.contactId }, select: { companyId: true } }).catch(() => null)
    companyId = c?.companyId ?? null
  }

  return prisma.leadActivity.create({
    data: {
      userId: opts.userId,
      type: opts.type,
      channel: opts.channel ?? null,
      source: opts.source ?? null,
      leadId: opts.leadId ?? null,
      contactId: opts.contactId ?? null,
      companyId,
      campaignId: opts.campaignId ?? null,
      sequenceStepId: opts.sequenceStepId ?? null,
      conversationId: opts.conversationId ?? null,
      messageId: opts.messageId ?? null,
      taskId: opts.taskId ?? null,
      title: opts.title,
      body: opts.body ?? null,
      payload: (opts.payload as Prisma.InputJsonValue) ?? undefined,
      actorUserId: opts.actorUserId ?? null,
      occurredAt: opts.occurredAt ?? new Date(),
    },
  })
}

// ─── Preset helpers — keep call sites short + consistent ─────────────────────

export const Activity = {
  emailSent: (o: { userId: string; leadId: string; subject?: string; campaignId?: string; sequenceStepId?: string; messageId?: string; abVariant?: string }) =>
    emitActivity({
      userId: o.userId, leadId: o.leadId, campaignId: o.campaignId,
      sequenceStepId: o.sequenceStepId, messageId: o.messageId,
      type: ACTIVITY_TYPES.EMAIL_SENT, channel: 'email', source: 'campaign',
      title: o.subject ? `Sent email: "${truncate(o.subject, 60)}"` : 'Sent email',
      payload: o.abVariant ? { abVariant: o.abVariant } : undefined,
    }),

  emailOpened: (o: { userId: string; leadId: string; messageId?: string; campaignId?: string; sequenceStepId?: string }) =>
    emitActivity({
      userId: o.userId, leadId: o.leadId, messageId: o.messageId,
      campaignId: o.campaignId ?? null,
      sequenceStepId: o.sequenceStepId ?? null,
      type: ACTIVITY_TYPES.EMAIL_OPENED, channel: 'email', source: 'system',
      title: 'Opened email',
    }),

  emailClicked: (o: { userId: string; leadId: string; url?: string; messageId?: string; campaignId?: string; sequenceStepId?: string }) =>
    emitActivity({
      userId: o.userId, leadId: o.leadId, messageId: o.messageId,
      campaignId: o.campaignId ?? null,
      sequenceStepId: o.sequenceStepId ?? null,
      type: ACTIVITY_TYPES.EMAIL_CLICKED, channel: 'email', source: 'system',
      title: o.url ? `Clicked link: ${truncate(o.url, 60)}` : 'Clicked a link',
      payload: o.url ? { url: o.url } : undefined,
    }),

  emailReplied: (o: { userId: string; leadId?: string; contactId?: string; conversationId?: string; messageId?: string }) =>
    emitActivity({
      userId: o.userId, leadId: o.leadId, contactId: o.contactId,
      conversationId: o.conversationId, messageId: o.messageId,
      type: ACTIVITY_TYPES.EMAIL_REPLIED, channel: 'email', source: 'system',
      title: 'Replied to email',
    }),

  emailBounced: (o: { userId: string; leadId: string; reason?: string }) =>
    emitActivity({
      userId: o.userId, leadId: o.leadId,
      type: ACTIVITY_TYPES.EMAIL_BOUNCED, channel: 'email', source: 'system',
      title: 'Email bounced', body: o.reason ?? null,
    }),

  emailFailed: (o: { userId: string; leadId: string; reason?: string; attempts?: number }) =>
    emitActivity({
      userId: o.userId, leadId: o.leadId,
      type: ACTIVITY_TYPES.EMAIL_FAILED, channel: 'email', source: 'system',
      title: o.attempts ? `Email failed after ${o.attempts} attempts` : 'Email failed',
      body: o.reason ?? null,
    }),

  linkedInQueued: (o: { userId: string; leadId: string; actionType: 'visit_profile' | 'connection_request' | 'chat_message'; campaignId?: string; sequenceStepId?: string }) => {
    const map = {
      visit_profile:       ACTIVITY_TYPES.LINKEDIN_VISIT_QUEUED,
      connection_request:  ACTIVITY_TYPES.LINKEDIN_INVITE_QUEUED,
      chat_message:        ACTIVITY_TYPES.LINKEDIN_MESSAGE_QUEUED,
    } as const
    const labels = {
      visit_profile:       'Queued LinkedIn profile visit',
      connection_request:  'Queued LinkedIn invitation',
      chat_message:        'Queued LinkedIn message',
    } as const
    return emitActivity({
      userId: o.userId, leadId: o.leadId, campaignId: o.campaignId, sequenceStepId: o.sequenceStepId,
      type: map[o.actionType], channel: 'linkedin', source: 'campaign',
      title: labels[o.actionType],
    })
  },

  linkedInDone: (o: { userId: string; leadId?: string; actionType: string; campaignId?: string }) => {
    const map: Record<string, ActivityType> = {
      visit_profile:       ACTIVITY_TYPES.LINKEDIN_VISIT_DONE,
      connection_request:  ACTIVITY_TYPES.LINKEDIN_INVITE_SENT,
      chat_message:        ACTIVITY_TYPES.LINKEDIN_MESSAGE_SENT,
    }
    const labels: Record<string, string> = {
      visit_profile:       'Visited LinkedIn profile',
      connection_request:  'Sent LinkedIn invitation',
      chat_message:        'Sent LinkedIn message',
    }
    return emitActivity({
      userId: o.userId, leadId: o.leadId ?? null, campaignId: o.campaignId,
      type: map[o.actionType] ?? `linkedin.${o.actionType}`,
      channel: 'linkedin', source: 'extension',
      title: labels[o.actionType] ?? `Completed ${o.actionType}`,
    })
  },

  linkedInMessageReceived: (o: { userId: string; conversationId?: string; messageId?: string; from?: string }) =>
    emitActivity({
      userId: o.userId, conversationId: o.conversationId, messageId: o.messageId,
      type: ACTIVITY_TYPES.LINKEDIN_MESSAGE_RECEIVED, channel: 'linkedin', source: 'extension',
      title: o.from ? `Received LinkedIn message from ${o.from}` : 'Received LinkedIn message',
    }),

  whatsappSent: (o: { userId: string; leadId: string; campaignId?: string; phone: string }) =>
    emitActivity({
      userId: o.userId, leadId: o.leadId, campaignId: o.campaignId,
      type: ACTIVITY_TYPES.WHATSAPP_SENT, channel: 'whatsapp', source: 'campaign',
      title: `Sent WhatsApp to ${o.phone}`,
    }),

  whatsappReplied: (o: { userId: string; leadId: string; campaignId?: string; phone: string }) =>
    emitActivity({
      userId: o.userId, leadId: o.leadId, campaignId: o.campaignId,
      type: ACTIVITY_TYPES.WHATSAPP_REPLIED, channel: 'whatsapp', source: 'inbound',
      title: `WhatsApp reply received from ${o.phone}`,
    }),

  taskCreated: (o: { userId: string; leadId?: string; campaignId?: string; taskId: string; title: string; type?: string }) =>
    emitActivity({
      userId: o.userId, leadId: o.leadId, campaignId: o.campaignId, taskId: o.taskId,
      type: ACTIVITY_TYPES.TASK_CREATED, channel: o.type ?? null, source: 'campaign',
      title: `Created task: "${truncate(o.title, 60)}"`,
    }),

  taskCompleted: (o: { userId: string; leadId?: string; taskId: string; title?: string; actorUserId?: string }) =>
    emitActivity({
      userId: o.userId, leadId: o.leadId, taskId: o.taskId, actorUserId: o.actorUserId,
      type: ACTIVITY_TYPES.TASK_COMPLETED, source: 'manual',
      title: o.title ? `Completed task: "${truncate(o.title, 60)}"` : 'Completed task',
    }),

  noteAdded: (o: { userId: string; leadId?: string; contactId?: string; body: string; actorUserId: string }) =>
    emitActivity({
      userId: o.userId, leadId: o.leadId, contactId: o.contactId, actorUserId: o.actorUserId,
      type: ACTIVITY_TYPES.NOTE_ADDED, source: 'manual',
      title: 'Note added', body: o.body,
    }),

  statusChanged: (o: { userId: string; leadId?: string; contactId?: string; from?: string | null; to: string; actorUserId?: string }) =>
    emitActivity({
      userId: o.userId, leadId: o.leadId, contactId: o.contactId, actorUserId: o.actorUserId,
      type: ACTIVITY_TYPES.STATUS_CHANGED, source: 'system',
      title: o.from ? `Status changed: ${o.from} → ${o.to}` : `Status set to ${o.to}`,
      payload: { from: o.from ?? null, to: o.to },
    }),

  enrichmentCompleted: (o: { userId: string; leadId: string; provider?: string }) =>
    emitActivity({
      userId: o.userId, leadId: o.leadId,
      type: ACTIVITY_TYPES.ENRICHMENT_COMPLETED, source: 'agent',
      title: o.provider ? `Enriched lead via ${o.provider}` : 'Enriched lead',
    }),
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s
}
