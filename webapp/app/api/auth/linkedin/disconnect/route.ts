import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST /api/auth/linkedin/disconnect
// Deletes the default LinkedInAccount (OAuth-connected) for the current user.
export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  await prisma.linkedInAccount.deleteMany({
    where: { userId, linkedInMemberId: { not: null } },
  })

  return NextResponse.json({ ok: true })
}
