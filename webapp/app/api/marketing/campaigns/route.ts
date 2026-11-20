import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/getUserId'

export async function GET(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const campaigns = await prisma.marketingCampaign.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { sends: true } },
      emailAccount: { select: { id: true, name: true, email: true } },
      leadList: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json(campaigns)
}

export async function POST(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, subject, htmlBody, fromName, emailAccountId, recipientListId } = body

  if (!name || !subject || !htmlBody || !fromName || !emailAccountId || !recipientListId) {
    return NextResponse.json(
      { error: 'name, subject, htmlBody, fromName, emailAccountId, recipientListId are required' },
      { status: 400 }
    )
  }

  // Verify emailAccount and leadList belong to the user
  const [emailAccount, leadList] = await Promise.all([
    prisma.emailAccount.findFirst({ where: { id: emailAccountId, userId } }),
    prisma.leadList.findFirst({ where: { id: recipientListId, userId } }),
  ])

  if (!emailAccount) return NextResponse.json({ error: 'Email account not found' }, { status: 404 })
  if (!leadList) return NextResponse.json({ error: 'Lead list not found' }, { status: 404 })

  const campaign = await prisma.marketingCampaign.create({
    data: { userId, name, subject, htmlBody, fromName, emailAccountId, recipientListId },
  })

  return NextResponse.json(campaign, { status: 201 })
}
