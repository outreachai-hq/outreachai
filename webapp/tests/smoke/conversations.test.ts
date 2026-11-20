import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock nodemailer + encryption before importing the messages route
vi.mock('nodemailer', () => {
  const sendMail = vi.fn().mockResolvedValue({ messageId: 'mock-mid' })
  return {
    default: { createTransport: vi.fn().mockReturnValue({ sendMail }) },
    createTransport: vi.fn().mockReturnValue({ sendMail }),
  }
})

vi.mock('@/lib/encryption', () => ({
  safeDecrypt: vi.fn((s: string | null) => (s ? `decrypted:${s}` : null)),
  encrypt: vi.fn((s: string) => `enc:${s}`),
}))

import nodemailer from 'nodemailer'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { GET as listConversations } from '@/app/api/conversations/route'
import { GET as getConversation, PATCH as patchConversation, DELETE as deleteConversation } from '@/app/api/conversations/[id]/route'
import { POST as postReply } from '@/app/api/conversations/[id]/messages/route'

const USER = 'user_test_123'

function listReq(qs = '') {
  return new NextRequest(`http://localhost:3000/api/conversations${qs ? `?${qs}` : ''}`, { method: 'GET' })
}
function getReq() {
  return new NextRequest('http://localhost:3000/api/conversations/conv_1', { method: 'GET' })
}
function patchReq(body: object) {
  return new NextRequest('http://localhost:3000/api/conversations/conv_1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
function postReplyReq(body: object) {
  return new NextRequest('http://localhost:3000/api/conversations/conv_1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const ctx1 = { params: Promise.resolve({ id: 'conv_1' }) }

const mockSession = {
  user: { id: USER, email: 'me@example.com', name: 'Me' },
} as any

function emailConv(over: Partial<{ id: string; subject: string | null; participantEmail: string | null }> = {}) {
  return {
    id: over.id ?? 'conv_1',
    userId: USER,
    channel: 'email',
    subject: over.subject ?? 'Quick intro',
    participantEmail: over.participantEmail ?? 'jane@example.com',
    participantName: 'Jane',
    participantUrl: null,
    avatarUrl: null,
    linkedinProfileId: null,
    emailThreadKey: 'jane@example.com::quick intro',
    smsPhone: null,
    contactId: null,
    leadId: null,
    campaignId: null,
    status: 'open',
    unread: false,
    labels: [],
    lastMessageAt: new Date(),
    lastSenderIsMe: true,
    syncedAt: new Date(),
    createdAt: new Date(),
  }
}

function linkedInConv(over: Partial<{ id: string; linkedinProfileId: string }> = {}) {
  return {
    ...emailConv(),
    channel: 'linkedin',
    subject: null,
    participantEmail: null,
    participantUrl: 'https://linkedin.com/in/jane',
    linkedinProfileId: over.linkedinProfileId ?? 'jane',
    emailThreadKey: null,
  }
}

// ─── GET /api/conversations ──────────────────────────────────────────────────

describe('GET /api/conversations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue(mockSession)
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as any)
    const res = await listConversations(listReq())
    expect(res.status).toBe(401)
  })

  it('returns conversations list with default status filter (open)', async () => {
    vi.mocked(prisma.conversation.findMany).mockResolvedValueOnce([emailConv() as any, linkedInConv() as any] as any)
    const res = await listConversations(listReq())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.conversations).toHaveLength(2)

    const findManyCall = vi.mocked(prisma.conversation.findMany).mock.calls[0]?.[0] as any
    expect(findManyCall.where.userId).toBe(USER)
    expect(findManyCall.where.status).toBe('open')
    expect(findManyCall.where.channel).toBeUndefined()
  })

  it('filters by channel when provided', async () => {
    vi.mocked(prisma.conversation.findMany).mockResolvedValueOnce([] as any)
    await listConversations(listReq('channel=email'))
    const call = vi.mocked(prisma.conversation.findMany).mock.calls[0]?.[0] as any
    expect(call.where.channel).toBe('email')
  })

  it('filters by label and search q', async () => {
    vi.mocked(prisma.conversation.findMany).mockResolvedValueOnce([] as any)
    await listConversations(listReq('label=interested&q=jane'))
    const call = vi.mocked(prisma.conversation.findMany).mock.calls[0]?.[0] as any
    expect(call.where.labels).toEqual({ has: 'interested' })
    expect(call.where.OR).toHaveLength(3) // participantName, participantEmail, subject
  })

  it('honours status=all to skip the status filter', async () => {
    vi.mocked(prisma.conversation.findMany).mockResolvedValueOnce([] as any)
    await listConversations(listReq('status=all'))
    const call = vi.mocked(prisma.conversation.findMany).mock.calls[0]?.[0] as any
    expect(call.where.status).toBeUndefined()
  })

  it('caps the limit at 500', async () => {
    vi.mocked(prisma.conversation.findMany).mockResolvedValueOnce([] as any)
    await listConversations(listReq('limit=9999'))
    const call = vi.mocked(prisma.conversation.findMany).mock.calls[0]?.[0] as any
    expect(call.take).toBe(500)
  })
})

