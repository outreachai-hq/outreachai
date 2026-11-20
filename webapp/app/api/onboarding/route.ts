import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  const [user, emailAccount, leadListWithLeads, campaign, emailMessage, warmupAccount] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { onboardingCompleted: true, onboardingStep: true },
      }),
      prisma.emailAccount.findFirst({ where: { userId } }),
      prisma.leadList.findFirst({
        where: { userId },
        include: { leads: { take: 1 } },
      }),
      prisma.campaign.findFirst({ where: { userId } }),
      prisma.emailMessage.findFirst({ where: { userId } }),
      prisma.warmupAccount.findFirst({ where: { userId } }),
    ])

  const steps = [
    { id: 1, label: 'Connect your email account',    href: '/settings',       done: !!emailAccount },
    { id: 2, label: 'Import your first leads',        href: '/leads',          done: !!(leadListWithLeads && leadListWithLeads.leads.length > 0) },
    { id: 3, label: 'Create a campaign sequence',     href: '/campaigns/new',  done: !!campaign },
    { id: 4, label: 'Send your first email',          href: '/campaigns',      done: !!emailMessage },
    { id: 5, label: 'Set up email warmup',            href: '/warmup',         done: !!warmupAccount },
  ]

  return NextResponse.json({
    onboardingCompleted: user?.onboardingCompleted ?? false,
    onboardingStep: user?.onboardingStep ?? 0,
    steps,
  })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  const body = await req.json()
  const step = typeof body.step === 'number' ? body.step : 0

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      onboardingStep: step,
      onboardingCompleted: step >= 5,
    },
    select: { onboardingStep: true, onboardingCompleted: true },
  })

  return NextResponse.json(updated)
}
