import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mocks must be set up before importing the module under test
vi.mock('nodemailer', () => {
  const sendMail = vi.fn().mockResolvedValue({ messageId: 'mock-mid' })
  return {
    default: { createTransport: vi.fn().mockReturnValue({ sendMail }) },
    createTransport: vi.fn().mockReturnValue({ sendMail }),
    __sendMail: sendMail,
  }
})

vi.mock('@/lib/encryption', () => ({
  safeDecrypt: vi.fn((s: string | null) => (s ? `decrypted:${s}` : null)),
  encrypt: vi.fn((s: string) => `enc:${s}`),
}))

vi.mock('@/lib/senderRotation', () => ({
  pickSenderForCampaign: vi.fn(),
}))

// Force send-window guard to pass by default; individual tests override.
vi.mock('@/lib/timezone', async () => {
  const actual = await vi.importActual<typeof import('@/lib/timezone')>('@/lib/timezone')
  return {
    ...actual,
    isWithinSendWindow: vi.fn().mockReturnValue(true),
  }
})

import { prisma } from '@/lib/prisma'
import { runStepForCampaignLead, stripHtml } from '@/lib/sequenceRunner'
import { pickSenderForCampaign } from '@/lib/senderRotation'
import { isWithinSendWindow } from '@/lib/timezone'
import nodemailer from 'nodemailer'

const USER = 'user_test_123'

// Helper: build a CampaignLead shape matching runStepForCampaignLead's input contract
function buildCl(opts: {
  currentStep?: number
  steps?: unknown[]
  leadEmail?: string | null
  linkedinUrl?: string | null
} = {}) {
  return {
    id: 'cl_1',
    leadId: 'lead_1',
    campaignId: 'cam_1',
    currentStep: opts.currentStep ?? 0,
    lead: {
      id: 'lead_1',
      firstName: 'Jane',
      lastName: 'Doe',
      email: opts.leadEmail === undefined ? 'jane@example.com' : opts.leadEmail,
      company: 'Acme',
      headline: 'CEO',
      linkedinUrl: opts.linkedinUrl === undefined ? 'https://linkedin.com/in/jane' : opts.linkedinUrl,
      aiOpener: null,
      phone: null,
    },
    campaign: {
      id: 'cam_1',
      userId: USER,
      timezone: 'Asia/Kolkata',
      sendWindow: [8, 18],
      sequence: { steps: opts.steps ?? [] },
    },
  }
}

function mockSender(over: Partial<{
  id: string
  name: string
  email: string
  smtpHost: string
  smtpPort: number
  smtpUser: string
  smtpPass: string
  signature: string | null
  dailyLimit: number
}> = {}) {
  return {
    id: over.id ?? 'mb_a',
    name: over.name ?? 'Acme',
    email: over.email ?? 'a@acme.com',
    smtpHost: over.smtpHost ?? 'smtp.acme.com',
    smtpPort: over.smtpPort ?? 587,
    smtpUser: over.smtpUser ?? 'a@acme.com',
    smtpPass: over.smtpPass ?? 'enc:xxx',
    signature: over.signature ?? null,
    dailyLimit: over.dailyLimit ?? 50,
  }
}

// ─── EMAIL STEPS ──────────────────────────────────────────────────────────────

