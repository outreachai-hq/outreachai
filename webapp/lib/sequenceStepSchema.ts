// Plan 1 — Zod validator for Sequence.steps JSON.
//
// Step shape is a discriminated union by `type`. The runner already supports
// `email` and the LinkedIn types; this validator just makes the contract
// explicit at the API boundary so the UI can't write garbage.
//
// IMPORTANT: when adding a new step type, update this file AND lib/sequenceRunner.ts.

import { z } from 'zod'

const baseStep = z.object({
  id: z.string().min(1).optional(),       // optional for legacy rows; runner falls back to array index
  name: z.string().optional(),
  waitDays: z.number().int().min(0).max(365).default(0),
  waitHours: z.number().int().min(0).max(23).optional(),
})

const waitStep = baseStep.extend({
  type: z.literal('wait'),
})

const emailStep = baseStep.extend({
  type: z.literal('email'),
  subject: z.string().min(1, 'Email subject is required'),
  message: z.string().min(1, 'Email body is required'),
  emailAccountId: z.string().optional().nullable(),
  markAsManual: z.boolean().optional(),
})

const linkedInVisit = baseStep.extend({
  type: z.literal('visit_profile'),
  linkedinAccountId: z.string().optional().nullable(),
})

const linkedInInvite = baseStep.extend({
  type: z.literal('connection_request'),
  message: z.string().optional(),
  linkedinAccountId: z.string().optional().nullable(),
})

const linkedInChat = baseStep.extend({
  type: z.literal('chat_message'),
  message: z.string().min(1, 'LinkedIn message body is required'),
  linkedinAccountId: z.string().optional().nullable(),
})

const whatsappMessage = baseStep.extend({
  type: z.literal('whatsapp_message'),
  message: z.string().min(1, 'WhatsApp message body is required'),
})

const linkedInWaitAccepted = baseStep.extend({
  type: z.literal('wait_until_accepted'),
})

// Plan 6 — branching step. Evaluates `on` against the lead's history and
// jumps to ifTrueStepId / ifFalseStepId. Today we support 'opened' and
// 'replied' (read from EmailMessage / Conversation); 'clicked' / 'bounced' /
// 'accepted_invite' / 'custom' are stubs the runner will treat as "false".
const conditionStep = baseStep.extend({
  type:           z.literal('condition'),
  on:             z.enum(['opened', 'clicked', 'replied', 'bounced', 'accepted_invite', 'custom']),
  windowDays:     z.number().int().min(1).max(60).default(7),
  ifTrueStepId:   z.string().min(1),
  ifFalseStepId:  z.string().min(1),
})

export const sequenceStep = z.discriminatedUnion('type', [
  waitStep,
  emailStep,
  linkedInVisit,
  linkedInInvite,
  linkedInChat,
  linkedInWaitAccepted,
  conditionStep,
  whatsappMessage,
])

export const sequenceSteps = z.array(sequenceStep)

export type SequenceStepInput = z.infer<typeof sequenceStep>

/**
 * Helper: parses + normalizes a steps array; throws a flat-string error.
 * Use at the API boundary: `const steps = validateSteps(body.steps)`.
 */
export function validateSteps(input: unknown): SequenceStepInput[] {
  const r = sequenceSteps.safeParse(input)
  if (!r.success) {
    const first = r.error.issues[0]
    const path = first.path.length ? `[${first.path.join('.')}]` : ''
    throw new Error(`Invalid step${path}: ${first.message}`)
  }
  return r.data
}
