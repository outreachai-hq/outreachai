// Plan 2 (Iter 11+12) — Conversation/Message dual-write helpers.
//
// LinkedIn path: called from the extension's /api/inbox/sync POST.
// Email path:   called from /api/email/poll-replies when IMAP finds a reply.
//
// Best-effort: callers must wrap the calls in try/catch so a failure here
// never breaks the legacy inbox/email sync paths.

import { prisma } from './prisma'

/**
 * Normalize an email subject into a comparable thread key fragment.
 * Strips leading "Re:" / "Fwd:" (any case, repeated), trims, lowercases.
 */
export function normalizeSubject(subject: string | null | undefined): string {
  let s = (subject ?? '').trim()
  while (/^(re|fwd?):\s*/i.test(s)) s = s.replace(/^(re|fwd?):\s*/i, '').trim()
  return s.toLowerCase()
}

/**
 * Stable thread key for an email conversation:
 *   "<participant-email-lowercase>::<normalized-subject>"
 * Same key for outbound (to=participant) and inbound (from=participant).
 */
export function emailThreadKey(participantEmail: string, subject: string | null | undefined): string {
  return `${participantEmail.toLowerCase()}::${normalizeSubject(subject)}`
}

export type LinkedInThreadSnapshot = {
  profileId: string
  participantName: string
  participantUrl?: string | null
  avatarUrl?: string | null
  lastMessage: string
  lastSenderIsMe: boolean
  unread: boolean
}

export async function upsertLinkedInConversation(
  userId: string,
  snap: LinkedInThreadSnapshot,
  now: Date = new Date()
): Promise<void> {
  const conv = await prisma.conversation.upsert({
    where: {
      userId_channel_linkedinProfileId: {
        userId,
        channel: 'linkedin',
        linkedinProfileId: snap.profileId,
      },
    },
    update: {
      participantName: snap.participantName,
      participantUrl: snap.participantUrl ?? null,
      avatarUrl: snap.avatarUrl ?? null,
      lastSenderIsMe: snap.lastSenderIsMe,
      unread: snap.unread,
      lastMessageAt: now,
      syncedAt: now,
    },
    create: {
      userId,
      channel: 'linkedin',
      linkedinProfileId: snap.profileId,
      participantName: snap.participantName,
      participantUrl: snap.participantUrl ?? null,
      avatarUrl: snap.avatarUrl ?? null,
      lastSenderIsMe: snap.lastSenderIsMe,
      unread: snap.unread,
      lastMessageAt: now,
      syncedAt: now,
    },
    select: { id: true },
  })

  // Only append a Message when the snapshot actually moves the conversation
  // forward. The extension polls every ~60s; without this guard we'd accrue
  // a duplicate row per poll for unchanged threads.
  const direction: 'in' | 'out' = snap.lastSenderIsMe ? 'out' : 'in'
  const latest = await prisma.message.findFirst({
    where: { conversationId: conv.id },
    orderBy: { sentAt: 'desc' },
    select: { body: true, direction: true },
  })
  if (latest && latest.body === snap.lastMessage && latest.direction === direction) return

  await prisma.message.create({
    data: {
      conversationId: conv.id,
      direction,
      body: snap.lastMessage,
      sentAt: now,
    },
  })
}

/**
 * Batch helper. Iterates threads sequentially so one bad row doesn't
 * poison the whole batch; failures are logged and swallowed.
 */
export async function dualWriteLinkedInThreads(
  userId: string,
  threads: LinkedInThreadSnapshot[],
  now: Date = new Date()
): Promise<{ written: number; errors: number }> {
  let written = 0
  let errors = 0
  for (const t of threads) {
    try {
      await upsertLinkedInConversation(userId, t, now)
      written++
    } catch (err) {
      errors++
      console.error('[conversationSync] upsert failed', t.profileId, err)
    }
  }
  return { written, errors }
}

// ─── Email path ───────────────────────────────────────────────────────────────

export type EmailInboundSnapshot = {
  fromEmail: string
  subject: string | null
  receivedAt: Date
  body?: string                 // optional snippet (full body when the poller can fetch it)
  externalId?: string | null    // IMAP uid / Message-ID header when available
  contactId?: string | null
}

/**
 * Upsert the matching email Conversation and append the inbound Message.
 *
 * Used by /api/email/poll-replies. Returns the conversation id for callers
 * that want to chain further updates (e.g. emit an activity row).
 */
export async function recordInboundEmailReply(
  userId: string,
  snap: EmailInboundSnapshot
): Promise<{ conversationId: string }> {
  const fromLower = snap.fromEmail.toLowerCase()
  const threadKey = emailThreadKey(fromLower, snap.subject)
  const conv = await prisma.conversation.upsert({
    where: {
      userId_channel_emailThreadKey: {
        userId,
        channel: 'email',
        emailThreadKey: threadKey,
      },
    },
    update: {
      lastMessageAt: snap.receivedAt,
      lastSenderIsMe: false,
      unread: true,
      syncedAt: new Date(),
      ...(snap.contactId ? { contactId: snap.contactId } : {}),
    },
    create: {
      userId,
      channel: 'email',
      emailThreadKey: threadKey,
      subject: snap.subject,
      participantEmail: fromLower,
      participantName: snap.fromEmail.split('@')[0] ?? snap.fromEmail,
      lastMessageAt: snap.receivedAt,
      lastSenderIsMe: false,
      unread: true,
      syncedAt: new Date(),
      contactId: snap.contactId ?? null,
    },
    select: { id: true },
  })

  // Skip duplicate messages: if a Message with this externalId already
  // exists, don't append again. (Important — pollers re-scan the inbox
  // every few minutes.)
  if (snap.externalId) {
    const dup = await prisma.message.findFirst({
      where: { conversationId: conv.id, externalId: snap.externalId },
      select: { id: true },
    })
    if (dup) return { conversationId: conv.id }
  }

  await prisma.message.create({
    data: {
      conversationId: conv.id,
      direction: 'in',
      body: snap.body ?? '(reply received — body not yet fetched)',
      externalId: snap.externalId ?? null,
      sentAt: snap.receivedAt,
    },
  })

  return { conversationId: conv.id }
}
