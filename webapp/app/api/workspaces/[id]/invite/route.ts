import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/checkWorkspacePermission'
import type { WorkspaceRole } from '@/lib/getWorkspaceContext'

type Params = { params: Promise<{ id: string }> }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const VALID_ROLES = ['admin', 'member', 'viewer']

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: workspaceId } = await params
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } })
  if (!workspace) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isOwner = workspace.ownerId === session.user.id
  if (!isOwner) {
    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: session.user.id } },
    })
    const role = (member?.role as WorkspaceRole) ?? 'viewer'
    if (!requireRole(role, 'admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const invites = await prisma.workspaceInvite.findMany({
    where: { workspaceId, acceptedAt: null },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(invites)
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: workspaceId } = await params
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } })
  if (!workspace) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isOwner = workspace.ownerId === session.user.id
  if (!isOwner) {
    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: session.user.id } },
    })
    const callerRole = (member?.role as WorkspaceRole) ?? 'viewer'
    if (!requireRole(callerRole, 'admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const { email, role = 'member' } = await req.json()
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
  }
  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` }, { status: 400 })
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  // Upsert invite (reset token + expiry if re-inviting)
  const invite = await prisma.workspaceInvite.upsert({
    where: { workspaceId_email: { workspaceId, email } },
    update: { role, expiresAt, acceptedAt: null },
    create: { workspaceId, email, role, expiresAt },
  })

  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  const inviteLink = `${baseUrl}/join?token=${invite.token}`

  return NextResponse.json({ inviteLink, token: invite.token, expiresAt: invite.expiresAt })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: workspaceId } = await params
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } })
  if (!workspace) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isOwner = workspace.ownerId === session.user.id
  if (!isOwner) {
    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: session.user.id } },
    })
    const callerRole = (member?.role as WorkspaceRole) ?? 'viewer'
    if (!requireRole(callerRole, 'admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const { token } = await req.json()
  if (!token) return NextResponse.json({ error: 'token is required' }, { status: 400 })

  await prisma.workspaceInvite.deleteMany({ where: { token, workspaceId } })
  return NextResponse.json({ ok: true })
}
