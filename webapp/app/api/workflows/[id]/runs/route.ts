import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET — paginated run log, default limit 20
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id
  const { id } = await params

  // Verify workflow belongs to user
  const workflow = await prisma.workflow.findFirst({ where: { id, userId }, select: { id: true } })
  if (!workflow) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const limit = Math.min(Number(searchParams.get('limit') ?? 20), 100)
  const cursor = searchParams.get('cursor') ?? undefined

  const runs = await prisma.workflowRun.findMany({
    where: { workflowId: id },
    orderBy: { createdAt: 'desc' },
    take: limit,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      result: true,
      actionsRun: true,
      entityId: true,
      entityType: true,
      error: true,
      createdAt: true,
      payload: true,
    },
  })

  const nextCursor = runs.length === limit ? runs[runs.length - 1].id : null

  return NextResponse.json({ runs, nextCursor })
}
