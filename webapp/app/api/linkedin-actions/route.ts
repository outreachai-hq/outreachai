import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/getUserId'

// GET — extension polls this to get pending LinkedIn actions for the current user
export async function GET(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const actions = await prisma.linkedInAction.findMany({
    where: { userId, status: 'pending' },
    orderBy: { createdAt: 'asc' },
    take: 10,
    select: {
      id: true,
      actionType: true,
      profileId: true,
      profileUrl: true,
      message: true,
      createdAt: true,
    },
  })

  // Mark returned actions as picked_up so they aren't returned again
  if (actions.length > 0) {
    await prisma.linkedInAction.updateMany({
      where: { id: { in: actions.map((a) => a.id) } },
      data: { status: 'picked_up', pickedUpAt: new Date() },
    })
  }

  return NextResponse.json({ actions })
}
