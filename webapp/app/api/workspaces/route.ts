import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id

  const [owned, memberships] = await Promise.all([
    prisma.workspace.findMany({
      where: { ownerId: userId },
      include: { members: { select: { id: true } } },
    }),
    prisma.workspaceMember.findMany({
      where: { userId },
      include: { workspace: { include: { members: { select: { id: true } } } } },
    }),
  ])

  const memberWorkspaces = memberships
    .filter((m) => m.workspace.ownerId !== userId)
    .map((m) => ({ ...m.workspace, role: m.role }))

  return NextResponse.json({
    owned: owned.map((w) => ({ ...w, memberCount: w.members.length, role: 'owner' })),
    member: memberWorkspaces.map((w) => ({ ...w, memberCount: w.members.length })),
  })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const userId = session.user.id

  const workspace = await prisma.$transaction(async (tx) => {
    const ws = await tx.workspace.create({ data: { name: name.trim(), ownerId: userId } })
    await tx.workspaceMember.create({ data: { workspaceId: ws.id, userId, role: 'admin' } })
    await tx.user.update({ where: { id: userId }, data: { workspaceId: ws.id } })
    return ws
  })

  return NextResponse.json(workspace, { status: 201 })
}
