import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { SignJWT } from 'jose'
import { getJwtSecret } from '@/lib/jwtSecret'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { email, password } = body ?? {}

  if (!email || !password)
    return NextResponse.json({ error: 'email and password required' }, { status: 400 })

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })

  if (!user.password) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  const valid = await bcrypt.compare(password, user.password)
  if (!valid) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })

  await prisma.user.update({
    where: { id: user.id },
    data: { extensionConnected: true, extensionConnectedAt: new Date() },
  })

  const existing = await prisma.linkedInAccount.count({ where: { userId: user.id } })
  if (existing === 0) {
    await prisma.linkedInAccount.create({
      data: {
        userId: user.id,
        name: user.name || user.email.split('@')[0],
        email: user.email,
        avatarColor: '#ef4444',
        isDefault: true,
      },
    })
  }

  // Sign a short-lived JWT — never expose raw userId as a token
  const token = await new SignJWT({ sub: user.id, plan: user.plan })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .sign(getJwtSecret())

  return NextResponse.json({ token, userId: user.id, plan: user.plan })
}