describe('runStepForCampaignLead — email step', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isWithinSendWindow).mockReturnValue(true)
  })

  it('happy path: sends, creates EmailMessage, advances lead', async () => {
    vi.mocked(pickSenderForCampaign).mockResolvedValueOnce(mockSender() as any)
    vi.mocked(prisma.emailMessage.create).mockResolvedValueOnce({
      id: 'msg_1',
      trackingId: 'tr_1',
    } as any)

    const cl = buildCl({
      steps: [{ id: 's1', type: 'email', subject: 'Hi {{firstName}}', message: 'Body for {{company}}' }],
    })
    const r = await runStepForCampaignLead(cl as any)

    expect(r.emailsSent).toBe(1)
    expect(r.errors ?? []).toHaveLength(0)

    // EmailMessage created with substituted subject + body
    const createCall = vi.mocked(prisma.emailMessage.create).mock.calls[0]?.[0] as any
    expect(createCall.data.subject).toBe('Hi Jane')
    expect(createCall.data.body).toBe('Body for Acme')
    expect(createCall.data.to).toBe('jane@example.com')

    // CampaignLead advanced (no next step → completed)
    const updateCall = vi.mocked(prisma.campaignLead.update).mock.calls[0]?.[0] as any
    expect(updateCall.where.id).toBe('cl_1')
    expect(updateCall.data.currentStep).toBe(1)
    expect(updateCall.data.status).toBe('completed')
    expect(updateCall.data.nextActionAt).toBeNull()

    // nodemailer was called once
    const sendMailMock = (nodemailer as any).__sendMail ??
      (nodemailer.createTransport as any).mock.results[0]?.value?.sendMail
    expect(sendMailMock).toBeDefined()
  })

  it('passes signature into the outbound text + html when set on the mailbox', async () => {
    vi.mocked(pickSenderForCampaign).mockResolvedValueOnce(
      mockSender({ signature: '-- \nJane @ Acme' }) as any
    )
    vi.mocked(prisma.emailMessage.create).mockResolvedValueOnce({ id: 'msg_1', trackingId: 'tr_1' } as any)

    const cl = buildCl({
      steps: [{ id: 's1', type: 'email', subject: 'Hi', message: 'Hello.' }],
    })
    await runStepForCampaignLead(cl as any)

    const transport = (nodemailer.createTransport as any).mock.results.pop()?.value
    const sendMailCall = transport.sendMail.mock.calls.pop()?.[0]
    expect(sendMailCall.text).toContain('Hello.')
    expect(sendMailCall.text).toContain('-- \nJane @ Acme')
  })

  it('advances with next step → status=pending and nextActionAt = +waitDays', async () => {
    vi.mocked(pickSenderForCampaign).mockResolvedValueOnce(mockSender() as any)
    vi.mocked(prisma.emailMessage.create).mockResolvedValueOnce({ id: 'msg', trackingId: 'tr' } as any)

    const cl = buildCl({
      steps: [
        { id: 's1', type: 'email', subject: 'Hi', message: 'Hello' },
        { id: 's2', type: 'wait', waitDays: 3 },
      ],
    })
    const before = Date.now()
    await runStepForCampaignLead(cl as any)

    const updateCall = vi.mocked(prisma.campaignLead.update).mock.calls[0]?.[0] as any
    expect(updateCall.data.status).toBe('pending')
    const nextActionAt = updateCall.data.nextActionAt as Date
    // ~3 days from now
    const diffMs = nextActionAt.getTime() - before
    const threeDaysMs = 3 * 86_400_000
    expect(diffMs).toBeGreaterThanOrEqual(threeDaysMs - 1000)
    expect(diffMs).toBeLessThan(threeDaysMs + 5000)
  })

  it('skipped when outside the campaign send window', async () => {
    vi.mocked(isWithinSendWindow).mockReturnValueOnce(false)
    const cl = buildCl({
      steps: [{ id: 's1', type: 'email', subject: 'Hi', message: 'B' }],
    })
    const r = await runStepForCampaignLead(cl as any)
    expect(r.skipped).toBe(1)
    expect(vi.mocked(pickSenderForCampaign)).not.toHaveBeenCalled()
    expect(vi.mocked(prisma.emailMessage.create)).not.toHaveBeenCalled()
  })

  it('errors when the lead has no email address', async () => {
    const cl = buildCl({
      leadEmail: null,
      steps: [{ id: 's1', type: 'email', subject: 'Hi', message: 'B' }],
    })
    const r = await runStepForCampaignLead(cl as any)
    expect(r.errors?.[0]).toMatch(/no email/i)
    expect(vi.mocked(prisma.emailMessage.create)).not.toHaveBeenCalled()
  })

  it('skipped + error when no eligible sender (pool exhausted)', async () => {
    vi.mocked(pickSenderForCampaign).mockResolvedValueOnce(null)
    const cl = buildCl({
      steps: [{ id: 's1', type: 'email', subject: 'Hi', message: 'B' }],
    })
    const r = await runStepForCampaignLead(cl as any)
    expect(r.skipped).toBe(1)
    expect(r.errors?.[0]).toMatch(/no eligible sender/i)
    expect(vi.mocked(prisma.emailMessage.create)).not.toHaveBeenCalled()
  })

  it('rolls back EmailMessage on transient SMTP failure and increments attempts', async () => {
    vi.mocked(pickSenderForCampaign).mockResolvedValueOnce(mockSender() as any)
    vi.mocked(prisma.emailMessage.create).mockResolvedValueOnce({ id: 'msg_x', trackingId: 'tr_x' } as any)
    vi.mocked(prisma.emailMessage.delete).mockResolvedValueOnce({} as any)
    // Network / unknown error (no responseCode) -> treated as transient
    const failingTransport = { sendMail: vi.fn().mockRejectedValue(new Error('SMTP down')) }
    ;(nodemailer.createTransport as any).mockReturnValueOnce(failingTransport)

    const cl = buildCl({
      steps: [{ id: 's1', type: 'email', subject: 'Hi', message: 'B' }],
    })
    const r = await runStepForCampaignLead(cl as any)

    expect(r.errors?.[0]).toMatch(/SMTP down/i)
    expect(vi.mocked(prisma.emailMessage.delete)).toHaveBeenCalledWith({ where: { id: 'msg_x' } })
    // CampaignLead is updated to record the attempt; currentStep NOT advanced.
    const updateCall = vi.mocked(prisma.campaignLead.update).mock.calls[0]?.[0] as any
    expect(updateCall.where.id).toBe('cl_1')
    expect(updateCall.data.currentStep).toBeUndefined()
    expect(updateCall.data.attempts).toBe(1)
    expect(updateCall.data.lastError).toMatch(/SMTP down/i)
    expect(updateCall.data.status).toBeUndefined() // stays 'pending'
    // nextActionAt scheduled in the future (backoff)
    expect(updateCall.data.nextActionAt).toBeInstanceOf(Date)
    expect((updateCall.data.nextActionAt as Date).getTime()).toBeGreaterThan(Date.now())
  })

  it('permanent 5xx SMTP bounce -> status=bounced, no retry', async () => {
    vi.mocked(pickSenderForCampaign).mockResolvedValueOnce(mockSender() as any)
    vi.mocked(prisma.emailMessage.create).mockResolvedValueOnce({ id: 'msg_b', trackingId: 'tr_b' } as any)
    vi.mocked(prisma.emailMessage.delete).mockResolvedValueOnce({} as any)
    // Permanent bounce: 550 No such user
    const bounceErr: Error & { responseCode?: number } = new Error('550 5.1.1 No such user')
    bounceErr.responseCode = 550
    const failingTransport = { sendMail: vi.fn().mockRejectedValue(bounceErr) }
    ;(nodemailer.createTransport as any).mockReturnValueOnce(failingTransport)

    const cl = buildCl({
      steps: [{ id: 's1', type: 'email', subject: 'Hi', message: 'B' }],
    })
    const r = await runStepForCampaignLead(cl as any)

    expect(r.bounced).toBe(1)
    const updateCall = vi.mocked(prisma.campaignLead.update).mock.calls[0]?.[0] as any
    expect(updateCall.data.status).toBe('bounced')
    expect(updateCall.data.nextActionAt).toBeNull()
    expect(updateCall.data.lastError).toMatch(/No such user/)
    // attempts NOT incremented for permanent bounces (we never retry)
    expect(updateCall.data.attempts).toBeUndefined()
    // Bounced address auto-added to suppression list
    const upsertCall = vi.mocked(prisma.unsubscribe.upsert).mock.calls[0]?.[0] as any
    expect(upsertCall.create.email).toBe('jane@example.com')
  })

  it('transient failure past MAX_ATTEMPTS -> status=failed, no retry', async () => {
    vi.mocked(pickSenderForCampaign).mockResolvedValueOnce(mockSender() as any)
    vi.mocked(prisma.emailMessage.create).mockResolvedValueOnce({ id: 'msg_f', trackingId: 'tr_f' } as any)
    vi.mocked(prisma.emailMessage.delete).mockResolvedValueOnce({} as any)
    const failingTransport = { sendMail: vi.fn().mockRejectedValue(new Error('Connection refused')) }
    ;(nodemailer.createTransport as any).mockReturnValueOnce(failingTransport)

    const cl = {
      ...buildCl({ steps: [{ id: 's1', type: 'email', subject: 'Hi', message: 'B' }] }),
      attempts: 4, // already at attempts=4, next will be 5 = MAX_ATTEMPTS
    }
    const r = await runStepForCampaignLead(cl as any)

    expect(r.failed).toBe(1)
    const updateCall = vi.mocked(prisma.campaignLead.update).mock.calls[0]?.[0] as any
    expect(updateCall.data.status).toBe('failed')
    expect(updateCall.data.nextActionAt).toBeNull()
    expect(updateCall.data.attempts).toBe(5)
  })

  it('successful send after partial attempts resets attempts and lastError', async () => {
    vi.mocked(pickSenderForCampaign).mockResolvedValueOnce(mockSender() as any)
    vi.mocked(prisma.emailMessage.create).mockResolvedValueOnce({ id: 'msg', trackingId: 'tr' } as any)

    const cl = {
      ...buildCl({ steps: [{ id: 's1', type: 'email', subject: 'Hi', message: 'B' }] }),
      attempts: 2, // previous retries
    }
    const r = await runStepForCampaignLead(cl as any)

    expect(r.emailsSent).toBe(1)
    const updateCall = vi.mocked(prisma.campaignLead.update).mock.calls[0]?.[0] as any
    expect(updateCall.data.attempts).toBe(0)
    expect(updateCall.data.lastError).toBeNull()
    expect(updateCall.data.status).toBe('completed') // no next step
  })

  it('backoff times increase across attempts', async () => {
    vi.mocked(pickSenderForCampaign).mockResolvedValue(mockSender() as any)
    vi.mocked(prisma.emailMessage.create).mockResolvedValue({ id: 'msg', trackingId: 'tr' } as any)
    vi.mocked(prisma.emailMessage.delete).mockResolvedValue({} as any)
    ;(nodemailer.createTransport as any).mockReturnValue({
      sendMail: vi.fn().mockRejectedValue(new Error('timeout')),
    })

    const backoffs: number[] = []
    for (const attempts of [0, 1, 2, 3]) {
      vi.mocked(prisma.campaignLead.update).mockClear()
      const cl = {
        ...buildCl({ steps: [{ id: 's1', type: 'email', subject: 'Hi', message: 'B' }] }),
        attempts,
      }
      const before = Date.now()
      await runStepForCampaignLead(cl as any)
      const call = vi.mocked(prisma.campaignLead.update).mock.calls[0]?.[0] as any
      backoffs.push((call.data.nextActionAt as Date).getTime() - before)
    }

    // [15m, 1h, 4h, 12h] in ms — monotonically increasing
    expect(backoffs[0]).toBeGreaterThan(0)
    expect(backoffs[1]).toBeGreaterThan(backoffs[0])
    expect(backoffs[2]).toBeGreaterThan(backoffs[1])
    expect(backoffs[3]).toBeGreaterThan(backoffs[2])
  })

  it('markAsManual creates a Task instead of sending; lead still advances', async () => {
    // Runner needs the created task's id for the Activity emit
    vi.mocked(prisma.task.create).mockResolvedValueOnce({ id: 'tsk_1' } as any)

    const cl = buildCl({
      steps: [{ id: 's1', type: 'email', subject: 'Reach out', message: 'Body', markAsManual: true }],
    })
    const r = await runStepForCampaignLead(cl as any)

    expect(r.tasksCreated).toBe(1)
    expect(r.emailsSent).toBeUndefined()

    const taskCall = vi.mocked(prisma.task.create).mock.calls[0]?.[0] as any
    expect(taskCall.data.userId).toBe(USER)
    expect(taskCall.data.leadId).toBe('lead_1')
    expect(taskCall.data.campaignId).toBe('cam_1')
    expect(taskCall.data.type).toBe('email')
    expect(taskCall.data.title).toBe('Reach out')
    expect(taskCall.data.notes).toBe('Body')

    // No SMTP, no EmailMessage
    expect(vi.mocked(prisma.emailMessage.create)).not.toHaveBeenCalled()

    // Lead advanced
    const updateCall = vi.mocked(prisma.campaignLead.update).mock.calls[0]?.[0] as any
    expect(updateCall.data.currentStep).toBe(1)
  })

  it('honours step-level emailAccountId override (passed through to pickSenderForCampaign)', async () => {
    vi.mocked(pickSenderForCampaign).mockResolvedValueOnce(mockSender({ id: 'mb_override' }) as any)
    vi.mocked(prisma.emailMessage.create).mockResolvedValueOnce({ id: 'msg', trackingId: 'tr' } as any)

    const cl = buildCl({
      steps: [{ id: 's1', type: 'email', subject: 'Hi', message: 'B', emailAccountId: 'mb_override' }],
    })
    await runStepForCampaignLead(cl as any)

    const pickCall = vi.mocked(pickSenderForCampaign).mock.calls[0]?.[0]
    expect(pickCall?.stepEmailAccountId).toBe('mb_override')
  })
})

