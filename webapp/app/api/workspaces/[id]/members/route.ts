import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/checkWorkspacePermission'
import type { WorkspaceRole } from '@/lib/getWorkspaceContext'

type Params = { params: Promise<{ id: string }> }

async function getCallerRole(workspaceId: string, userId: string) {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } })
  if (!workspace) return null
  if (workspace.ownerId === userId) return 'owner' as WorkspaceRole
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  })
  return (member?.role as WorkspaceRole) ?? null
}

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: workspaceId } = await params
  const role = await getCallerRole(workspaceId, session.user.id)
  if (!role) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { joinedAt: 'asc' },
  })

  return NextResponse.json(members)
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: workspaceId } = await params
  const callerRole = await getCallerRole(workspaceId, session.user.id)
  if (!callerRole) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { userId } = await req.json()
  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 })

  // Allow self-removal; otherwise require admin+
  const isSelf = userId === session.user.id
  if (!isSelf && !requireRole(callerRole, 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await prisma.$transaction(async (tx) => {
    await tx.workspaceMember.delete({
      where: { workspaceId_userId: { workspaceId, userId } },
    })
    // If the removed user has this workspace as active, clear it
    await tx.user.updateMany({
      where: { id: userId, workspaceId },
      data: { workspaceId: null },
    })
  })

  return NextResponse.json({ ok: true })
}
