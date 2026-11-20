import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const call = await prisma.call.findFirst({ where: { id, userId: session.user.id } })
  if (!call) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const { notes, outcome } = body

  const updated = await prisma.call.update({
    where: { id },
    data: {
      ...(notes !== undefined ? { notes } : {}),
      ...(outcome !== undefined ? { outcome } : {}),
    },
  })

  return NextResponse.json({ call: updated })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const call = await prisma.call.findFirst({ where: { id, userId: session.user.id } })
  if (!call) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.call.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
