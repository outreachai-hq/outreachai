// Plan 8 — shared send logic for the Outreach Queue.
//
// internalApproveAndSend(draft, userId) is the single place an email or
// LinkedIn draft turns into a real send. The route handler at
// /api/drafts/[id]/approve-send wraps a tiny ownership check around this,
// and the future /api/cron/send-scheduled-drafts cron loops over due
// drafts and calls this for each.

import nodemailer from 'nodemailer'
import type { DraftMessage } from '@prisma/client'
import { prisma } from './prisma'
import { safeDecrypt } from './encryption'
import { pickSenderForCampaign } from './senderRotation'
import { Activity } from './activity'

type ApproveOptions = {
  draft:  DraftMessage
  userId: string
}

export class ApproveSendError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function pickSender(draft: DraftMessage, userId: string) {
  if (draft.campaignId) {
    const acct = await pickSenderForCampaign({ userId, campaignId: draft.campaignId })
    if (acct) return acct
  }
  return prisma.emailAccount.findFirst({ where: { userId, isDefault: true } })
}

async function resolveEmailRecipient(draft: DraftMessage, userId: string): Promise<string | null> {
  if (draft.leadId) {
    const lead = await prisma.lead.findFirst({
      where: { id: draft.leadId, leadList: { userId } },
      select: { email: true },
    })
    if (lead?.email) return lead.email
  }
  if (draft.contactId) {
    // Contact doesn't currently carry an email column; fall through.
  }
  if (draft.conversationId) {
    const c = await prisma.conversation.findFirst({
      where: { id: draft.conversationId, userId },
      select: { participantEmail: true },
    })
    if (c?.participantEmail) return c.participantEmail
  }
  return null
}

async function resolveLinkedinProfileId(draft: DraftMessage, userId: string): Promise<string | null> {
  if (draft.conversationId) {
    const c = await prisma.conversation.findFirst({
      where: { id: draft.conversationId, userId },
      select: { linkedinProfileId: true },
    })
    if (c?.linkedinProfileId) return c.linkedinProfileId
  }
  if (draft.contactId) {
    const ct = await prisma.contact.findFirst({
      where: { id: draft.contactId, userId },
      select: { profileId: true },
    })
    if (ct?.profileId) return ct.profileId
  }
  return null
}

/**
 * Promote a draft into a real send. Throws ApproveSendError on user-facing
 * problems (no recipient, no SMTP). Idempotent: races on the same draft
 * are blocked by the status guard in the route handler.
 */
export async function internalApproveAndSend(opts: ApproveOptions): Promise<{ sentMessageId: string }> {
  const { draft, userId } = opts

  if (draft.channel === 'email') {
    const to = await resolveEmailRecipient(draft, userId)
    if (!to) throw new ApproveSendError(400, 'No recipient email on draft')

    const account = await pickSender(draft, userId)
    if (!account?.smtpHost || !account.smtpUser) {
      throw new ApproveSendError(400, 'No SMTP sender configured for this user')
    }

    const msg = await prisma.emailMessage.create({
      data: {
        userId,
        emailAccountId: account.id,
        contactId: draft.contactId,
        to,
        subject: draft.subject ?? '(no subject)',
        body: draft.body,
        status: 'sent',
      },
    })

    const transport = nodemailer.createTransport({
      host: account.smtpHost,
      port: account.smtpPort ?? 587,
      secure: (account.smtpPort ?? 587) === 465,
      auth: { user: account.smtpUser, pass: safeDecrypt(account.smtpPass) ?? '' },
    })

    try {
      await transport.sendMail({
        from: `"${account.name}" <${account.email}>`,
        to,
        subject: draft.subject ?? '(no subject)',
        text: account.signature ? `${draft.body}\n\n${account.signature}` : draft.body,
      })
    } catch (err) {
      await prisma.emailMessage.delete({ where: { id: msg.id } }).catch(() => {})
      const errMsg = err instanceof Error ? err.message : String(err)
      throw new ApproveSendError(502, errMsg.slice(0, 500))
    }

    await prisma.draftMessage.update({
      where: { id: draft.id },
      data: { status: 'sent', sentAt: new Date(), approvedAt: new Date(), sentMessageId: msg.id },
    })

    if (draft.leadId) {
      Activity.emailSent({
        userId,
        leadId: draft.leadId,
        subject: draft.subject ?? undefined,
        campaignId: draft.campaignId ?? undefined,
        sequenceStepId: draft.sequenceStepId ?? undefined,
        messageId: msg.id,
      }).catch(() => {})
    }
    return { sentMessageId: msg.id }
  }

  if (draft.channel === 'linkedin') {
    const profileId = await resolveLinkedinProfileId(draft, userId)
    if (!profileId) throw new ApproveSendError(400, 'No LinkedIn profileId for this draft')

    const action = await prisma.linkedInAction.create({
      data: {
        userId,
        profileId,
        actionType: 'chat_message',
        message: draft.body,
        leadId: draft.leadId,
        campaignId: draft.campaignId,
        status: 'pending',
      },
    })

    await prisma.draftMessage.update({
      where: { id: draft.id },
      data: { status: 'sent', sentAt: new Date(), approvedAt: new Date(), sentMessageId: action.id },
    })

    if (draft.leadId) {
      Activity.linkedInQueued({
        userId, leadId: draft.leadId, actionType: 'chat_message',
        campaignId: draft.campaignId ?? undefined,
        sequenceStepId: draft.sequenceStepId ?? undefined,
      }).catch(() => {})
    }
    return { sentMessageId: action.id }
  }

  throw new ApproveSendError(400, `Channel "${draft.channel}" not yet supported for approve-send`)
}