// ─── GET /api/conversations/[id] ─────────────────────────────────────────────

describe('GET /api/conversations/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue(mockSession)
  })

  it('returns the conversation + messages ordered ascending', async () => {
    const conv = { ...emailConv(), messages: [{ id: 'm1' }, { id: 'm2' }] }
    vi.mocked(prisma.conversation.findFirst).mockResolvedValueOnce(conv as any)
    const res = await getConversation(getReq(), ctx1)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.conversation.id).toBe('conv_1')
    expect(json.conversation.messages).toHaveLength(2)

    const call = vi.mocked(prisma.conversation.findFirst).mock.calls[0]?.[0] as any
    expect(call.include.messages.orderBy.sentAt).toBe('asc')
  })

  it('404s when not found OR belongs to another user', async () => {
    vi.mocked(prisma.conversation.findFirst).mockResolvedValueOnce(null)
    const res = await getConversation(getReq(), ctx1)
    expect(res.status).toBe(404)
  })
})

// ─── PATCH /api/conversations/[id] ───────────────────────────────────────────

describe('PATCH /api/conversations/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue(mockSession)
  })

  it('rejects unknown status values', async () => {
    vi.mocked(prisma.conversation.findFirst).mockResolvedValueOnce({ id: 'conv_1', labels: [] } as any)
    const res = await patchConversation(patchReq({ status: 'wat' }), ctx1)
    expect(res.status).toBe(400)
  })

  it('accepts status=done', async () => {
    vi.mocked(prisma.conversation.findFirst).mockResolvedValueOnce({ id: 'conv_1', labels: [] } as any)
    vi.mocked(prisma.conversation.update).mockResolvedValueOnce({ id: 'conv_1', status: 'done' } as any)
    const res = await patchConversation(patchReq({ status: 'done' }), ctx1)
    expect(res.status).toBe(200)
    const call = vi.mocked(prisma.conversation.update).mock.calls[0]?.[0] as any
    expect(call.data.status).toBe('done')
  })

  it('replaces labels with a full array when provided', async () => {
    vi.mocked(prisma.conversation.findFirst).mockResolvedValueOnce({ id: 'conv_1', labels: ['old'] } as any)
    vi.mocked(prisma.conversation.update).mockResolvedValueOnce({ id: 'conv_1' } as any)
    await patchConversation(patchReq({ labels: ['interested', 'favorite'] }), ctx1)
    const call = vi.mocked(prisma.conversation.update).mock.calls[0]?.[0] as any
    expect(call.data.labels).toEqual(['interested', 'favorite'])
  })

  it('adds a label without dropping existing ones via addLabel', async () => {
    vi.mocked(prisma.conversation.findFirst).mockResolvedValueOnce({ id: 'conv_1', labels: ['favorite'] } as any)
    vi.mocked(prisma.conversation.update).mockResolvedValueOnce({ id: 'conv_1' } as any)
    await patchConversation(patchReq({ addLabel: 'interested' }), ctx1)
    const call = vi.mocked(prisma.conversation.update).mock.calls[0]?.[0] as any
    expect(call.data.labels.sort()).toEqual(['favorite', 'interested'])
  })

  it('removes a label via removeLabel', async () => {
    vi.mocked(prisma.conversation.findFirst).mockResolvedValueOnce({ id: 'conv_1', labels: ['favorite', 'interested'] } as any)
    vi.mocked(prisma.conversation.update).mockResolvedValueOnce({ id: 'conv_1' } as any)
    await patchConversation(patchReq({ removeLabel: 'favorite' }), ctx1)
    const call = vi.mocked(prisma.conversation.update).mock.calls[0]?.[0] as any
    expect(call.data.labels).toEqual(['interested'])
  })

  it('toggles unread flag', async () => {
    vi.mocked(prisma.conversation.findFirst).mockResolvedValueOnce({ id: 'conv_1', labels: [] } as any)
    vi.mocked(prisma.conversation.update).mockResolvedValueOnce({ id: 'conv_1' } as any)
    await patchConversation(patchReq({ unread: true }), ctx1)
    const call = vi.mocked(prisma.conversation.update).mock.calls[0]?.[0] as any
    expect(call.data.unread).toBe(true)
  })

  it('404s when conversation does not belong to user', async () => {
    vi.mocked(prisma.conversation.findFirst).mockResolvedValueOnce(null)
    const res = await patchConversation(patchReq({ status: 'done' }), ctx1)
    expect(res.status).toBe(404)
  })
})

