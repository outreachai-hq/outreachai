// Plan 8 (Iter 2) — smoke tests for the Drafts API + internalApproveAndSend.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/lib/prisma'

import { GET as listDrafts, POST as createDraft } from '@/app/api/drafts/route'
import { PATCH as patchDraft, DELETE as deleteDraft } from '@/app/api/drafts/[id]/route'
import { POST as approveSendRoute } from '@/app/api/drafts/[id]/approve-send/route'
import { POST as rejectRoute } from '@/app/api/drafts/[id]/reject/route'
import { POST as scheduleRoute } from '@/app/api/drafts/[id]/schedule/route'

// Mock the SMTP send + sender picker so tests don't need a real mail server.
vi.mock('@/lib/senderRotation', () => ({ pickSenderForCampaign: vi.fn() }))
vi.mock('nodemailer', () => ({
  default: { createTransport: vi.fn(() => ({ sendMail: vi.fn().mockResolvedValue({}) })) },
}))

function mkReq(url: string, init?: RequestInit) {
  return new Request(url, init) as unknown as Parameters<typeof patchDraft>[0]
}

describe('GET /api/drafts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects an invalid status filter', async () => {
    const res = await listDrafts(mkReq('http://x/api/drafts?status=bonkers') as never)
    expect(res.status).toBe(400)
  })

  it('defaults to pending+edited statuses when none provided', async () => {
    vi.mocked(prisma.draftMessage.findMany).mockResolvedValue([])
    await listDrafts(mkReq('http://x/api/drafts') as never)
    expect(vi.mocked(prisma.draftMessage.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: { in: ['pending', 'edited'] } }),
      }),
    )
  })

  it('honors a specific status', async () => {
    vi.mocked(prisma.draftMessage.findMany).mockResolvedValue([])
    await listDrafts(mkReq('http://x/api/drafts?status=sent') as never)
    expect(vi.mocked(prisma.draftMessage.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'sent' }) }),
    )
  })
})

describe('POST /api/drafts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects bad channel', async () => {
    const res = await createDraft(mkReq('http://x', { method: 'POST', body: JSON.stringify({ channel: 'fax', body: 'hi' }) }))
    expect(res.status).toBe(400)
  })

  it('rejects empty body', async () => {
    const res = await createDraft(mkReq('http://x', { method: 'POST', body: JSON.stringify({ channel: 'email', body: '  ' }) }))
    expect(res.status).toBe(400)
  })

  it('creates a manual draft with source/createdByAi flags set', async () => {
    vi.mocked(prisma.draftMessage.create).mockResolvedValue({ id: 'd1' } as never)
    const res = await createDraft(mkReq('http://x', { method: 'POST', body: JSON.stringify({
      channel: 'email', subject: 'Hi', body: 'Hello world', leadId: 'l1',
    }) }))
    expect(res.status).toBe(201)
    expect(vi.mocked(prisma.draftMessage.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          channel: 'email', subject: 'Hi', body: 'Hello world',
          leadId: 'l1', source: 'manual_draft', createdByAi: false,
        }),
      }),
    )
  })
})

describe('PATCH /api/drafts/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('404 when not owned', async () => {
    vi.mocked(prisma.draftMessage.findFirst).mockResolvedValue(null)
    const res = await patchDraft(mkReq('http://x', { method: 'PATCH', body: '{}' }),
      { params: Promise.resolve({ id: 'x' }) })
    expect(res.status).toBe(404)
  })

  it('rejects edits on sent drafts', async () => {
    vi.mocked(prisma.draftMessage.findFirst).mockResolvedValue({ id: 'd1', body: 'old', status: 'sent' } as never)
    const res = await patchDraft(mkReq('http://x', { method: 'PATCH', body: JSON.stringify({ body: 'new' }) }),
      { params: Promise.resolve({ id: 'd1' }) })
    expect(res.status).toBe(400)
  })

  it('flips status pending -> edited when body changes', async () => {
    vi.mocked(prisma.draftMessage.findFirst).mockResolvedValue({ id: 'd1', body: 'old', status: 'pending' } as never)
    vi.mocked(prisma.draftMessage.update).mockResolvedValue({ id: 'd1' } as never)
    await patchDraft(mkReq('http://x', { method: 'PATCH', body: JSON.stringify({ body: 'new body' }) }),
      { params: Promise.resolve({ id: 'd1' }) })
    expect(vi.mocked(prisma.draftMessage.update)).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ body: 'new body', status: 'edited' }) }),
    )
  })

  it('accepts scheduledFor=null to clear schedule', async () => {
    vi.mocked(prisma.draftMessage.findFirst).mockResolvedValue({ id: 'd1', body: 'x', status: 'pending' } as never)
    vi.mocked(prisma.draftMessage.update).mockResolvedValue({ id: 'd1' } as never)
    await patchDraft(mkReq('http://x', { method: 'PATCH', body: JSON.stringify({ scheduledFor: null }) }),
      { params: Promise.resolve({ id: 'd1' }) })
    expect(vi.mocked(prisma.draftMessage.update)).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ scheduledFor: null }) }),
    )
  })
})