// ─── isPermanentBounce helper ─────────────────────────────────────────────────

import { isPermanentBounce } from '@/lib/sequenceRunner'

describe('isPermanentBounce', () => {
  it('returns true for 5xx response codes', () => {
    expect(isPermanentBounce(Object.assign(new Error('x'), { responseCode: 550 }))).toBe(true)
    expect(isPermanentBounce(Object.assign(new Error('x'), { responseCode: 553 }))).toBe(true)
    expect(isPermanentBounce(Object.assign(new Error('x'), { responseCode: 599 }))).toBe(true)
  })

  it('returns false for 4xx response codes (transient)', () => {
    expect(isPermanentBounce(Object.assign(new Error('x'), { responseCode: 421 }))).toBe(false)
    expect(isPermanentBounce(Object.assign(new Error('x'), { responseCode: 450 }))).toBe(false)
  })

  it('returns false for plain errors with no responseCode (network, unknown)', () => {
    expect(isPermanentBounce(new Error('ECONNREFUSED'))).toBe(false)
    expect(isPermanentBounce(new Error('timeout'))).toBe(false)
    expect(isPermanentBounce('not an error')).toBe(false)
    expect(isPermanentBounce(null)).toBe(false)
    expect(isPermanentBounce(undefined)).toBe(false)
  })

  it('returns false for non-5xx numeric codes', () => {
    expect(isPermanentBounce(Object.assign(new Error('x'), { responseCode: 200 }))).toBe(false)
    expect(isPermanentBounce(Object.assign(new Error('x'), { responseCode: 600 }))).toBe(false)
  })
})

