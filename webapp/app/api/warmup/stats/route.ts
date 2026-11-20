import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/getUserId'

export async function GET(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const accounts = await prisma.warmupAccount.findMany({
    where: { userId },
    select: {
      status:        true,
      totalSent:     true,
      totalReceived: true,
      totalReplied:  true,
    },
  })

  const totalSent     = accounts.reduce((s, a) => s + a.totalSent,     0)
  const totalReceived = accounts.reduce((s, a) => s + a.totalReceived, 0)
  const totalReplied  = accounts.reduce((s, a) => s + a.totalReplied,  0)
  const activeCount   = accounts.filter((a) => a.status === 'active').length

  return NextResponse.json({ totalSent, totalReceived, totalReplied, activeCount, totalAccounts: accounts.length })
}
