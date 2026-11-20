/**
 * Admins are configured via the ADMIN_EMAILS env var (comma-separated).
 * Example: ADMIN_EMAILS="you@example.com,cofounder@example.com"
 */
export function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return getAdminEmails().includes(email.trim().toLowerCase())
}

