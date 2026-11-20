import { describe, it, expect } from 'vitest'
import { sequenceStep, sequenceSteps, validateSteps } from '@/lib/sequenceStepSchema'

// ─── per-type valid + invalid cases ───────────────────────────────────────────

describe('sequenceStep — wait', () => {
  it('accepts a minimal wait step', () => {
    const r = sequenceStep.safeParse({ type: 'wait', waitDays: 3 })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.type).toBe('wait')
      expect(r.data.waitDays).toBe(3)
    }
  })

  it('defaults waitDays to 0 when omitted', () => {
    const r = sequenceStep.safeParse({ type: 'wait' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.waitDays).toBe(0)
  })

  it('rejects negative waitDays', () => {
    const r = sequenceStep.safeParse({ type: 'wait', waitDays: -1 })
    expect(r.success).toBe(false)
  })

  it('rejects waitDays > 365', () => {
    const r = sequenceStep.safeParse({ type: 'wait', waitDays: 999 })
    expect(r.success).toBe(false)
  })
})

describe('sequenceStep — email', () => {
  it('accepts a minimal email step', () => {
    const r = sequenceStep.safeParse({
      type: 'email',
      subject: 'Hi {{firstName}}',
      message: 'Body text',
    })
    expect(r.success).toBe(true)
  })

  it('rejects email step without subject', () => {
    const r = sequenceStep.safeParse({
      type: 'email',
      message: 'Body text',
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes('subject'))).toBe(true)
    }
  })

  it('rejects email step without message', () => {
    const r = sequenceStep.safeParse({
      type: 'email',
      subject: 'Hi',
    })
    expect(r.success).toBe(false)
  })

  it('rejects email step with empty subject', () => {
    const r = sequenceStep.safeParse({
      type: 'email',
      subject: '',
      message: 'Body',
    })
    expect(r.success).toBe(false)
  })

  it('rejects email step with empty message', () => {
    const r = sequenceStep.safeParse({
      type: 'email',
      subject: 'Hi',
      message: '',
    })
    expect(r.success).toBe(false)
  })

  it('accepts email step with optional emailAccountId and markAsManual', () => {
    const r = sequenceStep.safeParse({
      type: 'email',
      subject: 'Hi',
      message: 'Body',
      emailAccountId: 'acc_123',
      markAsManual: true,
    })
    expect(r.success).toBe(true)
  })

  it('accepts email step with emailAccountId=null (pool fallback)', () => {
    const r = sequenceStep.safeParse({
      type: 'email',
      subject: 'Hi',
      message: 'Body',
      emailAccountId: null,
    })
    expect(r.success).toBe(true)
  })
})

describe('sequenceStep — connection_request', () => {
  it('accepts with no message (LinkedIn invitations can be note-less)', () => {
    const r = sequenceStep.safeParse({ type: 'connection_request' })
    expect(r.success).toBe(true)
  })

  it('accepts with a message', () => {
    const r = sequenceStep.safeParse({
      type: 'connection_request',
      message: "Hi {{firstName}}, let's connect.",
    })
    expect(r.success).toBe(true)
  })
})

describe('sequenceStep — chat_message', () => {
  it('rejects without message (chat is meaningless empty)', () => {
    const r = sequenceStep.safeParse({ type: 'chat_message' })
    expect(r.success).toBe(false)
  })

  it('rejects empty message', () => {
    const r = sequenceStep.safeParse({ type: 'chat_message', message: '' })
    expect(r.success).toBe(false)
  })

  it('accepts with a real message', () => {
    const r = sequenceStep.safeParse({ type: 'chat_message', message: 'Hey.' })
    expect(r.success).toBe(true)
  })
})

describe('sequenceStep — visit_profile', () => {
  it('accepts on its own', () => {
    const r = sequenceStep.safeParse({ type: 'visit_profile' })
    expect(r.success).toBe(true)
  })

  it('accepts with linkedinAccountId', () => {
    const r = sequenceStep.safeParse({
      type: 'visit_profile',
      linkedinAccountId: 'li_acc_1',
    })
    expect(r.success).toBe(true)
  })
})

describe('sequenceStep — wait_until_accepted', () => {
  it('accepts on its own', () => {
    const r = sequenceStep.safeParse({ type: 'wait_until_accepted' })
    expect(r.success).toBe(true)
  })
})

describe('sequenceStep — whatsapp_message', () => {
  it('accepts a minimal whatsapp_message step', () => {
    const r = sequenceStep.safeParse({ type: 'whatsapp_message', message: 'Hi {{firstName}}' })
    expect(r.success).toBe(true)
  })

  it('rejects without message', () => {
    const r = sequenceStep.safeParse({ type: 'whatsapp_message' })
    expect(r.success).toBe(false)
  })

  it('rejects empty message', () => {
    const r = sequenceStep.safeParse({ type: 'whatsapp_message', message: '' })
    expect(r.success).toBe(false)
  })

  it('accepts with waitDays', () => {
    const r = sequenceStep.safeParse({ type: 'whatsapp_message', message: 'Hey!', waitDays: 2 })
    expect(r.success).toBe(true)
  })
})

