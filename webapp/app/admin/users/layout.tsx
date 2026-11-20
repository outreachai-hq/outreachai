import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { isAdminEmail } from '@/lib/admin'
import AppShell from '@/components/AppShell'

export default async function AdminUsersLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')

  if (!isAdminEmail(session.user?.email)) {
    return (
      <AppShell>
        <div className="max-w-md mx-auto mt-24 px-4 text-center">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Admins only</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Your account ({session.user?.email}) doesn&apos;t have admin access.
          </p>
        </div>
      </AppShell>
    )
  }

  return <AppShell>{children}</AppShell>
}
