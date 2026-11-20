import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/getUserId'

export async function GET(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const templates = await prisma.template.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, message: true },
  })

  return NextResponse.json({ templates })
}

export async function POST(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { name?: string; message?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { name, message } = body
  if (!name?.trim() || !message?.trim())
    return NextResponse.json({ error: 'name and message required' }, { status: 400 })

  const template = await prisma.template.create({
    data: { userId, name: name.trim(), message: message.trim() },
    select: { id: true, name: true, message: true },
  })

  return NextResponse.json({ template }, { status: 201 })
}