// ─── DELETE /api/conversations/[id] (archive) ────────────────────────────────

describe('DELETE /api/conversations/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue(mockSession)
  })

  it('soft-deletes by setting status=archived', async () => {
    vi.mocked(prisma.conversation.findFirst).mockResolvedValueOnce({ id: 'conv_1' } as any)
    vi.mocked(prisma.conversation.update).mockResolvedValueOnce({ id: 'conv_1' } as any)
    const res = await deleteConversation(new NextRequest('http://x/api/conversations/conv_1', { method: 'DELETE' }), ctx1)
    expect(res.status).toBe(200)
    const call = vi.mocked(prisma.conversation.update).mock.calls[0]?.[0] as any
    expect(call.data.status).toBe('archived')
  })
})

// ─── POST /api/conversations/[id]/messages (reply) ───────────────────────────

describe('POST /api/conversations/[id]/messages — email path', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue(mockSession)
  })

  it('400 when body is empty', async () => {
    vi.mocked(prisma.conversation.findFirst).mockResolvedValueOnce(emailConv() as any)
    const res = await postReply(postReplyReq({ body: '   ' }), ctx1)
    expect(res.status).toBe(400)
  })

  it('400 when conversation has no recipient email', async () => {
    vi.mocked(prisma.conversation.findFirst).mockResolvedValueOnce(emailConv({ participantEmail: null }) as any)
    const res = await postReply(postReplyReq({ body: 'Hello' }), ctx1)
    expect(res.status).toBe(400)
  })

  it('400 when user has no default SMTP mailbox', async () => {
    vi.mocked(prisma.conversation.findFirst).mockResolvedValueOnce(emailConv() as any)
    vi.mocked(prisma.emailAccount.findFirst).mockResolvedValueOnce(null)
    const res = await postReply(postReplyReq({ body: 'Hello' }), ctx1)
    expect(res.status).toBe(400)
  })

  it('happy path: sends via SMTP, appends outbound Message, updates conversation', async () => {
    vi.mocked(prisma.conversation.findFirst).mockResolvedValueOnce(emailConv() as any)
    vi.mocked(prisma.emailAccount.findFirst).mockResolvedValueOnce({
      id: 'acc', name: 'Me', email: 'me@x.com',
      smtpHost: 'smtp.x', smtpPort: 587, smtpUser: 'me@x.com', smtpPass: 'enc:p',
    } as any)
    vi.mocked(prisma.emailMessage.create).mockResolvedValueOnce({ id: 'msg', trackingId: 'tr' } as any)
    vi.mocked(prisma.message.create).mockResolvedValueOnce({ id: 'm1' } as any)

    const res = await postReply(postReplyReq({ body: 'Thanks!' }), ctx1)
    expect(res.status).toBe(201)

    // Subject is "Re: <stripped>"
    const sendArgs = (nodemailer.createTransport as any).mock.results.pop().value.sendMail.mock.calls.pop()[0]
    expect(sendArgs.subject).toMatch(/^Re: Quick intro/)
    expect(sendArgs.text).toBe('Thanks!')

    const msgCall = vi.mocked(prisma.message.create).mock.calls[0]?.[0] as any
    expect(msgCall.data.direction).toBe('out')
    expect(msgCall.data.body).toBe('Thanks!')
    expect(msgCall.data.externalId).toBe('tr')

    const updateCall = vi.mocked(prisma.conversation.update).mock.calls[0]?.[0] as any
    expect(updateCall.data.lastSenderIsMe).toBe(true)
    expect(updateCall.data.unread).toBe(false)
  })

  it('rolls back the EmailMessage when SMTP fails', async () => {
    vi.mocked(prisma.conversation.findFirst).mockResolvedValueOnce(emailConv() as any)
    vi.mocked(prisma.emailAccount.findFirst).mockResolvedValueOnce({
      id: 'acc', name: 'Me', email: 'me@x.com', smtpHost: 'smtp.x', smtpPort: 587, smtpUser: 'me@x.com', smtpPass: 'enc:p',
    } as any)
    vi.mocked(prisma.emailMessage.create).mockResolvedValueOnce({ id: 'msg_x', trackingId: 'tr_x' } as any)
    vi.mocked(prisma.emailMessage.delete).mockResolvedValueOnce({} as any)
    ;(nodemailer.createTransport as any).mockReturnValueOnce({
      sendMail: vi.fn().mockRejectedValue(new Error('smtp down')),
    })

    const res = await postReply(postReplyReq({ body: 'Hi' }), ctx1)
    expect(res.status).toBe(502)
    expect(vi.mocked(prisma.emailMessage.delete)).toHaveBeenCalledWith({ where: { id: 'msg_x' } })
    expect(vi.mocked(prisma.message.create)).not.toHaveBeenCalled()
  })
})

