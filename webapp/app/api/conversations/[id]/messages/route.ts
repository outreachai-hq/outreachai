// Plan 2 (Iter 12) — send a reply on a conversation.
//
// Channel-aware: routes to SMTP for email conversations and queues a
// LinkedInAction for LinkedIn conversations. SMS / WhatsApp not wired yet.

import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { safeDecrypt } from '@/lib/encryption'
import { classifyReplyIfNeeded } from '@/lib/classifyReply'
import { runWorkflowsForEvent } from '@/lib/workflowEngine'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const userId = session.user.id

  const conv = await prisma.conversation.findFirst({ where: { id, userId } })
  if (!conv) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const text = typeof body.body === 'string' ? body.body : ''
  if (!text.trim()) return NextResponse.json({ error: 'body required' }, { status: 400 })

  const direction: 'in' | 'out' = body.direction === 'in' ? 'in' : 'out'

  const now = new Date()

  // ── EMAIL ──────────────────────────────────────────────────────────────────
  if (conv.channel === 'email') {
    if (!conv.participantEmail) {
      return NextResponse.json({ error: 'Conversation has no recipient email' }, { status: 400 })
    }

    const account = await prisma.emailAccount.findFirst({
      where: { userId, isDefault: true, smtpHost: { not: null } },
    })
    if (!account?.smtpHost) {
      return NextResponse.json({ error: 'No default SMTP mailbox configured' }, { status: 400 })
    }

    // Persist EmailMessage so opens/clicks can be tracked under existing
    // tracking-pixel infra.
    const msg = await prisma.emailMessage.create({
      data: {
        userId,
        emailAccountId: account.id,
        to: conv.participantEmail,
        subject: conv.subject ? `Re: ${conv.subject.replace(/^re:\s*/i, '')}` : '(no subject)',
        body: text,
        status: 'sent',
      },
    })

    const transport = nodemailer.createTransport({
      host: account.smtpHost!,
      port: account.smtpPort ?? 587,
      secure: (account.smtpPort ?? 587) === 465,
      auth: { user: account.smtpUser!, pass: safeDecrypt(account.smtpPass) ?? '' },
    })

    try {
      await transport.sendMail({
        from: `"${account.name}" <${account.email}>`,
        to: conv.participantEmail,
        subject: conv.subject ? `Re: ${conv.subject.replace(/^re:\s*/i, '')}` : '(no subject)',
        text,
      })
    } catch (err) {
      // Roll back EmailMessage since the send failed
      await prisma.emailMessage.delete({ where: { id: msg.id } }).catch(() => {})
      return NextResponse.json(
        { error: `Failed to send: ${err instanceof Error ? err.message : 'SMTP error'}` },
        { status: 502 }
      )
    }

    const message = await prisma.message.create({
      data: {
        conversationId: conv.id,
        direction,
        body: text,
        externalId: msg.trackingId,
        sentAt: now,
      },
    })

    await prisma.conversation.update({
      where: { id: conv.id },
      data: { lastMessageAt: now, lastSenderIsMe: direction === 'out', unread: direction === 'in' },
    })

    if (direction === 'in') {
      classifyReplyIfNeeded(userId, conv.id).catch(() => {})
      runWorkflowsForEvent('conversation.reply_received', userId, {
        conversationId: id,
        channel: conv.channel,
        leadId: conv.leadId ?? undefined,
      }).catch(() => {})
    }

    return NextResponse.json({ message }, { status: 201 })
  }

  // ── LINKEDIN ───────────────────────────────────────────────────────────────
  if (conv.channel === 'linkedin') {
    if (!conv.linkedinProfileId) {
      return NextResponse.json({ error: 'Conversation has no LinkedIn profile id' }, { status: 400 })
    }

    const action = await prisma.linkedInAction.create({
      data: {
        userId,
        profileId: conv.linkedinProfileId,
        profileUrl: conv.participantUrl,
        actionType: 'chat_message',
        message: text,
      },
    })

    const message = await prisma.message.create({
      data: {
        conversationId: conv.id,
        direction,
        body: text,
        externalId: action.id,
        sentAt: now,
      },
    })

    await prisma.conversation.update({
      where: { id: conv.id },
      data: { lastMessageAt: now, lastSenderIsMe: direction === 'out', unread: direction === 'in' },
    })

    if (direction === 'in') {
      classifyReplyIfNeeded(userId, conv.id).catch(() => {})
      runWorkflowsForEvent('conversation.reply_received', userId, {
        conversationId: id,
        channel: conv.channel,
        leadId: conv.leadId ?? undefined,
      }).catch(() => {})
    }

    return NextResponse.json(
      { message, note: 'Queued for the Chrome extension to deliver on next LinkedIn page visit.' },
      { status: 201 }
    )
  }

  // ── WHATSAPP ───────────────────────────────────────────────────────────────
  if (conv.channel === 'whatsapp') {
    if (!conv.smsPhone) {
      return NextResponse.json({ error: 'Conversation has no WhatsApp phone number' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { waApiKey: true, waPhone: true, waBaseUrl: true },
    })
    const apiKey  = user?.waApiKey  ? (safeDecrypt(user.waApiKey)  ?? null) : null
    const phone   = user?.waPhone   ?? null
    const baseUrl = user?.waBaseUrl ?? null

    if (!apiKey || !phone || !baseUrl) {
      return NextResponse.json(
        { error: 'WhatsApp not configured — add credentials in Settings → WhatsApp' },
        { status: 400 }
      )
    }

    const chatId = `${conv.smsPhone}@s.whatsapp.net`

    const waRes = await fetch(`${baseUrl}/api/v2/wa/message/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'x-phone': phone,
      },
      body: JSON.stringify({ chat_id: chatId, message: text }),
    })

    if (!waRes.ok) {
      const err = await waRes.json().catch(() => ({}))
      return NextResponse.json(
        { error: err?.message ?? `mfapis error (${waRes.status})` },
        { status: 502 }
      )
    }

    const message = await prisma.message.create({
      data: {
        conversationId: conv.id,
        direction: 'out',
        body: text,
        sentAt: now,
      },
    })

    await prisma.conversation.update({
      where: { id: conv.id },
      data: { lastMessageAt: now, lastSenderIsMe: true, unread: false },
    })

    return NextResponse.json({ message }, { status: 201 })
  }

  return NextResponse.json(
    { error: `Replies on '${conv.channel}' channel are not yet supported` },
    { status: 501 }
  )
}
