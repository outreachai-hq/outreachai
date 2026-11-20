import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const list = await prisma.leadList.findFirst({
    where: { id, userId: session.user!.id },
    include: {
      leads: { orderBy: { createdAt: 'asc' } },
    },
  })

  if (!list) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(list)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const existing = await prisma.leadList.findFirst({ where: { id, userId: session.user!.id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.leadList.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
