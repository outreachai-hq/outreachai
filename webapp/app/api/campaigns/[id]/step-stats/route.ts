import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const campaign = await prisma.campaign.findFirst({
    where: { id, userId: session.user.id },
    include: {
      sequence: true,
      leads: { select: { currentStep: true, status: true } },
    },
  })
  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const steps = (campaign.sequence.steps ?? []) as Array<{ id?: string; type: string }>
  const totalLeads = campaign.leads.length

  const stats = await Promise.all(
    steps.map(async (step, idx) => {
      const atStep = campaign.leads.filter(
        (l) => l.currentStep === idx && (l.status === 'pending' || l.status === 'in_progress'),
      ).length
      const passedStep = campaign.leads.filter(
        (l) => l.currentStep > idx || l.status === 'completed' || l.status === 'replied',
      ).length

      let sent = 0
      let opened = 0
      let clicked = 0
      if (step.id) {
        const emailType = step.type === 'email' ? 'email.sent' : null
        const liType =
          step.type === 'connection_request' ? 'linkedin.invite_queued'
          : step.type === 'chat_message' ? 'linkedin.message_queued'
          : step.type === 'visit_profile' ? 'linkedin.visit_queued'
          : null
        const type = emailType ?? liType
        if (type) {
          sent = await prisma.leadActivity.count({
            where: { campaignId: id, sequenceStepId: step.id, type },
          })
        }
        ;[opened, clicked] = await Promise.all([
          prisma.leadActivity.count({ where: { campaignId: id, sequenceStepId: step.id, type: 'email.opened' } }),
          prisma.leadActivity.count({ where: { campaignId: id, sequenceStepId: step.id, type: 'email.clicked' } }),
        ])
      }

      return { stepIndex: idx, stepId: step.id, type: step.type, atStep, passedStep, sent, opened, clicked, totalLeads }
    }),
  )

  return NextResponse.json({ stats })
}
