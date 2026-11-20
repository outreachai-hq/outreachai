import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import {
  emitActivity,
  Activity,
  ACTIVITY_TYPES,
} from '@/lib/activity'

const USER = 'user_test_123'

// ─── emitActivity core ────────────────────────────────────────────────────────

describe('emitActivity', () => {
  beforeEach(() => vi.clearAllMocks())

  it('writes a row with the bare-minimum required fields', async () => {
    vi.mocked(prisma.leadActivity.create).mockResolvedValueOnce({} as any)
    await emitActivity({ userId: USER, type: 'note.added', title: 'Hi' })
    const call = vi.mocked(prisma.leadActivity.create).mock.calls[0]?.[0] as any
    expect(call.data.userId).toBe(USER)
    expect(call.data.type).toBe('note.added')
    expect(call.data.title).toBe('Hi')
    expect(call.data.occurredAt).toBeInstanceOf(Date)
    expect(call.data.companyId).toBeNull()
  })

  it('auto-resolves companyId from leadId when not provided', async () => {
    vi.mocked(prisma.lead.findUnique).mockResolvedValueOnce({ companyId: 'cmp_42' } as any)
    vi.mocked(prisma.leadActivity.create).mockResolvedValueOnce({} as any)

    await emitActivity({ userId: USER, leadId: 'lea_1', type: 'email.sent', title: 'Sent' })

    const call = vi.mocked(prisma.leadActivity.create).mock.calls[0]?.[0] as any
    expect(call.data.companyId).toBe('cmp_42')
    expect(call.data.leadId).toBe('lea_1')
  })

  it('auto-resolves companyId from contactId when leadId not set', async () => {
    vi.mocked(prisma.contact.findUnique).mockResolvedValueOnce({ companyId: 'cmp_c' } as any)
    vi.mocked(prisma.leadActivity.create).mockResolvedValueOnce({} as any)

    await emitActivity({ userId: USER, contactId: 'cnt_1', type: 'note.added', title: 'Note' })

    const call = vi.mocked(prisma.leadActivity.create).mock.calls[0]?.[0] as any
    expect(call.data.companyId).toBe('cmp_c')
    expect(call.data.contactId).toBe('cnt_1')
  })

  it('respects an explicit companyId without doing the lookup', async () => {
    vi.mocked(prisma.leadActivity.create).mockResolvedValueOnce({} as any)
    await emitActivity({ userId: USER, leadId: 'lea_1', companyId: 'cmp_override', type: 'note.added', title: 'X' })

    const call = vi.mocked(prisma.leadActivity.create).mock.calls[0]?.[0] as any
    expect(call.data.companyId).toBe('cmp_override')
    expect(vi.mocked(prisma.lead.findUnique)).not.toHaveBeenCalled()
  })

  it('survives a failing lookup (no companyId) without throwing', async () => {
    vi.mocked(prisma.lead.findUnique).mockRejectedValueOnce(new Error('db boom'))
    vi.mocked(prisma.leadActivity.create).mockResolvedValueOnce({} as any)

    await emitActivity({ userId: USER, leadId: 'lea_x', type: 'email.sent', title: 'Sent' })

    const call = vi.mocked(prisma.leadActivity.create).mock.calls[0]?.[0] as any
    expect(call.data.companyId).toBeNull()
  })

  it('passes through provenance fields when given', async () => {
    vi.mocked(prisma.leadActivity.create).mockResolvedValueOnce({} as any)
    await emitActivity({
      userId: USER,
      leadId: 'lea_1', companyId: 'cmp_1',
      campaignId: 'cam_1', sequenceStepId: 'step_1',
      conversationId: 'conv_1', messageId: 'msg_1', taskId: 'tsk_1',
      type: 'email.sent', channel: 'email', source: 'campaign',
      title: 't', body: 'b', payload: { foo: 1 }, actorUserId: 'usr_1',
    })
    const call = vi.mocked(prisma.leadActivity.create).mock.calls[0]?.[0] as any
    expect(call.data.campaignId).toBe('cam_1')
    expect(call.data.sequenceStepId).toBe('step_1')
    expect(call.data.conversationId).toBe('conv_1')
    expect(call.data.messageId).toBe('msg_1')
    expect(call.data.taskId).toBe('tsk_1')
    expect(call.data.body).toBe('b')
    expect(call.data.payload).toEqual({ foo: 1 })
    expect(call.data.actorUserId).toBe('usr_1')
    expect(call.data.channel).toBe('email')
    expect(call.data.source).toBe('campaign')
  })
})

