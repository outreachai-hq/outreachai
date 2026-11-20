import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET — workflow with last 10 runs
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id
  const { id } = await params

  const workflow = await prisma.workflow.findFirst({
    where: { id, userId },
    include: {
      runs: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  })

  if (!workflow) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ workflow })
}

// PATCH { name?, active?, triggerKey?, conditions?, actions?, description? }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id
  const { id } = await params

  const existing = await prisma.workflow.findFirst({ where: { id, userId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const data: Record<string, unknown> = {}

  if (body.name !== undefined) data.name = body.name
  if (body.description !== undefined) data.description = body.description
  if (body.active !== undefined) data.active = Boolean(body.active)
  if (body.triggerKey !== undefined) data.triggerKey = body.triggerKey
  if (body.conditions !== undefined) data.conditions = body.conditions
  if (body.actions !== undefined) data.actions = body.actions

  const workflow = await prisma.workflow.update({ where: { id }, data })

  return NextResponse.json({ workflow })
}

// DELETE
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id
  const { id } = await params

  const existing = await prisma.workflow.findFirst({ where: { id, userId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.workflow.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
