import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/getUserId'

export async function GET(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const accounts = await prisma.warmupAccount.findMany({
    where: { userId },
    include: {
      emailAccount: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ accounts })
}

export async function POST(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { emailAccountId, dailyTarget } = body

  if (!emailAccountId)
    return NextResponse.json({ error: 'emailAccountId is required' }, { status: 400 })

  // Verify the email account belongs to this user
  const emailAccount = await prisma.emailAccount.findFirst({
    where: { id: emailAccountId, userId },
  })
  if (!emailAccount)
    return NextResponse.json({ error: 'Email account not found' }, { status: 404 })

  // Check if already enrolled
  const existing = await prisma.warmupAccount.findUnique({
    where: { emailAccountId },
  })
  if (existing)
    return NextResponse.json({ error: 'This account is already enrolled in warmup' }, { status: 409 })

  const warmupAccount = await prisma.warmupAccount.create({
    data: {
      userId,
      emailAccountId,
      dailyTarget: dailyTarget ? Math.min(Math.max(Number(dailyTarget), 1), 20) : 5,
    },
    include: {
      emailAccount: { select: { id: true, name: true, email: true } },
    },
  })

  return NextResponse.json({ account: warmupAccount }, { status: 201 })
}
