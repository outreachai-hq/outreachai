import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { validateSteps } from '@/lib/sequenceStepSchema'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sequences = await prisma.sequence.findMany({
    where: { userId: session.user!.id },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(sequences)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, steps, active } = await req.json()
  if (!name || !steps || !Array.isArray(steps) || steps.length === 0) {
    return NextResponse.json({ error: 'Name and at least one step are required' }, { status: 400 })
  }

  let validatedSteps
  try {
    validatedSteps = validateSteps(steps)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Invalid steps' }, { status: 400 })
  }

  const sequence = await prisma.sequence.create({
    data: {
      userId: session.user!.id,
      name,
      steps: validatedSteps,
      active: active ?? false,
    },
  })

  return NextResponse.json(sequence, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, active } = await req.json()
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const existing = await prisma.sequence.findUnique({ where: { id } })
  if (!existing || existing.userId !== session.user!.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const sequence = await prisma.sequence.update({
    where: { id },
    data: { active },
  })

  return NextResponse.json(sequence)
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const existing = await prisma.sequence.findUnique({ where: { id } })
  if (!existing || existing.userId !== session.user!.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.sequence.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