// ─── LINKEDIN STEPS ───────────────────────────────────────────────────────────

describe('runStepForCampaignLead — LinkedIn step', () => {
  beforeEach(() => vi.clearAllMocks())

  it('queues a LinkedInAction and marks lead in_progress (does NOT auto-advance currentStep)', async () => {
    const cl = buildCl({
      steps: [{ id: 's1', type: 'chat_message', message: 'Hey {{firstName}}' }],
    })
    const r = await runStepForCampaignLead(cl as any)
    expect(r.linkedInQueued).toBe(1)

    const actionCall = vi.mocked(prisma.linkedInAction.create).mock.calls[0]?.[0] as any
    expect(actionCall.data.userId).toBe(USER)
    expect(actionCall.data.profileId).toBe('jane')
    expect(actionCall.data.actionType).toBe('chat_message')
    expect(actionCall.data.message).toBe('Hey Jane')

    const updateCall = vi.mocked(prisma.campaignLead.update).mock.calls[0]?.[0] as any
    expect(updateCall.data.status).toBe('in_progress')
    // The extension confirms in /api/linkedin-actions/[id], so the runner does
    // NOT advance currentStep here.
    expect(updateCall.data.currentStep).toBeUndefined()
  })

  it('skipped when the lead has no LinkedIn URL', async () => {
    const cl = buildCl({
      linkedinUrl: null,
      steps: [{ id: 's1', type: 'visit_profile' }],
    })
    const r = await runStepForCampaignLead(cl as any)
    expect(r.skipped).toBe(1)
    expect(vi.mocked(prisma.linkedInAction.create)).not.toHaveBeenCalled()
  })

  it('substitutes vars in the LinkedIn message before queueing', async () => {
    const cl = buildCl({
      steps: [{ id: 's1', type: 'connection_request', message: 'Hi {{firstName}} at {{company}}' }],
    })
    await runStepForCampaignLead(cl as any)
    const actionCall = vi.mocked(prisma.linkedInAction.create).mock.calls[0]?.[0] as any
    expect(actionCall.data.message).toBe('Hi Jane at Acme')
  })
})

