// Called on first login to auto-create a LinkedIn account if user has none
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const COLORS = ['#ef4444','#3b82f6','#8b5cf6','#10b981','#f59e0b','#ec4899','#6366f1','#f97316']

export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user!.id
  const count = await prisma.linkedInAccount.count({ where: { userId } })
  if (count > 0) return NextResponse.json({ created: false })

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const name = user.name || user.email.split('@')[0]
  const colorIdx = user.email.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length

  const account = await prisma.linkedInAccount.create({
    data: { userId, name, email: user.email, avatarColor: COLORS[colorIdx], isDefault: true },
  })

  return NextResponse.json({ created: true, account })
}
