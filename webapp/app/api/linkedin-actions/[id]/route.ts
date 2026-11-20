import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/getUserId'
import { Activity } from '@/lib/activity'

// PATCH — extension reports done or failed for a LinkedIn action
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { status, error } = body as { status: 'done' | 'failed'; error?: string }

  if (!['done', 'failed'].includes(status)) {
    return NextResponse.json({ error: 'status must be "done" or "failed"' }, { status: 400 })
  }

  const action = await prisma.linkedInAction.findFirst({ where: { id, userId } })
  if (!action) return NextResponse.json({ error: 'Action not found' }, { status: 404 })

  await prisma.linkedInAction.update({
    where: { id },
    data: { status, doneAt: new Date(), error: error ?? null },
  })

  // On success, advance the campaign lead to the next step
  if (status === 'done' && action.campaignLeadId) {
    const cl = await prisma.campaignLead.findUnique({
      where: { id: action.campaignLeadId },
      include: { campaign: { include: { sequence: true } } },
    })

    if (cl) {
      type Step = { waitDays?: number }
      const steps = (cl.campaign.sequence.steps ?? []) as Step[]
      const nextStep = steps[cl.currentStep + 1]

      await prisma.campaignLead.update({
        where: { id: cl.id },
        data: {
          currentStep: cl.currentStep + 1,
          status: nextStep ? 'pending' : 'completed',
          nextActionAt: nextStep
            ? new Date(Date.now() + (nextStep.waitDays ?? 1) * 86_400_000)
            : null,
        },
      })

      // Activity timeline — extension confirmed the action landed.
      Activity.linkedInDone({
        userId,
        leadId: cl.leadId,
        actionType: action.actionType,
        campaignId: cl.campaignId,
      }).catch(() => {})
    }
  }

  // On failure, mark the lead as failed
  if (status === 'failed' && action.campaignLeadId) {
    await prisma.campaignLead.update({
      where: { id: action.campaignLeadId },
      data: { status: 'pending' }, // retry on next batch run
    })
  }

  return NextResponse.json({ ok: true, actionId: id, status })
}
