import { prisma } from '@/lib/prisma'

export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer'

export interface WorkspaceContext {
  effectiveUserId: string
  workspaceId: string | null
  role: WorkspaceRole
}

/**
 * Returns the effective userId to use for data queries.
 * If user has an active workspace, returns the workspace ownerId so all data
 * is scoped to the workspace owner. If no workspace, returns the user's own id.
 */
export async function getWorkspaceContext(sessionUserId: string): Promise<WorkspaceContext> {
  const user = await prisma.user.findUnique({
    where: { id: sessionUserId },
    select: { workspaceId: true },
  })

  if (!user?.workspaceId) {
    return { effectiveUserId: sessionUserId, workspaceId: null, role: 'owner' }
  }

  const workspaceId = user.workspaceId

  const [workspace, member] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: workspaceId }, select: { ownerId: true } }),
    prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: sessionUserId } },
      select: { role: true },
    }),
  ])

  if (!workspace) {
    // Workspace was deleted; treat as personal
    return { effectiveUserId: sessionUserId, workspaceId: null, role: 'owner' }
  }

  const isOwner = sessionUserId === workspace.ownerId
  const role: WorkspaceRole = isOwner ? 'owner' : (member?.role as WorkspaceRole) ?? 'member'

  return { effectiveUserId: workspace.ownerId, workspaceId, role }
}
