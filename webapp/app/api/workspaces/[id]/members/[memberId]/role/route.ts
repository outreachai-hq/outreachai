import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/checkWorkspacePermission'
import type { WorkspaceRole } from '@/lib/getWorkspaceContext'

type Params = { params: Promise<{ id: string; memberId: string }> }

const VALID_ROLES = ['admin', 'member', 'viewer']

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: workspaceId, memberId } = await params

  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } })
  if (!workspace) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Determine caller role
  const isOwner = workspace.ownerId === session.user.id
  let callerRole: WorkspaceRole = 'viewer'
  if (isOwner) {
    callerRole = 'owner'
  } else {
    const callerMember = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: session.user.id } },
    })
    callerRole = (callerMember?.role as WorkspaceRole) ?? 'viewer'
  }

  if (!requireRole(callerRole, 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const targetMember = await prisma.workspaceMember.findUnique({ where: { id: memberId } })
  if (!targetMember || targetMember.workspaceId !== workspaceId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Cannot change the owner's role
  if (targetMember.userId === workspace.ownerId) {
    return NextResponse.json({ error: "Cannot change the owner's role" }, { status: 400 })
  }

  const { role } = await req.json()
  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` }, { status: 400 })
  }

  const updated = await prisma.workspaceMember.update({
    where: { id: memberId },
    data: { role },
  })

  return NextResponse.json(updated)
}
