import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { safeDecrypt } from '@/lib/encryption'
import { Activity } from '@/lib/activity'
import { runWorkflowsForEvent } from '@/lib/workflowEngine'

// Extract the bare phone digits from a WhatsApp JID.
// "919876543210@s.whatsapp.net" → "919876543210"
// "919876543210"               → "919876543210"
function jidToPhone(jid: string): string {
  return jid.replace(/@.*$/, '').replace(/\D/g, '')
}

// Flexible phone match: strip non-digits and compare suffixes (last 10 digits)
// so "+91 98765 43210", "9876543210", "919876543210" all match each other.
function phonesMatch(a: string, b: string): boolean {
  const da = a.replace(/\D/g, '')
  const db = b.replace(/\D/g, '')
  if (!da || !db) return false
  const len = Math.min(da.length, db.length, 10)
  return da.slice(-len) === db.slice(-len)
}

function verifySignature(body: string, secret: string, header: string | null): boolean {
  if (!secret || !header) return !secret // allow through if no secret configured
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(header))
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Support both envelope formats from wa-tracker / mfapis-v2
  // Format A (user-configured webhooks): { event, data, org_id, timestamp }
  // Format B (Rails periskope format):   { provider_name, webhook_event: { event_type, data } }
  let eventType: string
  let data: Record<string, unknown>

  if (payload.provider_name === 'periskope' && payload.webhook_event) {
    const we = payload.webhook_event as Record<string, unknown>
    eventType = we.event_type as string
    data = (we.data ?? {}) as Record<string, unknown>
  } else {
    eventType = payload.event as string
    data = (payload.data ?? {}) as Record<string, unknown>
  }

  if (!eventType || !data) return NextResponse.json({ ok: true }) // ignore malformed

  // Identify which user owns this org_phone
  const orgPhone = (data.org_phone as string | undefined) ?? ''
  if (!orgPhone) return NextResponse.json({ ok: true })

  const orgPhoneDigits = jidToPhone(orgPhone)

  // Find user whose waPhone matches the org_phone
  const users = await prisma.user.findMany({
    where: { waPhone: { not: null } },
    select: { id: true, waPhone: true, waWebhookSecret: true },
  })
  const user = users.find(u => phonesMatch(u.waPhone ?? '', orgPhoneDigits))
  if (!user) return NextResponse.json({ ok: true }) // no matching user, silently OK

  // Verify HMAC signature
  const secret = user.waWebhookSecret ? (safeDecrypt(user.waWebhookSecret) ?? '') : ''
  const sig = req.headers.get('x-periskope-signature')
  if (!verifySignature(rawBody, secret, sig)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // Only handle inbound messages (from_me = false)
  if (eventType !== 'message.created' && eventType !== 'org.message.new') {
    return NextResponse.json({ ok: true })
  }

  const fromMe = (data.from_me ?? data.fromMe) as boolean | undefined
  if (fromMe) return NextResponse.json({ ok: true })

  const chatId = (data.chat_id ?? data.chatId) as string | undefined
  const body   = (data.body ?? data.text) as string | null | undefined
  if (!chatId) return NextResponse.json({ ok: true })

  const senderPhone = jidToPhone(chatId)

  // Find the lead by phone number
  const leads = await prisma.lead.findMany({
    where: { phone: { not: null }, leadList: { userId: user.id } },
    select: {
      id: true, phone: true, firstName: true,
      campaignLeads: {
        where: { status: { in: ['pending', 'in_progress'] }, campaign: { status: 'active', userId: user.id } },
        select: { id: true, campaign: { select: { id: true } } },
        take: 1,
      },
    },
  })

  const lead = leads.find(l => phonesMatch(l.phone ?? '', senderPhone))
  if (!lead) return NextResponse.json({ ok: true })

  // Log activity
  Activity.whatsappReplied({ userId: user.id, leadId: lead.id, phone: senderPhone }).catch(() => {})

  // Auto-stop any active campaign leads for this lead
  const activeCl = lead.campaignLeads?.[0]
  if (activeCl) {
    await prisma.campaignLead.update({
      where: { id: activeCl.id },
      data: { status: 'replied', autoStopped: true, stoppedReason: 'reply', nextActionAt: null },
    }).catch(() => {})
    Activity.statusChanged({
      userId: user.id,
      leadId: lead.id,
      from: 'pending',
      to: 'replied',
    }).catch(() => {})
    runWorkflowsForEvent('lead.replied', user.id, {
      leadId: lead.id, campaignId: activeCl.campaign.id,
    }).catch(() => {})
  }

  // Create or update a Conversation so the message appears in the inbox
  const messageText = (data.body ?? data.text) as string | null | undefined
  const now = new Date()

  let conversation = await prisma.conversation.findFirst({
    where: { userId: user.id, channel: 'whatsapp', smsPhone: senderPhone },
    select: { id: true },
  })

  if (conversation) {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: now, lastSenderIsMe: false, unread: true },
    })
  } else {
    const leadFull = await prisma.lead.findUnique({
      where: { id: lead.id },
      select: { firstName: true, lastName: true },
    })
    conversation = await prisma.conversation.create({
      data: {
        userId: user.id,
        leadId: lead.id,
        channel: 'whatsapp',
        smsPhone: senderPhone,
        participantName: [leadFull?.firstName, leadFull?.lastName].filter(Boolean).join(' ') || senderPhone,
        participantEmail: senderPhone,
        lastMessageAt: now,
        lastSenderIsMe: false,
        unread: true,
      },
      select: { id: true },
    })
  }

  if (messageText) {
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: 'in',
        body: messageText,
        sentAt: now,
      },
    }).catch(() => {})
  }

  runWorkflowsForEvent('conversation.reply_received', user.id, {
    conversationId: conversation.id,
    channel: 'whatsapp',
    leadId: lead.id,
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