describe('POST /api/conversations/[id]/messages — LinkedIn path', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue(mockSession)
  })

  it('queues a LinkedInAction + appends outbound Message', async () => {
    vi.mocked(prisma.conversation.findFirst).mockResolvedValueOnce(linkedInConv() as any)
    vi.mocked(prisma.linkedInAction.create).mockResolvedValueOnce({ id: 'act_1' } as any)
    vi.mocked(prisma.message.create).mockResolvedValueOnce({ id: 'm1' } as any)

    const res = await postReply(postReplyReq({ body: 'Hey there' }), ctx1)
    expect(res.status).toBe(201)

    const actCall = vi.mocked(prisma.linkedInAction.create).mock.calls[0]?.[0] as any
    expect(actCall.data.actionType).toBe('chat_message')
    expect(actCall.data.message).toBe('Hey there')
    expect(actCall.data.profileId).toBe('jane')

    const msgCall = vi.mocked(prisma.message.create).mock.calls[0]?.[0] as any
    expect(msgCall.data.externalId).toBe('act_1')
  })

  it('400 when LinkedIn convo has no profile id', async () => {
    const conv = { ...linkedInConv(), linkedinProfileId: null }
    vi.mocked(prisma.conversation.findFirst).mockResolvedValueOnce(conv as any)
    const res = await postReply(postReplyReq({ body: 'Hi' }), ctx1)
    expect(res.status).toBe(400)
  })
})

describe('POST /api/conversations/[id]/messages — sms (not implemented)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue(mockSession)
  })

  it('returns 501 for unsupported channels', async () => {
    vi.mocked(prisma.conversation.findFirst).mockResolvedValueOnce({
      ...emailConv(), channel: 'sms', smsPhone: '+15551234567',
    } as any)
    const res = await postReply(postReplyReq({ body: 'Hi' }), ctx1)
    expect(res.status).toBe(501)
  })
})

// ─── recordInboundEmailReply (helper) ────────────────────────────────────────

import { recordInboundEmailReply, normalizeSubject, emailThreadKey } from '@/lib/conversationSync'