describe('DELETE /api/drafts/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('404 when nothing removed', async () => {
    vi.mocked(prisma.draftMessage.deleteMany).mockResolvedValue({ count: 0 })
    const res = await deleteDraft(mkReq('http://x', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'x' }) })
    expect(res.status).toBe(404)
  })
})

describe('POST /api/drafts/[id]/approve-send', () => {
  beforeEach(() => vi.clearAllMocks())

  it('404 when draft already sent', async () => {
    vi.mocked(prisma.draftMessage.findFirst).mockResolvedValue(null)
    const res = await approveSendRoute(mkReq('http://x', { method: 'POST' }),
      { params: Promise.resolve({ id: 'd1' }) })
    expect(res.status).toBe(404)
  })

  it('email happy path: marks approved → sends → transitions to sent', async () => {
    vi.mocked(prisma.draftMessage.findFirst).mockResolvedValue({
      id: 'd1', userId: 'user_test_123', channel: 'email', subject: 'Hi', body: 'Hello',
      leadId: 'l1', status: 'pending', campaignId: null, contactId: null, conversationId: null,
    } as never)
    vi.mocked(prisma.draftMessage.update).mockResolvedValue({} as never)
    vi.mocked(prisma.lead.findFirst).mockResolvedValue({ email: 'aakash@phonepe.example.com' } as never)
    vi.mocked(prisma.emailAccount.findFirst).mockResolvedValue({
      id: 'ea_1', smtpHost: 'smtp.gmail.com', smtpUser: 'u', smtpPass: 'p', smtpPort: 587,
      name: 'Me', email: 'me@x.com', signature: null,
    } as never)
    vi.mocked(prisma.emailMessage.create).mockResolvedValue({ id: 'em_1' } as never)

    const res = await approveSendRoute(mkReq('http://x', { method: 'POST' }),
      { params: Promise.resolve({ id: 'd1' }) })
    expect(res.status).toBe(200)
    // First update marks 'approved', second 'sent'. We don't care about order
    // semantics here — just that the success transition fired.
    expect(vi.mocked(prisma.draftMessage.update)).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'sent' }) }),
    )
  })

  it('email no-recipient: returns 400 and rolls back approved marker', async () => {
    vi.mocked(prisma.draftMessage.findFirst).mockResolvedValue({
      id: 'd1', userId: 'user_test_123', channel: 'email', subject: 'Hi', body: 'Hello',
      leadId: null, contactId: null, conversationId: null, campaignId: null, status: 'pending',
    } as never)
    vi.mocked(prisma.draftMessage.update).mockResolvedValue({} as never)

    const res = await approveSendRoute(mkReq('http://x', { method: 'POST' }),
      { params: Promise.resolve({ id: 'd1' }) })
    expect(res.status).toBe(400)
    // Two updates: one to set approved, one to roll back.
    expect(vi.mocked(prisma.draftMessage.update).mock.calls.length).toBeGreaterThanOrEqual(2)
  })
})

describe('POST /api/drafts/[id]/reject', () => {
  beforeEach(() => vi.clearAllMocks())

  it('flips to rejected', async () => {
    vi.mocked(prisma.draftMessage.updateMany).mockResolvedValue({ count: 1 })
    const res = await rejectRoute(mkReq('http://x', { method: 'POST' }),
      { params: Promise.resolve({ id: 'd1' }) })
    expect(res.status).toBe(200)
  })

  it('404 when already processed', async () => {
    vi.mocked(prisma.draftMessage.updateMany).mockResolvedValue({ count: 0 })
    const res = await rejectRoute(mkReq('http://x', { method: 'POST' }),
      { params: Promise.resolve({ id: 'd1' }) })
    expect(res.status).toBe(404)
  })
})

describe('POST /api/drafts/[id]/schedule', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects past timestamps', async () => {
    const res = await scheduleRoute(mkReq('http://x', { method: 'POST', body: JSON.stringify({ scheduledFor: '2020-01-01T00:00:00Z' }) }),
      { params: Promise.resolve({ id: 'd1' }) })
    expect(res.status).toBe(400)
  })

  it('rejects garbage timestamps', async () => {
    const res = await scheduleRoute(mkReq('http://x', { method: 'POST', body: JSON.stringify({ scheduledFor: 'tomorrow' }) }),
      { params: Promise.resolve({ id: 'd1' }) })
    expect(res.status).toBe(400)
  })

  it('schedules for the future', async () => {
    vi.mocked(prisma.draftMessage.updateMany).mockResolvedValue({ count: 1 })
    const future = new Date(Date.now() + 5 * 60_000).toISOString()
    const res = await scheduleRoute(mkReq('http://x', { method: 'POST', body: JSON.stringify({ scheduledFor: future }) }),
      { params: Promise.resolve({ id: 'd1' }) })
    expect(res.status).toBe(200)
  })

  it('clears the schedule when null', async () => {
    vi.mocked(prisma.draftMessage.updateMany).mockResolvedValue({ count: 1 })
    const res = await scheduleRoute(mkReq('http://x', { method: 'POST', body: JSON.stringify({ scheduledFor: null }) }),
      { params: Promise.resolve({ id: 'd1' }) })
    expect(res.status).toBe(200)
  })
})