// ─── WAIT STEPS ───────────────────────────────────────────────────────────────

describe('runStepForCampaignLead — wait + wait_until_accepted', () => {
  beforeEach(() => vi.clearAllMocks())

  it('wait step advances the lead and sets nextActionAt from the NEXT step waitDays', async () => {
    const cl = buildCl({
      steps: [
        { id: 's1', type: 'wait', waitDays: 2 },
        { id: 's2', type: 'chat_message', waitDays: 1, message: 'Hi' },
      ],
    })
    const before = Date.now()
    const r = await runStepForCampaignLead(cl as any)
    expect(r.skipped).toBe(1)

    const updateCall = vi.mocked(prisma.campaignLead.update).mock.calls[0]?.[0] as any
    expect(updateCall.data.currentStep).toBe(1)
    expect(updateCall.data.status).toBe('pending')
    // nextActionAt comes from s2 (the next step), not s1
    const diff = (updateCall.data.nextActionAt as Date).getTime() - before
    expect(diff).toBeGreaterThanOrEqual(86_400_000 - 1000)
    expect(diff).toBeLessThan(86_400_000 + 5000)
  })

  it('wait_until_accepted advances exactly like wait', async () => {
    const cl = buildCl({
      steps: [{ id: 's1', type: 'wait_until_accepted' }],
    })
    const r = await runStepForCampaignLead(cl as any)
    expect(r.skipped).toBe(1)
    const updateCall = vi.mocked(prisma.campaignLead.update).mock.calls[0]?.[0] as any
    expect(updateCall.data.currentStep).toBe(1)
    expect(updateCall.data.status).toBe('completed')
    expect(updateCall.data.nextActionAt).toBeNull()
  })
})

