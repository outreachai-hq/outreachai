import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/getUserId'
import { emitActivity } from '@/lib/activity'

// Extension calls PATCH /api/contacts/by-profile with { profileId, status }
export async function PATCH(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { profileId, status } = await req.json()
  if (!profileId || !status) return NextResponse.json({ error: 'profileId and status required' }, { status: 400 })

  const result = await prisma.contact.updateMany({
    where: { userId, profileId },
    data: { status },
  })

  // Activity timeline — extension detected an inbound LinkedIn reply.
  if (status === 'replied' && result.count > 0) {
    const contact = await prisma.contact.findFirst({ where: { userId, profileId } })
    if (contact) {
      emitActivity({
        userId,
        contactId: contact.id,
        type: 'linkedin.message_received',
        channel: 'linkedin',
        source: 'extension',
        title: `${contact.name} replied on LinkedIn`,
        payload: { profileId, linkedinUrl: contact.linkedinUrl ?? null },
      }).catch(() => {})
    }
  }

  return NextResponse.json({ updated: result.count })
}
