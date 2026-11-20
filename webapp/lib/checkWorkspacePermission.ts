import type { WorkspaceRole } from '@/lib/getWorkspaceContext'

const ROLE_HIERARCHY: Record<WorkspaceRole, number> = {
  viewer: 0,
  member: 1,
  admin: 2,
  owner: 3,
}

/**
 * Returns true if `role` meets or exceeds `minimumRole` in the hierarchy.
 * viewer < member < admin < owner
 */
export function requireRole(role: WorkspaceRole, minimumRole: WorkspaceRole): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[minimumRole]
}
