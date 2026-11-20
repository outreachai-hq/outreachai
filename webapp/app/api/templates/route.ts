import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const templates = await prisma.template.findMany({
    where: { userId: session.user!.id },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(templates)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, message, subject } = await req.json()
  if (!name || !message) {
    return NextResponse.json({ error: 'Name and message are required' }, { status: 400 })
  }

  const template = await prisma.template.create({
    data: { userId: session.user!.id, name, subject: subject?.trim() || null, message },
  })

  return NextResponse.json(template, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, name, message, subject } = await req.json()
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const existing = await prisma.template.findUnique({ where: { id } })
  if (!existing || existing.userId !== session.user!.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const template = await prisma.template.update({
    where: { id },
    data: { name, subject: subject?.trim() || null, message },
  })

  return NextResponse.json(template)
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const existing = await prisma.template.findUnique({ where: { id } })
  if (!existing || existing.userId !== session.user!.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.template.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