// ─── Activity preset helpers ──────────────────────────────────────────────────

describe('Activity.emailSent', () => {
  beforeEach(() => vi.clearAllMocks())

  it('writes type=email.sent + channel=email + truncates the subject in the title', async () => {
    vi.mocked(prisma.lead.findUnique).mockResolvedValueOnce({ companyId: null } as any)
    vi.mocked(prisma.leadActivity.create).mockResolvedValueOnce({} as any)
    const longSubject = 'A very long subject line that definitely exceeds sixty characters at some point here.'

    await Activity.emailSent({ userId: USER, leadId: 'lea_1', subject: longSubject, campaignId: 'cam_1' })

    const call = vi.mocked(prisma.leadActivity.create).mock.calls[0]?.[0] as any
    expect(call.data.type).toBe(ACTIVITY_TYPES.EMAIL_SENT)
    expect(call.data.channel).toBe('email')
    expect(call.data.source).toBe('campaign')
    expect(call.data.campaignId).toBe('cam_1')
    expect(call.data.title.length).toBeLessThanOrEqual(80) // wraps + truncates
    expect(call.data.title).toContain('A very long subject')
    expect(call.data.title).toContain('…')
  })

  it('omits the subject suffix when not provided', async () => {
    vi.mocked(prisma.lead.findUnique).mockResolvedValueOnce({ companyId: null } as any)
    vi.mocked(prisma.leadActivity.create).mockResolvedValueOnce({} as any)
    await Activity.emailSent({ userId: USER, leadId: 'lea_1' })
    const call = vi.mocked(prisma.leadActivity.create).mock.calls[0]?.[0] as any
    expect(call.data.title).toBe('Sent email')
  })
})

describe('Activity.linkedInQueued', () => {
  beforeEach(() => vi.clearAllMocks())

  it.each([
    ['visit_profile',      ACTIVITY_TYPES.LINKEDIN_VISIT_QUEUED,   'Queued LinkedIn profile visit'],
    ['connection_request', ACTIVITY_TYPES.LINKEDIN_INVITE_QUEUED,  'Queued LinkedIn invitation'],
    ['chat_message',       ACTIVITY_TYPES.LINKEDIN_MESSAGE_QUEUED, 'Queued LinkedIn message'],
  ] as const)('maps actionType=%s correctly', async (actionType, expectedType, expectedTitle) => {
    vi.mocked(prisma.lead.findUnique).mockResolvedValueOnce({ companyId: null } as any)
    vi.mocked(prisma.leadActivity.create).mockResolvedValueOnce({} as any)

    await Activity.linkedInQueued({ userId: USER, leadId: 'lea_1', actionType, campaignId: 'cam_1' })

    const call = vi.mocked(prisma.leadActivity.create).mock.calls[0]?.[0] as any
    expect(call.data.type).toBe(expectedType)
    expect(call.data.channel).toBe('linkedin')
    expect(call.data.source).toBe('campaign')
    expect(call.data.title).toBe(expectedTitle)
  })
})

describe('Activity.linkedInDone', () => {
  beforeEach(() => vi.clearAllMocks())

  it('maps invite -> LINKEDIN_INVITE_SENT + extension source', async () => {
    vi.mocked(prisma.lead.findUnique).mockResolvedValueOnce({ companyId: null } as any)
    vi.mocked(prisma.leadActivity.create).mockResolvedValueOnce({} as any)
    await Activity.linkedInDone({ userId: USER, leadId: 'lea_1', actionType: 'connection_request' })
    const call = vi.mocked(prisma.leadActivity.create).mock.calls[0]?.[0] as any
    expect(call.data.type).toBe(ACTIVITY_TYPES.LINKEDIN_INVITE_SENT)
    expect(call.data.source).toBe('extension')
    expect(call.data.title).toBe('Sent LinkedIn invitation')
  })

  it('falls back to linkedin.<type> for unknown actionTypes', async () => {
    vi.mocked(prisma.leadActivity.create).mockResolvedValueOnce({} as any)
    await Activity.linkedInDone({ userId: USER, actionType: 'react_to_post' })
    const call = vi.mocked(prisma.leadActivity.create).mock.calls[0]?.[0] as any
    expect(call.data.type).toBe('linkedin.react_to_post')
  })
})

