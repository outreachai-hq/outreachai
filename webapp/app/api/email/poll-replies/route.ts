import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/getUserId'
import { safeDecrypt } from '@/lib/encryption'
import { recordInboundEmailReply } from '@/lib/conversationSync'
import { Activity } from '@/lib/activity'

export async function POST(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const emailAccountId: string | undefined = body.emailAccountId

  const accounts = await prisma.emailAccount.findMany({
    where: { userId, ...(emailAccountId ? { id: emailAccountId } : {}), imapHost: { not: null } },
  })

  if (accounts.length === 0)
    return NextResponse.json({ error: 'No IMAP-configured accounts found. Add imapHost/imapPort in Settings.' }, { status: 400 })

  let totalUpdated = 0

  for (const account of accounts) {
    try {
      // Dynamic import to avoid build-time issues with imapflow
      const { ImapFlow } = await import('imapflow')
      const client = new ImapFlow({
        host: account.imapHost!,
        port: account.imapPort ?? 993,
        secure: (account.imapPort ?? 993) === 993,
        auth: { user: account.smtpUser!, pass: safeDecrypt(account.smtpPass) ?? '' },
        logger: false,
      })

      await client.connect()
      const lock = await client.getMailboxLock('INBOX')
      try {
        // Find emails from the last 30 days that look like replies
        const sentEmails = await prisma.emailMessage.findMany({
          where: { userId, emailAccountId: account.id, status: 'sent' },
          select: { id: true, to: true, subject: true, status: true },
        })

        if (sentEmails.length > 0) {
          // Search for messages FROM any of our sent-to addresses
          for await (const msg of client.fetch({ since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, { envelope: true })) {
            const fromAddr = msg.envelope?.from?.[0]?.address?.toLowerCase() ?? ''
            const matchedEmail = sentEmails.find(e => e.to.toLowerCase() === fromAddr)
            if (matchedEmail && matchedEmail.status !== 'replied') {
              const receivedAt = msg.envelope?.date ?? new Date()
              await prisma.emailMessage.update({ where: { id: matchedEmail.id }, data: { status: 'replied', repliedAt: receivedAt } })
              totalUpdated++

              // Plan 2 dual-write: surface the reply on the new
              // Conversation/Message tables. Best-effort.
              let conversationId: string | undefined
              try {
                const r = await recordInboundEmailReply(userId, {
                  fromEmail: fromAddr,
                  subject: msg.envelope?.subject ?? matchedEmail.subject,
                  receivedAt,
                  externalId: msg.envelope?.messageId ?? msg.uid?.toString() ?? null,
                })
                conversationId = r.conversationId
              } catch (err) {
                console.error('[poll-replies] recordInboundEmailReply failed', err)
              }

              // Plan 4 — emit activity timeline entry for the reply.
              const lead = await prisma.lead.findFirst({
                where: { email: fromAddr, leadList: { userId } },
                select: { id: true },
              }).catch(() => null)
              if (lead) {
                Activity.emailReplied({
                  userId, leadId: lead.id, conversationId, messageId: matchedEmail.id,
                }).catch(() => {})
                const { recordLeadReply } = await import('@/lib/leadScore')
                recordLeadReply(lead.id).catch(() => {})
              }

              // Plan 8 — AI auto-draft a reply when the user has opted in.
              // Best-effort; failures don't block the reply detection itself.
              try {
                const userPrefs = await prisma.user.findUnique({
                  where: { id: userId },
                  select: { name: true, aiReplyAutoDraft: true },
                })
                if (userPrefs?.aiReplyAutoDraft === 'email' || userPrefs?.aiReplyAutoDraft === 'both') {
                  const { generateText } = await import('@/lib/ai')
                  const subj = msg.envelope?.subject ?? matchedEmail.subject
                  const replyText = await generateText(
                    `You are ${userPrefs.name ?? 'an SDR'} writing a short, friendly email reply. The prospect just replied to your earlier outreach.\n\nSubject of their reply: "${subj}"\n\nDraft a 2-3 sentence reply that acknowledges, adds value, and ends with a clear next step (a question or a calendar nudge). Output ONLY the body text — no subject line.`,
                    { userId, maxTokens: 200 },
                  )
                  await prisma.draftMessage.create({
                    data: {
                      userId,
                      channel:        'email',
                      subject:        subj?.startsWith('Re:') ? subj : `Re: ${subj}`,
                      body:           replyText.trim(),
                      conversationId: conversationId ?? null,
                      leadId:         lead?.id ?? null,
                      source:         'ai',
                      createdByAi:    true,
                      priority:       5,
                      aiPrompt:       'auto-draft on inbound reply',
                    },
                  })
                }
              } catch (err) {
                console.error('[poll-replies] AI auto-draft failed', err)
              }
            }
          }
        }
      } finally {
        lock.release()
      }
      await client.logout()
    } catch (err) {
      console.error(`IMAP error for account ${account.email}:`, err)
    }
  }

  return NextResponse.json({ checked: accounts.length, repliesFound: totalUpdated })
}

// Manual status update for a single message
export async function PATCH(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { messageId, status } = await req.json()
  if (!messageId || !status) return NextResponse.json({ error: 'messageId and status required' }, { status: 400 })

  await prisma.emailMessage.updateMany({
    where: { id: messageId, userId },
    data: { status, ...(status === 'replied' ? { repliedAt: new Date() } : {}), ...(status === 'opened' ? { openedAt: new Date() } : {}) },
  })

  return NextResponse.json({ ok: true })
}
