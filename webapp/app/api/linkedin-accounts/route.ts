import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const accounts = await prisma.linkedInAccount.findMany({
    where: { userId: session.user!.id },
    orderBy: [{ isDefault: 'desc' }, { connectedAt: 'desc' }],
  })
  return NextResponse.json({ accounts })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, email, profileUrl, avatarColor } = await req.json()
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  // If first account, set as default
  const count = await prisma.linkedInAccount.count({ where: { userId: session.user!.id } })

  const account = await prisma.linkedInAccount.create({
    data: {
      userId: session.user!.id,
      name,
      email: email ?? null,
      profileUrl: profileUrl ?? null,
      avatarColor: avatarColor ?? '#ef4444',
      isDefault: count === 0,
    },
  })
  return NextResponse.json({ account }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  await prisma.linkedInAccount.deleteMany({ where: { id, userId: session.user!.id } })
  return NextResponse.json({ ok: true })
}