describe('normalizeSubject', () => {
  it('strips Re: / Fwd: prefixes (any case, repeated) and lowercases', () => {
    expect(normalizeSubject('Re: Hello')).toBe('hello')
    expect(normalizeSubject('RE: Hello')).toBe('hello')
    expect(normalizeSubject('FWD: Re: Hello')).toBe('hello')
    expect(normalizeSubject('Fw: HELLO')).toBe('hello')
    expect(normalizeSubject('Re: Re: Hello')).toBe('hello')
  })

  it('returns empty for null/empty input', () => {
    expect(normalizeSubject(null)).toBe('')
    expect(normalizeSubject(undefined)).toBe('')
    expect(normalizeSubject('')).toBe('')
  })
})

describe('emailThreadKey', () => {
  it('produces a stable lowercase key', () => {
    expect(emailThreadKey('Jane@Example.com', 'Hello')).toBe('jane@example.com::hello')
  })

  it('matches between an outbound and its inbound reply (Re:)', () => {
    expect(emailThreadKey('jane@x.com', 'Hello')).toBe(emailThreadKey('jane@x.com', 'Re: Hello'))
  })
})

describe('recordInboundEmailReply', () => {
  beforeEach(() => vi.clearAllMocks())

  it('upserts Conversation + creates inbound Message', async () => {
    vi.mocked(prisma.conversation.upsert).mockResolvedValueOnce({ id: 'conv_1' } as any)
    vi.mocked(prisma.message.findFirst).mockResolvedValueOnce(null)
    vi.mocked(prisma.message.create).mockResolvedValueOnce({} as any)

    const r = await recordInboundEmailReply(USER, {
      fromEmail: 'jane@example.com',
      subject: 'Re: Quick intro',
      receivedAt: new Date('2026-06-23T12:00:00Z'),
      externalId: '<msg-id-1@x>',
    })
    expect(r.conversationId).toBe('conv_1')

    const upsertCall = vi.mocked(prisma.conversation.upsert).mock.calls[0]?.[0] as any
    expect(upsertCall.where.userId_channel_emailThreadKey.emailThreadKey)
      .toBe('jane@example.com::quick intro')
    expect(upsertCall.update.unread).toBe(true)
    expect(upsertCall.update.lastSenderIsMe).toBe(false)

    const msgCall = vi.mocked(prisma.message.create).mock.calls[0]?.[0] as any
    expect(msgCall.data.direction).toBe('in')
    expect(msgCall.data.externalId).toBe('<msg-id-1@x>')
  })

  it('skips Message creation if externalId already seen', async () => {
    vi.mocked(prisma.conversation.upsert).mockResolvedValueOnce({ id: 'conv_2' } as any)
    vi.mocked(prisma.message.findFirst).mockResolvedValueOnce({ id: 'existing_msg' } as any)

    await recordInboundEmailReply(USER, {
      fromEmail: 'jane@example.com',
      subject: 'Re: Hello',
      receivedAt: new Date(),
      externalId: '<dup-msg-id>',
    })

    expect(vi.mocked(prisma.message.create)).not.toHaveBeenCalled()
  })

  it('still creates Message when no externalId is provided (legacy senders)', async () => {
    vi.mocked(prisma.conversation.upsert).mockResolvedValueOnce({ id: 'conv_3' } as any)
    vi.mocked(prisma.message.findFirst).mockResolvedValueOnce(null)

    await recordInboundEmailReply(USER, {
      fromEmail: 'bob@example.com',
      subject: 'Hi',
      receivedAt: new Date(),
    })

    expect(vi.mocked(prisma.message.create)).toHaveBeenCalled()
    // findFirst should NOT have been called for dedup (no externalId)
    expect(vi.mocked(prisma.message.findFirst)).not.toHaveBeenCalled()
  })

  it('sets contactId when provided', async () => {
    vi.mocked(prisma.conversation.upsert).mockResolvedValueOnce({ id: 'conv_4' } as any)
    vi.mocked(prisma.message.findFirst).mockResolvedValueOnce(null)

    await recordInboundEmailReply(USER, {
      fromEmail: 'a@b.com',
      subject: 'Hi',
      receivedAt: new Date(),
      contactId: 'cnt_1',
    })

    const upsertCall = vi.mocked(prisma.conversation.upsert).mock.calls[0]?.[0] as any
    expect(upsertCall.update.contactId).toBe('cnt_1')
    expect(upsertCall.create.contactId).toBe('cnt_1')
  })
})
