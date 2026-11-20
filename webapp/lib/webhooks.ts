import { createHmac } from 'crypto'
import { prisma } from '@/lib/prisma'

export const WEBHOOK_EVENTS = [
  'email.opened',
  'email.clicked',
  'email.replied',
  'lead.created',
  'campaign.launched',
] as const

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number]

// Fire-and-forget — never await this from a request handler
export function fireWebhook(userId: string, event: WebhookEvent, payload: Record<string, unknown>): void {
  void _dispatch(userId, event, payload)
}

async function _dispatch(userId: string, event: WebhookEvent, payload: Record<string, unknown>) {
  let endpoints: { id: string; url: string; secret: string | null }[]
  try {
    endpoints = await prisma.webhookEndpoint.findMany({
      where: { userId, active: true, events: { contains: event } },
      select: { id: true, url: true, secret: true },
    })
  } catch { return }

  if (endpoints.length === 0) return

  const body = JSON.stringify({ event, data: payload, timestamp: Date.now() })
  await Promise.allSettled(endpoints.map(ep => _deliver(ep, event, body)))
}

async function _deliver(ep: { id: string; url: string; secret: string | null }, event: string, body: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent':   'OutReachAI-Webhook/1.0',
  }
  if (ep.secret) {
    headers['X-Webhook-Signature'] = `sha256=${createHmac('sha256', ep.secret).update(body).digest('hex')}`
  }

  let statusCode: number | null = null
  let status = 'failed'
  try {
    const res = await fetch(ep.url, { method: 'POST', headers, body, signal: AbortSignal.timeout(10_000) })
    statusCode = res.status
    status = res.ok ? 'success' : 'failed'
  } catch { /* network error — status stays failed */ }

  try {
    await prisma.webhookDelivery.create({
      data: { endpointId: ep.id, event, payload: body, status, statusCode, attempts: 1 },
    })
  } catch { /* delivery log failure must never crash */ }
}
