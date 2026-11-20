import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { token } = await req.json()
  if (!token) return NextResponse.json({ error: 'token is required' }, { status: 400 })

  const invite = await prisma.workspaceInvite.findUnique({ where: { token } })
  if (!invite) return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 404 })
  if (invite.acceptedAt) return NextResponse.json({ error: 'Invite already used' }, { status: 400 })
  if (invite.expiresAt < new Date()) return NextResponse.json({ error: 'Invite has expired' }, { status: 400 })

  const userId = session.user.id
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })

  if (user?.email?.toLowerCase() !== invite.email.toLowerCase()) {
    return NextResponse.json({ error: 'This invite was sent to a different email address' }, { status: 403 })
  }

  const workspace = await prisma.$transaction(async (tx) => {
    await tx.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: invite.workspaceId, userId } },
      update: { role: invite.role },
      create: { workspaceId: invite.workspaceId, userId, role: invite.role },
    })
    await tx.workspaceInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    })
    await tx.user.update({ where: { id: userId }, data: { workspaceId: invite.workspaceId } })
    return tx.workspace.findUnique({ where: { id: invite.workspaceId } })
  })

  return NextResponse.json({ ok: true, workspace })
}
