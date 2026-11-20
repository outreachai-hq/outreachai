import { prisma } from '@/lib/prisma'
import { safeDecrypt } from '@/lib/encryption'
import nodemailer from 'nodemailer'

// ── Pre-written warmup templates ─────────────────────────────────────────────

interface WarmupTemplate {
  subject: string
  body: string
}

const WARMUP_TEMPLATES: WarmupTemplate[] = [
  {
    subject: 'Quick check-in on the project',
    body: "Hi,\n\nJust wanted to check in and see how things are progressing on your end. We've been making good headway here and would love to sync up soon.\n\nLet me know if you have a few minutes this week.\n\nBest regards",
  },
  {
    subject: 'Following up from last week',
    body: "Hi,\n\nI wanted to follow up on our conversation from last week. I've had a chance to think through the points we discussed and have some thoughts I'd like to share.\n\nWould you be open to a brief call?\n\nThanks",
  },
  {
    subject: 'Thoughts on the Q3 strategy',
    body: "Hi,\n\nI've been reviewing our Q3 strategy and noticed a few areas where we might be able to improve our approach. I'd love to get your perspective on this before we finalize anything.\n\nCan we find 20 minutes this week?\n\nBest",
  },
  {
    subject: 'Re: our conversation yesterday',
    body: "Hi,\n\nThank you for the insightful conversation yesterday. I've been thinking about what you mentioned and believe there's a real opportunity here worth exploring further.\n\nLooking forward to connecting again soon.\n\nRegards",
  },
  {
    subject: 'A resource you might find useful',
    body: "Hi,\n\nI came across something recently that immediately made me think of you and the challenges you mentioned. I think it could offer some useful perspective for your team.\n\nHappy to share more details if you're interested.\n\nBest",
  },
  {
    subject: 'Industry trends worth discussing',
    body: "Hi,\n\nI've been following some interesting shifts in the industry lately and think they could have meaningful implications for how we plan for next quarter.\n\nWould love to get your take on it over a quick call.\n\nBest regards",
  },
  {
    subject: 'Checking in before the quarter ends',
    body: "Hi,\n\nAs we approach the end of the quarter I wanted to touch base and make sure we're aligned on priorities. A lot has changed recently and I want to ensure we're set up for a strong finish.\n\nLet me know your availability.\n\nThanks",
  },
  {
    subject: 'Collaboration opportunity',
    body: "Hi,\n\nI've been thinking about potential areas where our teams could collaborate more effectively. I believe there's a strong case for exploring this further together.\n\nAre you open to a conversation about it?\n\nBest",
  },
  {
    subject: 'Quick question about your workflow',
    body: "Hi,\n\nI had a quick question about your current workflow. I'm exploring some improvements on our end and your perspective would be incredibly valuable given your experience in this area.\n\nWould you have five minutes to share your thoughts?\n\nThanks",
  },
  {
    subject: 'Meeting recap and next steps',
    body: "Hi,\n\nThank you for making time earlier. I wanted to summarize what we covered and confirm the next steps we agreed on so we stay on track.\n\nPlease let me know if I've missed anything or if anything has changed.\n\nBest regards",
  },
  {
    subject: 'Interesting case study I thought you would appreciate',
    body: "Hi,\n\nI recently came across a case study that closely mirrors some of the challenges we've been discussing. The approach they took produced some impressive results.\n\nHappy to walk you through it if you're curious.\n\nBest",
  },
  {
    subject: 'Upcoming webinar you might enjoy',
    body: "Hi,\n\nThere's an upcoming webinar that covers some of the topics we've been exploring. I think it could provide some solid frameworks we could apply to our own situation.\n\nLet me know if you want the details.\n\nRegards",
  },
  {
    subject: 'Proposal feedback request',
    body: "Hi,\n\nI've put together a preliminary outline for the proposal we discussed and would really value your feedback before I take it any further.\n\nIf you have a moment to review it, I'd greatly appreciate your input.\n\nThanks",
  },
  {
    subject: 'End-of-year planning',
    body: "Hi,\n\nWith year-end approaching, I wanted to start thinking about our planning priorities. There are a few initiatives I believe we should consider locking in before the close of the year.\n\nCan we schedule some time to discuss?\n\nBest",
  },
  {
    subject: 'Sharing a quick update',
    body: "Hi,\n\nI wanted to share a quick update on where things stand with the initiative we talked about. Progress has been solid and I'm optimistic about where it's headed.\n\nLet's connect soon to keep the momentum going.\n\nBest regards",
  },
]

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