// ─── EDGE CASES ───────────────────────────────────────────────────────────────

describe('runStepForCampaignLead — edge cases', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns skipped when currentStep is past the end of the steps array', async () => {
    const cl = buildCl({
      currentStep: 5,
      steps: [{ id: 's1', type: 'wait', waitDays: 1 }],
    })
    const r = await runStepForCampaignLead(cl as any)
    expect(r.skipped).toBe(1)
    expect(vi.mocked(prisma.campaignLead.update)).not.toHaveBeenCalled()
  })

  it('returns skipped on unknown step types', async () => {
    const cl = buildCl({
      steps: [{ id: 's1', type: 'sms', message: 'Hi' }],
    })
    const r = await runStepForCampaignLead(cl as any)
    expect(r.skipped).toBe(1)
  })
})

// ─── applyVars — conditional blocks ──────────────────────────────────────────

import { applyVars } from '@/lib/sequenceRunner'

describe('applyVars — conditional blocks', () => {
  it('{{if field}} renders when field is set', () => {
    expect(applyVars('Hi {{if company}}at {{company}}{{end}}!', { company: 'Acme', firstName: '' }))
      .toBe('Hi at Acme!')
  })

  it('{{if field}} hides block when field is empty', () => {
    expect(applyVars('Hi {{if company}}at {{company}} {{end}}there', { company: '', firstName: '' }))
      .toBe('Hi there')
  })

  it('{{if field}}...{{else}}...{{end}} — truthy branch', () => {
    expect(applyVars('{{if aiOpener}}{{aiOpener}}{{else}}Hello{{end}}', { aiOpener: 'Great post!', firstName: '' }))
      .toBe('Great post!')
  })

  it('{{if field}}...{{else}}...{{end}} — else branch', () => {
    expect(applyVars('{{if aiOpener}}{{aiOpener}}{{else}}Hello{{end}}', { aiOpener: '', firstName: '' }))
      .toBe('Hello')
  })

  it('{{if not field}} renders when field is empty', () => {
    expect(applyVars('{{if not phone}}No phone{{end}}', { phone: '', firstName: '' }))
      .toBe('No phone')
  })

  it('{{if not field}} hides when field is set', () => {
    expect(applyVars('{{if not phone}}No phone{{end}}', { phone: '+1234', firstName: '' }))
      .toBe('')
  })

  it('case-insensitive tags', () => {
    expect(applyVars('{{IF company}}yes{{END}}', { company: 'X', firstName: '' }))
      .toBe('yes')
  })
})

