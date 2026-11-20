import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id
  const now = new Date()

  const [overdueContacts, unreadThreads, recentReplies] = await Promise.all([
    prisma.contact.findMany({
      where: { userId, followupAt: { lt: now }, status: 'followup' },
      orderBy: { followupAt: 'asc' },
      take: 10,
      select: { id: true, name: true, company: true, followupAt: true, profileId: true },
    }),
    prisma.conversation.findMany({
      where: { userId, unread: true },
      orderBy: { syncedAt: 'desc' },
      take: 5,
      select: {
        id: true, participantName: true, syncedAt: true, participantUrl: true,
        messages: {
          orderBy: { sentAt: 'desc' },
          take: 1,
          select: { body: true },
        },
      },
    }),
    prisma.contact.findMany({
      where: { userId, status: 'replied', sentAt: { gt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      orderBy: { sentAt: 'desc' },
      take: 5,
      select: { id: true, name: true, company: true, sentAt: true },
    }),
  ])

  const notifications = [
    ...overdueContacts.map(c => ({
      id: `followup-${c.id}`, type: 'followup' as const,
      title: `Follow up with ${c.name}`,
      body: c.company ? `at ${c.company}` : 'Overdue follow-up',
      href: `https://linkedin.com/in/${c.profileId}`,
      at: c.followupAt,
    })),
    ...unreadThreads.map(t => {
      const last = t.messages[0]?.body ?? ''
      return {
        id: `thread-${t.id}`, type: 'reply' as const,
        title: `${t.participantName} messaged you`,
        body: last.slice(0, 60) + (last.length > 60 ? '…' : ''),
        href: t.participantUrl ?? '/inbox',
        at: t.syncedAt,
      }
    }),
    ...recentReplies.map(c => ({
      id: `replied-${c.id}`, type: 'reply' as const,
      title: `${c.name} replied`,
      body: c.company ? `at ${c.company}` : 'Recent reply',
      href: '/contacts',
      at: c.sentAt,
    })),
  ].sort((a, b) => new Date(b.at!).getTime() - new Date(a.at!).getTime()).slice(0, 15)

  return NextResponse.json({ notifications, unreadCount: overdueContacts.length + unreadThreads.length })
}