// ── Ramp schedule ─────────────────────────────────────────────────────────────

function getDailyLimit(currentDay: number, dailyTarget: number): number {
  if (currentDay < 7)  return Math.min(dailyTarget, 3)
  if (currentDay < 14) return Math.min(dailyTarget, 8)
  return Math.min(dailyTarget, 15)
}

// ── Core warmup cycle ─────────────────────────────────────────────────────────

export async function runWarmupCycle(
  warmupAccountId: string
): Promise<{ sent: number; errors: string[] }> {
  const errors: string[] = []

  // 1. Fetch the target WarmupAccount with its EmailAccount
  const warmupAccount = await prisma.warmupAccount.findUnique({
    where: { id: warmupAccountId },
    include: { emailAccount: true },
  })

  if (!warmupAccount) return { sent: 0, errors: ['WarmupAccount not found'] }
  if (warmupAccount.status !== 'active') return { sent: 0, errors: ['Warmup is paused'] }

  const account = warmupAccount.emailAccount
  if (!account.smtpHost || !account.smtpUser || !account.smtpPass) {
    return { sent: 0, errors: ['SMTP not configured on the linked email account'] }
  }

  // 2. Find partner warmup accounts (other accounts in the pool)
  const partners = await prisma.warmupAccount.findMany({
    where: {
      id: { not: warmupAccountId },
      status: 'active',
    },
    include: { emailAccount: true },
    take: 5,
  })

  // Need at least one partner to exchange with
  const totalAccounts = partners.length + 1
  if (totalAccounts < 2) {
    return { sent: 0, errors: ['Not enough warmup pool accounts'] }
  }

  // 3. Calculate today's send limit
  const limit = getDailyLimit(warmupAccount.currentDay, warmupAccount.dailyTarget)

  // 4. Send emails
  const smtpPass = safeDecrypt(account.smtpPass) ?? ''
  const transporter = nodemailer.createTransport({
    host:      account.smtpHost,
    port:      account.smtpPort ?? 587,
    secure:    (account.smtpPort ?? 587) === 465,
    auth:      { user: account.smtpUser, pass: smtpPass },
    ignoreTLS: account.smtpPort === 1025,
  })

  let sent = 0

  for (let i = 0; i < limit; i++) {
    const partner = pickRandom(partners)
    const template = pickRandom(WARMUP_TEMPLATES)

    try {
      const info = await transporter.sendMail({
        from:    `"${account.name}" <${account.email}>`,
        to:      partner.emailAccount.email,
        subject: template.subject,
        text:    template.body,
      })

      // Record sent email
      await prisma.warmupEmail.create({
        data: {
          warmupAccountId: warmupAccount.id,
          direction:       'sent',
          fromEmail:       account.email,
          toEmail:         partner.emailAccount.email,
          subject:         template.subject,
          body:            template.body,
          messageId:       info.messageId ?? null,
        },
      })

      sent++
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown SMTP error'
      errors.push(`Failed to send to ${partner.emailAccount.email}: ${msg}`)
    }
  }

  // 5. Update the WarmupAccount stats
  if (sent > 0 || errors.length === 0) {
    await prisma.warmupAccount.update({
      where: { id: warmupAccountId },
      data: {
        totalSent:  { increment: sent },
        lastRunAt:  new Date(),
        currentDay: { increment: 1 },
      },
    })
  }

  return { sent, errors }
}
