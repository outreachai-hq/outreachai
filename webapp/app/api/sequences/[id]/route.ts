import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { validateSteps } from '@/lib/sequenceStepSchema'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const sequence = await prisma.sequence.findFirst({
    where: { id, userId: session.user!.id },
  })

  if (!sequence) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(sequence)
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const existing = await prisma.sequence.findFirst({ where: { id, userId: session.user!.id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const { name, steps, active } = body

  let validatedSteps
  if (steps !== undefined) {
    if (!Array.isArray(steps)) {
      return NextResponse.json({ error: 'steps must be an array' }, { status: 400 })
    }
    try {
      validatedSteps = validateSteps(steps)
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : 'Invalid steps' }, { status: 400 })
    }
  }

  const updated = await prisma.sequence.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(validatedSteps !== undefined && { steps: validatedSteps }),
      ...(active !== undefined && { active }),
    },
  })

  return NextResponse.json(updated)
}
