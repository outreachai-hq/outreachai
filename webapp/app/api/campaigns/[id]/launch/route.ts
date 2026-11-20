import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { fireWebhook } from '@/lib/webhooks'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const campaign = await prisma.campaign.findFirst({
    where: { id, userId: session.user!.id },
    include: {
      leadList: { include: { leads: true } },
    },
  })

  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  if (campaign.status !== 'draft') {
    return NextResponse.json({ error: 'Campaign is not in draft status' }, { status: 400 })
  }

  const now = new Date()

  // Update campaign to active
  await prisma.campaign.update({
    where: { id },
    data: { status: 'active', launchedAt: now },
  })

  // Create CampaignLead rows for all leads in the list (skip already existing)
  const existingLeadIds = await prisma.campaignLead.findMany({
    where: { campaignId: id },
    select: { leadId: true },
  })
  const existingSet = new Set(existingLeadIds.map((cl) => cl.leadId))

  const newLeads = campaign.leadList.leads.filter((l) => !existingSet.has(l.id))

  if (newLeads.length > 0) {
    await prisma.campaignLead.createMany({
      data: newLeads.map((lead) => ({
        campaignId: id,
        leadId: lead.id,
        currentStep: 0,
        status: 'pending',
        nextActionAt: now,
      })),
    })
  }

  fireWebhook(session.user!.id, 'campaign.launched', {
    campaignId: id,
    name: campaign.name,
    leadsEnrolled: newLeads.length,
    launchedAt: now.toISOString(),
  })

  return NextResponse.json({ success: true, leadsEnrolled: newLeads.length })
}