describe('sequenceStep — unknown types', () => {
  it('rejects an unknown type', () => {
    const r = sequenceStep.safeParse({ type: 'sms', message: 'Hi' })
    expect(r.success).toBe(false)
  })

  it('rejects when type is missing', () => {
    const r = sequenceStep.safeParse({ message: 'Hi' })
    expect(r.success).toBe(false)
  })
})

// ─── sequenceSteps (array form) ───────────────────────────────────────────────

describe('sequenceSteps', () => {
  it('accepts an empty array (API layer enforces "at least one")', () => {
    const r = sequenceSteps.safeParse([])
    expect(r.success).toBe(true)
  })

  it('accepts a multi-step sequence with mixed types', () => {
    const r = sequenceSteps.safeParse([
      { type: 'connection_request', waitDays: 0, message: 'Connect' },
      { type: 'wait', waitDays: 3 },
      { type: 'chat_message', message: 'Hi {{firstName}}' },
      { type: 'wait', waitDays: 2 },
      { type: 'email', subject: 'Following up', message: 'Body' },
    ])
    expect(r.success).toBe(true)
  })

  it('fails the whole array when one step is invalid', () => {
    const r = sequenceSteps.safeParse([
      { type: 'wait', waitDays: 2 },
      { type: 'email', subject: 'Hi' }, // missing message
    ])
    expect(r.success).toBe(false)
  })
})

// ─── validateSteps helper ─────────────────────────────────────────────────────

describe('validateSteps', () => {
  it('returns the parsed steps when valid', () => {
    const out = validateSteps([{ type: 'wait', waitDays: 1 }])
    expect(out).toHaveLength(1)
    expect(out[0].type).toBe('wait')
  })

  it('throws with a human-readable message on invalid input', () => {
    expect(() =>
      validateSteps([{ type: 'email', subject: 'Hi' }])
    ).toThrow(/Invalid step/)
  })

  it('reports the invalid path in the error message', () => {
    let caught: unknown
    try {
      validateSteps([
        { type: 'wait', waitDays: 1 },
        { type: 'email', subject: '', message: 'Body' },
      ])
    } catch (e) {
      caught = e
    }
    expect(String(caught)).toMatch(/subject/i)
  })

  it('rejects entirely non-array input', () => {
    expect(() => validateSteps('not an array' as unknown)).toThrow()
    expect(() => validateSteps(null as unknown)).toThrow()
    expect(() => validateSteps(undefined as unknown)).toThrow()
  })
})

// ─── round-trip with realistic UI payloads ────────────────────────────────────

describe('round-trip — realistic payloads from the UI', () => {
  it('accepts the canonical legacy 3-step LinkedIn outreach', () => {
    const r = sequenceSteps.safeParse([
      { id: 'step_1', type: 'visit_profile', name: 'Warm up', waitDays: 0 },
      { id: 'step_2', type: 'connection_request', name: 'Invite', waitDays: 1, message: 'Hi {{firstName}}' },
      { id: 'step_3', type: 'wait', name: 'Wait', waitDays: 3 },
      { id: 'step_4', type: 'chat_message', name: 'Follow up', waitDays: 0, message: 'Following up' },
    ])
    expect(r.success).toBe(true)
  })

  it('accepts a multichannel email + LinkedIn flow', () => {
    const r = sequenceSteps.safeParse([
      { id: 's1', type: 'email', name: 'Intro', waitDays: 0, subject: 'Quick intro', message: 'Hi {{firstName}}' },
      { id: 's2', type: 'wait', name: 'Wait', waitDays: 3 },
      { id: 's3', type: 'connection_request', name: 'Connect', waitDays: 0, message: 'Hi {{firstName}}' },
      { id: 's4', type: 'wait_until_accepted', name: 'Wait until accepted', waitDays: 0 },
      { id: 's5', type: 'chat_message', name: 'Chat', waitDays: 0, message: 'Saw you accepted!' },
    ])
    expect(r.success).toBe(true)
  })

  it('accepts a multichannel email + WhatsApp flow', () => {
    const r = sequenceSteps.safeParse([
      { id: 's1', type: 'email', name: 'Intro email', waitDays: 0, subject: 'Quick intro', message: 'Hi {{firstName}}' },
      { id: 's2', type: 'wait', name: 'Wait', waitDays: 2 },
      { id: 's3', type: 'whatsapp_message', name: 'WhatsApp follow-up', waitDays: 0, message: 'Hi {{firstName}}, following up on my email!' },
    ])
    expect(r.success).toBe(true)
  })
})