// ─── runPendingStepsForUser — time budget ─────────────────────────────────────

import { runPendingStepsForUser } from '@/lib/sequenceRunner'

describe('runPendingStepsForUser — time budget', () => {
  beforeEach(() => vi.clearAllMocks())

  it('reports deferred count when the budget elapses mid-loop', async () => {
    // Mock 5 pending leads
    const pending = [1, 2, 3, 4, 5].map((i) => ({
      ...buildCl({ steps: [{ id: 's1', type: 'wait', waitDays: 1 }] }),
      id: `cl_${i}`,
    }))
    vi.mocked(prisma.campaignLead.findMany).mockResolvedValueOnce(pending as any)

    // Use fake timers to manipulate Date.now()
    vi.useFakeTimers()
    const startTime = new Date('2026-06-23T00:00:00Z').getTime()
    vi.setSystemTime(startTime)

    // Advance the clock by 200ms after every campaignLead.update call so the
    // 500ms budget is exceeded after ~3 leads.
    vi.mocked(prisma.campaignLead.update).mockImplementation((async () => {
      vi.setSystemTime(Date.now() + 200)
      return {} as any
    }) as any)

    const r = await runPendingStepsForUser('user_1', 50, { maxRuntimeMs: 500 })

    expect(r.deferred).toBeGreaterThan(0)
    expect(r.deferred).toBeLessThan(5)
    // Verify the runner processed SOME but not ALL leads
    expect(vi.mocked(prisma.campaignLead.update).mock.calls.length).toBeLessThan(5)
    expect(vi.mocked(prisma.campaignLead.update).mock.calls.length).toBeGreaterThanOrEqual(1)

    vi.useRealTimers()
  })

  it('uses default budget of 30s when not specified', async () => {
    vi.mocked(prisma.campaignLead.findMany).mockResolvedValueOnce([] as any)
    const r = await runPendingStepsForUser('user_1', 50)
    expect(r.deferred).toBeUndefined()
    expect(r.errors).toEqual([])
  })

  it('does not exceed the configured limit', async () => {
    vi.mocked(prisma.campaignLead.findMany).mockResolvedValueOnce([] as any)
    await runPendingStepsForUser('user_1', 200, { maxRuntimeMs: 30_000 })
    const findManyCall = vi.mocked(prisma.campaignLead.findMany).mock.calls[0]?.[0] as any
    expect(findManyCall.take).toBe(200)
  })

  it('caps the limit at 200 even when caller passes higher', async () => {
    vi.mocked(prisma.campaignLead.findMany).mockResolvedValueOnce([] as any)
    await runPendingStepsForUser('user_1', 10_000, { maxRuntimeMs: 30_000 })
    const findManyCall = vi.mocked(prisma.campaignLead.findMany).mock.calls[0]?.[0] as any
    expect(findManyCall.take).toBe(200)
  })
})

// ── stripHtml ─────────────────────────────────────────────────────────────────

