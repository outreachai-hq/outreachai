import { auth } from '@/lib/auth'
import { isAdminEmail } from '@/lib/adminEmails'

export { isAdminEmail, getAdminEmails } from '@/lib/adminEmails'

/** Returns { status: 401 | 403 } on failure, or the admin session on success. */
export async function requireAdmin() {
  const session = await auth()
  if (!session?.user?.id) return { ok: false as const, status: 401 as const }
  if (!isAdminEmail(session.user.email)) return { ok: false as const, status: 403 as const }
  return { ok: true as const, session }
}
