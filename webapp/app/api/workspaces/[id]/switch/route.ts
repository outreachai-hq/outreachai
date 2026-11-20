import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: workspaceId } = await params
  const userId = session.user.id

  if (workspaceId === 'personal') {
    await prisma.user.update({ where: { id: userId }, data: { workspaceId: null } })
    return NextResponse.json({ ok: true, workspaceId: null })
  }

  // Verify user is a member of this workspace
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } })
  if (!workspace) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isOwner = workspace.ownerId === userId
  if (!isOwner) {
    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    })
    if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await prisma.user.update({ where: { id: userId }, data: { workspaceId } })
  return NextResponse.json({ ok: true, workspaceId })
}
