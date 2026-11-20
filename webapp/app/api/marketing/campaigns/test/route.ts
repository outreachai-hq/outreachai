import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendViaAccount } from '@/lib/email/transport'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id || !session.user.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { campaignId } = await req.json()
  if (!campaignId) return NextResponse.json({ error: 'campaignId required' }, { status: 400 })

  try {
    const campaign = await prisma.marketingCampaign.findFirst({
      where: { id: campaignId, userId: session.user.id },
      include: { emailAccount: true, leadList: true },
    })

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    if (!campaign.emailAccount) {
      return NextResponse.json({ error: 'No email account configured' }, { status: 400 })
    }

    // Send test email to the current user
    const userEmail = session.user.email as string
    await sendViaAccount(campaign.emailAccount, {
      to: userEmail,
      subject: `[TEST] ${campaign.subject}`,
      html: campaign.htmlBody,
    })

    return NextResponse.json({
      message: `Test email sent to ${userEmail}!`,
      recipient: userEmail,
    })
  } catch (error) {
    const err = error instanceof Error ? error.message : String(error)
    console.error('[marketing-test-email]', err)
    return NextResponse.json(
      { error: `Failed to send test email: ${err}` },
      { status: 400 }
    )
  }
}
