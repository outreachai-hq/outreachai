import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/getUserId'

export async function GET(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const messages = await prisma.emailMessage.findMany({
    where: { userId },
    orderBy: { sentAt: 'desc' },
    select: { id: true, to: true, subject: true, status: true, sentAt: true, openedAt: true, repliedAt: true },
    take: 100,
  })
  return NextResponse.json({ messages })
}
