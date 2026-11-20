import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { POST } from '@/app/api/webhooks/email-bounce/route'
import { verifySnsMessage } from '@/lib/snsVerify'

vi.mock('@/lib/snsVerify', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/snsVerify')>()
  return { ...actual, verifySnsMessage: vi.fn().mockResolvedValue(true) }
})

function makeRequest(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/webhooks/email-bounce', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(verifySnsMessage).mockResolvedValue(true)
  vi.mocked(prisma.emailMessage.findMany).mockResolvedValue([])
  vi.mocked(prisma.marketingCampaignSend.findMany).mockResolvedValue([])
  vi.mocked(prisma.unsubscribe.upsert).mockResolvedValue({} as any)
  vi.mocked(prisma.emailMessage.updateMany).mockResolvedValue({ count: 0 } as any)
  vi.mocked(prisma.marketingCampaignSend.updateMany).mockResolvedValue({ count: 0 } as any)
})

// ── SendGrid ──────────────────────────────────────────────────────────────────

describe('POST /api/webhooks/email-bounce — SendGrid', () => {
  it('suppresses a bounced email from SendGrid payload', async () => {
    vi.mocked(prisma.emailMessage.findMany).mockResolvedValueOnce([
      { userId: 'user_1' } as any,
    ])

    const events = [
      { event: 'bounce', email: 'bad@example.com', reason: '550 No such user' },
      { event: 'open',   email: 'good@example.com' }, // non-bounce — ignored
    ]
    const res = await POST(makeRequest(events))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.suppressed).toBe(1)

    const upsertCall = vi.mocked(prisma.unsubscribe.upsert).mock.calls[0]?.[0] as any
    expect(upsertCall.create.email).toBe('bad@example.com')
  })

  it('suppresses blocked and dropped events too', async () => {
    vi.mocked(prisma.emailMessage.findMany).mockResolvedValue([{ userId: 'u1' } as any])

    const events = [
      { event: 'blocked', email: 'blocked@x.com' },
      { event: 'dropped', email: 'dropped@x.com' },
    ]
    const res = await POST(makeRequest(events))
    const json = await res.json()
    expect(json.suppressed).toBe(2)
  })

  it('ignores open/click/delivered events', async () => {
    const events = [
      { event: 'open',      email: 'a@x.com' },
      { event: 'click',     email: 'b@x.com' },
      { event: 'delivered', email: 'c@x.com' },
    ]
    const res = await POST(makeRequest(events))
    const json = await res.json()
    expect(json.suppressed).toBe(0)
    expect(vi.mocked(prisma.unsubscribe.upsert)).not.toHaveBeenCalled()
  })

  it('normalises email to lowercase before suppressing', async () => {
    vi.mocked(prisma.emailMessage.findMany).mockResolvedValueOnce([{ userId: 'u1' } as any])

    const events = [{ event: 'bounce', email: 'BadAddress@Example.COM' }]
    await POST(makeRequest(events))

    const upsertCall = vi.mocked(prisma.unsubscribe.upsert).mock.calls[0]?.[0] as any
    expect(upsertCall.create.email).toBe('badaddress@example.com')
  })

  it('deduplicates the same address appearing multiple times', async () => {
    vi.mocked(prisma.emailMessage.findMany).mockResolvedValue([{ userId: 'u1' } as any])

    const events = [
      { event: 'bounce', email: 'dup@x.com' },
      { event: 'bounce', email: 'dup@x.com' },
      { event: 'bounce', email: 'dup@x.com' },
    ]
    const res = await POST(makeRequest(events))
    const json = await res.json()
    expect(json.suppressed).toBe(1)
  })
})

// ── AWS SES via SNS ───────────────────────────────────────────────────────────

describe('POST /api/webhooks/email-bounce — AWS SES (SNS)', () => {
  it('suppresses a bounced email from SES Bounce notification', async () => {
    vi.mocked(prisma.emailMessage.findMany).mockResolvedValueOnce([{ userId: 'u1' } as any])

    const snsPayload = {
      Type: 'Notification',
      Message: JSON.stringify({
        notificationType: 'Bounce',
        bounce: {
          bounceType: 'Permanent',
          bouncedRecipients: [
            { emailAddress: 'ses-bounce@example.com' },
          ],
        },
      }),
    }
    const res = await POST(makeRequest(snsPayload))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.suppressed).toBe(1)

    const upsertCall = vi.mocked(prisma.unsubscribe.upsert).mock.calls[0]?.[0] as any
    expect(upsertCall.create.email).toBe('ses-bounce@example.com')
  })

  it('responds 200 to SNS SubscriptionConfirmation without suppressing', async () => {
    const snsPayload = {
      Type: 'SubscriptionConfirmation',
      SubscribeURL: 'https://sns.us-east-1.amazonaws.com/?Action=ConfirmSubscription&Token=abc',
      Token: 'abc',
    }
    // fetch is called to confirm subscription — mock it
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({ ok: true } as any)

    const res = await POST(makeRequest(snsPayload))
    expect(res.status).toBe(200)
    expect(vi.mocked(prisma.unsubscribe.upsert)).not.toHaveBeenCalled()
    expect(fetchSpy).toHaveBeenCalledWith('https://sns.us-east-1.amazonaws.com/?Action=ConfirmSubscription&Token=abc')

    fetchSpy.mockRestore()
  })

  it('ignores non-Bounce SES notification types', async () => {
    const snsPayload = {
      Type: 'Notification',
      Message: JSON.stringify({ notificationType: 'Delivery' }),
    }
    const res = await POST(makeRequest(snsPayload))
    const json = await res.json()
    expect(json.suppressed).toBe(0)
    expect(vi.mocked(prisma.unsubscribe.upsert)).not.toHaveBeenCalled()
  })
})

