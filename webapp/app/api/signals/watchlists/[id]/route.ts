import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const watchlist = await prisma.watchlist.findFirst({ where: { id, userId: session.user.id } })
  if (!watchlist) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const { name, description, active } = body

  const updated = await prisma.watchlist.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(active !== undefined ? { active } : {}),
      updatedAt: new Date(),
    },
  })

  return NextResponse.json({ watchlist: updated })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const watchlist = await prisma.watchlist.findFirst({ where: { id, userId: session.user.id } })
  if (!watchlist) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.watchlist.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