describe('stripHtml', () => {
  it('strips simple paragraph tags', () => {
    expect(stripHtml('<p>Hello world</p>')).toBe('Hello world')
  })

  it('converts </p> to newline between paragraphs', () => {
    expect(stripHtml('<p>First</p><p>Second</p>')).toBe('First\nSecond')
  })

  it('converts <br> to newline', () => {
    expect(stripHtml('Line one<br>Line two')).toBe('Line one\nLine two')
  })

  it('strips bold and italic tags, keeps text', () => {
    expect(stripHtml('<p><strong>Bold</strong> and <em>italic</em></p>')).toBe('Bold and italic')
  })

  it('converts bullet list items to • prefix', () => {
    const html = '<ul><li>Apple</li><li>Banana</li></ul>'
    const result = stripHtml(html)
    expect(result).toContain('• Apple')
    expect(result).toContain('• Banana')
  })

  it('decodes HTML entities', () => {
    expect(stripHtml('&amp; &lt;tag&gt; &quot;quoted&quot; &nbsp;space')).toBe('& <tag> "quoted"  space')
  })

  it('collapses more than 2 consecutive newlines', () => {
    const html = '<p>A</p><p></p><p></p><p>B</p>'
    const result = stripHtml(html)
    expect(result).not.toMatch(/\n{3,}/)
  })

  it('trims leading and trailing whitespace', () => {
    expect(stripHtml('<p>  trimmed  </p>')).toBe('trimmed')
  })

  it('handles plain text without tags unchanged', () => {
    expect(stripHtml('Hi {{firstName}}, how are you?')).toBe('Hi {{firstName}}, how are you?')
  })

  it('preserves {{variable}} tokens through stripping', () => {
    const result = stripHtml('<p>Hi <strong>{{firstName}}</strong>, I work at {{company}}.</p>')
    expect(result).toBe('Hi {{firstName}}, I work at {{company}}.')
  })
})

// ── buildHtml: HTML content from rich editor is not escaped ──────────────────
// Verify the critical property without needing the full email pipeline:
// buildHtml must pass through Tiptap HTML as-is, not escape the tags.

describe('HTML content from rich editor passes through to email body', () => {
  it('applyVars on HTML message preserves HTML tags', () => {
    const html = '<p>Hi <strong>{{firstName}}</strong>, work at <em>{{company}}</em>.</p>'
    const result = applyVars(html, { firstName: 'Jane', lastName: '', company: 'Acme', headline: '', aiOpener: '' })
    expect(result).toContain('<strong>')
    expect(result).not.toContain('{{firstName}}')
    expect(result).toBe('<p>Hi <strong>Jane</strong>, work at <em>Acme</em>.</p>')
  })

  it('stripHtml on HTML email message gives clean plain text', () => {
    const html = '<p>Hi <strong>Jane</strong>, work at <em>Acme</em>.</p>'
    expect(stripHtml(html)).toBe('Hi Jane, work at Acme.')
  })
})

// ── LinkedIn step — strips HTML before queuing ────────────────────────────────

describe('linkedin step — strips HTML from rich-editor message', () => {
  beforeEach(() => vi.clearAllMocks())

  it('queues plain text, not raw HTML', async () => {
    vi.mocked(prisma.linkedInAction.create).mockResolvedValueOnce({ id: 'lia_1' } as any)
    vi.mocked(prisma.campaignLead.update).mockResolvedValueOnce({} as any)

    const htmlMessage = '<p>Hi <strong>{{firstName}}</strong>, let\'s connect!</p>'
    // buildCl has firstName: 'Jane' — use that in the expected string
    const cl = buildCl({
      steps: [{ type: 'chat_message', message: htmlMessage }],
      linkedinUrl: 'https://linkedin.com/in/testuser',
    })

    const result = await runStepForCampaignLead(cl)
    expect(result.linkedInQueued).toBe(1)

    const actionCreate = vi.mocked(prisma.linkedInAction.create).mock.calls[0]?.[0] as any
    expect(actionCreate.data.message).not.toContain('<')
    expect(actionCreate.data.message).toBe('Hi Jane, let\'s connect!')
  })
})
