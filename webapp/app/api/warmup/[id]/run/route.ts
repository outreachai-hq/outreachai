import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/getUserId'
import { runWarmupCycle } from '@/lib/warmup'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Verify ownership
  const warmupAccount = await prisma.warmupAccount.findFirst({ where: { id, userId } })
  if (!warmupAccount) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const result = await runWarmupCycle(id)
  return NextResponse.json(result)
}