// ── Auth guard ────────────────────────────────────────────────────────────────

describe('POST /api/webhooks/email-bounce — HTTP Basic Auth', () => {
  it('returns 401 when Basic Auth is configured and header is missing', async () => {
    process.env.EMAIL_BOUNCE_WEBHOOK_USER = 'user'
    process.env.EMAIL_BOUNCE_WEBHOOK_PASS = 'pass'

    const res = await POST(makeRequest([{ event: 'bounce', email: 'x@x.com' }]))
    expect(res.status).toBe(401)

    delete process.env.EMAIL_BOUNCE_WEBHOOK_USER
    delete process.env.EMAIL_BOUNCE_WEBHOOK_PASS
  })

  it('passes through when Basic Auth header is correct', async () => {
    process.env.EMAIL_BOUNCE_WEBHOOK_USER = 'user'
    process.env.EMAIL_BOUNCE_WEBHOOK_PASS = 'pass'
    vi.mocked(prisma.emailMessage.findMany).mockResolvedValueOnce([{ userId: 'u1' } as any])

    const creds = Buffer.from('user:pass').toString('base64')
    const res = await POST(makeRequest(
      [{ event: 'bounce', email: 'ok@x.com' }],
      { Authorization: `Basic ${creds}` }
    ))
    expect(res.status).toBe(200)

    delete process.env.EMAIL_BOUNCE_WEBHOOK_USER
    delete process.env.EMAIL_BOUNCE_WEBHOOK_PASS
  })
})

// ── Edge cases ────────────────────────────────────────────────────────────────

describe('POST /api/webhooks/email-bounce — edge cases', () => {
  it('returns 400 for invalid JSON body', async () => {
    const req = new NextRequest('http://localhost/api/webhooks/email-bounce', {
      method: 'POST',
      body: 'not-json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('marks EmailMessage records as bounced', async () => {
    vi.mocked(prisma.emailMessage.findMany).mockResolvedValueOnce([{ userId: 'u1' } as any])

    await POST(makeRequest([{ event: 'bounce', email: 'mark@x.com' }]))

    const updateCall = vi.mocked(prisma.emailMessage.updateMany).mock.calls[0]?.[0] as any
    expect(updateCall.where.to).toBe('mark@x.com')
    expect(updateCall.data.status).toBe('bounced')
  })

  it('marks MarketingCampaignSend records as bounced', async () => {
    vi.mocked(prisma.emailMessage.findMany).mockResolvedValueOnce([])
    vi.mocked(prisma.marketingCampaignSend.findMany).mockResolvedValueOnce([
      { campaign: { userId: 'u2' } } as any,
    ])

    await POST(makeRequest([{ event: 'bounce', email: 'mkt@x.com' }]))

    const updateCall = vi.mocked(prisma.marketingCampaignSend.updateMany).mock.calls[0]?.[0] as any
    expect(updateCall.where.leadEmail).toBe('mkt@x.com')
    expect(updateCall.data.status).toBe('bounced')
  })
})

// ── Authentication ────────────────────────────────────────────────────────────

describe('POST /api/webhooks/email-bounce — authentication', () => {
  it('rejects SNS messages with an invalid AWS signature', async () => {
    vi.mocked(verifySnsMessage).mockResolvedValueOnce(false)
    const res = await POST(makeRequest({
      Type: 'Notification',
      Message: JSON.stringify({ notificationType: 'Bounce', bounce: { bounceType: 'Permanent', bouncedRecipients: [{ emailAddress: 'victim@example.com' }] } }),
    }))
    expect(res.status).toBe(401)
    expect(prisma.unsubscribe.upsert).not.toHaveBeenCalled()
  })

  it('does not fetch a SubscribeURL that is not an AWS SNS host', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'))
    const res = await POST(makeRequest({
      Type: 'SubscriptionConfirmation',
      SubscribeURL: 'http://169.254.169.254/latest/meta-data/',
    }))
    expect(res.status).toBe(200)
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })

  it('rejects unsigned SendGrid events in production when no key or basic auth is set', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('SENDGRID_WEBHOOK_SECRET', '')
    try {
      const res = await POST(makeRequest([{ event: 'bounce', email: 'victim@example.com' }]))
      expect(res.status).toBe(401)
      expect(prisma.unsubscribe.upsert).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllEnvs()
    }
  })
})