describe('Activity.emailBounced + emailFailed', () => {
  beforeEach(() => vi.clearAllMocks())

  it('email.bounced carries reason in body', async () => {
    vi.mocked(prisma.lead.findUnique).mockResolvedValueOnce({ companyId: null } as any)
    vi.mocked(prisma.leadActivity.create).mockResolvedValueOnce({} as any)
    await Activity.emailBounced({ userId: USER, leadId: 'lea_1', reason: '550 No such user' })
    const call = vi.mocked(prisma.leadActivity.create).mock.calls[0]?.[0] as any
    expect(call.data.type).toBe(ACTIVITY_TYPES.EMAIL_BOUNCED)
    expect(call.data.body).toBe('550 No such user')
    expect(call.data.title).toBe('Email bounced')
  })

  it('email.failed with attempts surfaces the count in the title', async () => {
    vi.mocked(prisma.lead.findUnique).mockResolvedValueOnce({ companyId: null } as any)
    vi.mocked(prisma.leadActivity.create).mockResolvedValueOnce({} as any)
    await Activity.emailFailed({ userId: USER, leadId: 'lea_1', reason: 'timeout', attempts: 5 })
    const call = vi.mocked(prisma.leadActivity.create).mock.calls[0]?.[0] as any
    expect(call.data.title).toBe('Email failed after 5 attempts')
    expect(call.data.body).toBe('timeout')
  })
})

describe('Activity.statusChanged', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders "from -> to" in title and stashes both in payload', async () => {
    vi.mocked(prisma.lead.findUnique).mockResolvedValueOnce({ companyId: 'cmp_1' } as any)
    vi.mocked(prisma.leadActivity.create).mockResolvedValueOnce({} as any)
    await Activity.statusChanged({ userId: USER, leadId: 'lea_1', from: 'pending', to: 'replied' })
    const call = vi.mocked(prisma.leadActivity.create).mock.calls[0]?.[0] as any
    expect(call.data.title).toBe('Status changed: pending → replied')
    expect(call.data.payload).toEqual({ from: 'pending', to: 'replied' })
  })

  it('handles initial set (no from)', async () => {
    vi.mocked(prisma.lead.findUnique).mockResolvedValueOnce({ companyId: null } as any)
    vi.mocked(prisma.leadActivity.create).mockResolvedValueOnce({} as any)
    await Activity.statusChanged({ userId: USER, leadId: 'lea_1', to: 'pending' })
    const call = vi.mocked(prisma.leadActivity.create).mock.calls[0]?.[0] as any
    expect(call.data.title).toBe('Status set to pending')
    expect(call.data.payload).toEqual({ from: null, to: 'pending' })
  })
})

describe('Activity.noteAdded', () => {
  beforeEach(() => vi.clearAllMocks())

  it('writes note.added with body + actorUserId', async () => {
    vi.mocked(prisma.lead.findUnique).mockResolvedValueOnce({ companyId: null } as any)
    vi.mocked(prisma.leadActivity.create).mockResolvedValueOnce({} as any)
    await Activity.noteAdded({ userId: USER, leadId: 'lea_1', body: 'Followed up by phone', actorUserId: USER })
    const call = vi.mocked(prisma.leadActivity.create).mock.calls[0]?.[0] as any
    expect(call.data.type).toBe(ACTIVITY_TYPES.NOTE_ADDED)
    expect(call.data.source).toBe('manual')
    expect(call.data.body).toBe('Followed up by phone')
    expect(call.data.actorUserId).toBe(USER)
  })
})
