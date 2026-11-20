import { describe, it, expect, vi, afterEach } from 'vitest'
import crypto from 'crypto'
import { verifySnsMessage, isSnsUrl, type SnsMessage } from '@/lib/snsVerify'

afterEach(() => vi.restoreAllMocks())

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
const pubPem = publicKey.export({ type: 'spki', format: 'pem' }).toString()

function signed(overrides: Partial<SnsMessage> = {}): SnsMessage {
  const m: SnsMessage = {
    Type: 'Notification',
    MessageId: 'm-1',
    TopicArn: 'arn:aws:sns:us-east-1:123456789012:ses-events',
    Message: '{"notificationType":"Bounce"}',
    Timestamp: '2026-01-01T00:00:00.000Z',
    SignatureVersion: '2',
    SigningCertURL: 'https://sns.us-east-1.amazonaws.com/SimpleNotificationService-abc.pem',
    Signature: '',
    ...overrides,
  }
  const toSign = ['Message', 'MessageId', 'Timestamp', 'TopicArn', 'Type']
    .map((k) => `${k}\n${(m as unknown as Record<string, string>)[k]}\n`).join('')
  m.Signature = crypto.sign('RSA-SHA256', Buffer.from(toSign), privateKey).toString('base64')
  return m
}

describe('isSnsUrl', () => {
  it('accepts only https Amazon SNS hosts', () => {
    expect(isSnsUrl('https://sns.ap-south-1.amazonaws.com/?Action=ConfirmSubscription')).toBe(true)
    expect(isSnsUrl('http://sns.ap-south-1.amazonaws.com/x')).toBe(false)
    expect(isSnsUrl('https://sns.us-east-1.amazonaws.com.evil.com/x.pem', { pem: true })).toBe(false)
    expect(isSnsUrl('https://evil.example.com/x.pem', { pem: true })).toBe(false)
  })
})

describe('verifySnsMessage', () => {
  it('accepts a correctly signed message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(pubPem))
    expect(await verifySnsMessage(signed())).toBe(true)
  })

  it('rejects a tampered message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(pubPem))
    const m = signed()
    m.Message = '{"notificationType":"Bounce","forged":true}'
    expect(await verifySnsMessage(m)).toBe(false)
  })

  it('never fetches a signing cert from a non-SNS host', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    expect(await verifySnsMessage(signed({ SigningCertURL: 'https://evil.example.com/cert.pem' }))).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
