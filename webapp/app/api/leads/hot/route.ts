import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get all leads for this user's lead lists that have engagement
  const leadLists = await prisma.leadList.findMany({
    where: { userId: session.user.id },
    include: {
      leads: {
        where: {
          OR: [
            { score: { gt: 0 } },
            { status: 'replied' },
            { openCount: { gt: 0 } },
          ]
        },
        include: {
          campaignLeads: {
            include: { campaign: true },
            take: 1,
          }
        },
        orderBy: [{ score: 'desc' }, { openCount: 'desc' }],
        take: 50,
      }
    }
  })

  const leads = leadLists.flatMap(ll => ll.leads).map(lead => {
    const campaignLead = lead.campaignLeads[0]
    let signal = 'Lead added'
    if (lead.status === 'replied') signal = 'Replied to outreach'
    else if (lead.openCount >= 3) signal = `Opened email ${lead.openCount}x`
    else if (lead.openCount > 0) signal = 'Opened email'
    else if (lead.status === 'in_progress') signal = 'In active campaign'

    return {
      id: lead.id,
      firstName: lead.firstName,
      lastName: lead.lastName,
      company: lead.company,
      headline: lead.headline,
      linkedinUrl: lead.linkedinUrl,
      email: lead.email,
      score: lead.score,
      signal,
      status: lead.status,
      campaignName: campaignLead?.campaign?.name ?? null,
      lastActivityAt: lead.lastOpenedAt?.toISOString() ?? lead.createdAt.toISOString(),
    }
  })

  // Sort by score desc
  leads.sort((a, b) => b.score - a.score)

  return NextResponse.json(leads)
}
