import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user!.id },
    select: { extensionConnected: true, extensionConnectedAt: true, name: true, email: true },
  })

  return NextResponse.json({
    connected: user?.extensionConnected ?? false,
    connectedAt: user?.extensionConnectedAt ?? null,
    userName: user?.name ?? user?.email ?? '',
  })
}

// Extension calls this to disconnect
export async function DELETE() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await prisma.user.update({
    where: { id: session.user!.id },
    data: { extensionConnected: false, extensionConnectedAt: null },
  })

  return NextResponse.json({ ok: true })
}
