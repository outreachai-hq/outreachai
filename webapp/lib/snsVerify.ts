// Verification for AWS SNS HTTP(S) messages.
// https://docs.aws.amazon.com/sns/latest/dg/sns-verify-signature-of-message.html
import crypto from 'crypto'

export interface SnsMessage {
  Type: string
  MessageId: string
  TopicArn: string
  Message: string
  Timestamp: string
  Signature: string
  SignatureVersion: string
  SigningCertURL: string
  Subject?: string
  SubscribeURL?: string
  Token?: string
}

const SNS_HOST = /^sns\.[a-z0-9-]+\.amazonaws\.com(\.cn)?$/

/** True only for https URLs served by Amazon SNS itself. */
export function isSnsUrl(raw: string | undefined, { pem = false } = {}): boolean {
  if (!raw) return false
  try {
    const u = new URL(raw)
    return u.protocol === 'https:' && SNS_HOST.test(u.hostname) && (!pem || u.pathname.endsWith('.pem'))
  } catch {
    return false
  }
}

function stringToSign(m: SnsMessage): string | null {
  const keys =
    m.Type === 'Notification'
      ? ['Message', 'MessageId', 'Subject', 'Timestamp', 'TopicArn', 'Type']
      : m.Type === 'SubscriptionConfirmation' || m.Type === 'UnsubscribeConfirmation'
        ? ['Message', 'MessageId', 'SubscribeURL', 'Timestamp', 'Token', 'TopicArn', 'Type']
        : null
  if (!keys) return null
  let out = ''
  for (const k of keys) {
    const v = (m as unknown as Record<string, unknown>)[k]
    if (v === undefined || v === null) {
      if (k === 'Subject') continue // optional for notifications
      return null
    }
    out += `${k}\n${v}\n`
  }
  return out
}

const certCache = new Map<string, string>()

async function fetchCert(url: string): Promise<string> {
  const cached = certCache.get(url)
  if (cached) return cached
  const res = await fetch(url)
  if (!res.ok) throw new Error(`cert fetch failed: ${res.status}`)
  const pem = await res.text()
  certCache.set(url, pem)
  return pem
}

export async function verifySnsMessage(m: SnsMessage): Promise<boolean> {
  try {
    if (!isSnsUrl(m.SigningCertURL, { pem: true })) return false
    const algo = m.SignatureVersion === '1' ? 'RSA-SHA1' : m.SignatureVersion === '2' ? 'RSA-SHA256' : null
    if (!algo) return false
    const toSign = stringToSign(m)
    if (!toSign) return false
    const cert = await fetchCert(m.SigningCertURL)
    return crypto.verify(algo, Buffer.from(toSign, 'utf8'), cert, Buffer.from(m.Signature, 'base64'))
  } catch {
    return false
  }
}
