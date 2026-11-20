import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET — list user's workflows, ordered by createdAt desc
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  const workflows = await prisma.workflow.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ workflows })
}

// POST { name, triggerKey, conditions?, actions?, description? } — create workflow
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  const body = await req.json().catch(() => ({}))
  const { name, triggerKey, conditions, actions, description } = body

  if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 })
  if (!triggerKey?.trim()) return NextResponse.json({ error: 'triggerKey is required' }, { status: 400 })

  const workflow = await prisma.workflow.create({
    data: {
      userId,
      name: name.trim(),
      description: description ?? null,
      triggerKey,
      conditions: conditions ?? [],
      actions: actions ?? [],
    },
  })

  return NextResponse.json({ workflow }, { status: 201 })
}
