import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const workspace = await prisma.workspace.findUnique({
    where: { id },
    include: {
      members: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
  })

  if (!workspace) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isMember = workspace.members.some((m) => m.userId === session.user!.id)
  if (!isMember && workspace.ownerId !== session.user!.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json(workspace)
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const workspace = await prisma.workspace.findUnique({ where: { id } })
  if (!workspace) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: id, userId: session.user.id } },
  })
  const isOwner = workspace.ownerId === session.user.id
  const role = isOwner ? 'owner' : member?.role

  if (role !== 'owner' && role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const updated = await prisma.workspace.update({ where: { id }, data: { name: name.trim() } })
  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const workspace = await prisma.workspace.findUnique({ where: { id } })
  if (!workspace) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: 'Only the owner can delete a workspace' }, { status: 403 })
  }

  // Reset all member active workspaces to null, then delete the workspace
  await prisma.$transaction(async (tx) => {
    const members = await tx.workspaceMember.findMany({ where: { workspaceId: id } })
    await tx.user.updateMany({
      where: { id: { in: members.map((m) => m.userId) }, workspaceId: id },
      data: { workspaceId: null },
    })
    await tx.workspace.delete({ where: { id } })
  })

  return NextResponse.json({ ok: true })
}
