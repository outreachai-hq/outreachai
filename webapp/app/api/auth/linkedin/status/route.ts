import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserLinkedInCredentials } from '@/lib/linkedin'

// GET /api/auth/linkedin/status
// Returns whether the user has configured their own LinkedIn OAuth app and whether they're connected.
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const creds = await getUserLinkedInCredentials(session.user.id)
  const configured = !!creds

  const account = await prisma.linkedInAccount.findFirst({
    where: { userId: session.user.id, linkedInMemberId: { not: null } },
    select: { name: true, email: true, linkedInScope: true, tokenExpiry: true },
  })

  return NextResponse.json({
    configured,
    connected: !!account,
    account: account
      ? {
          name: account.name,
          email: account.email,
          scope: account.linkedInScope,
          tokenExpiry: account.tokenExpiry,
        }
      : null,
  })
}
