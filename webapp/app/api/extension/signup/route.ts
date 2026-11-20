import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { SignJWT } from 'jose'
import { getJwtSecret } from '@/lib/jwtSecret'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { email, password, name } = body ?? {}

  if (!email || !password)
    return NextResponse.json({ error: 'email and password required' }, { status: 400 })

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing)
    return NextResponse.json({ error: 'Email already in use' }, { status: 409 })

  const hashed = await bcrypt.hash(password, 12)
  const displayName = name || email.split('@')[0]

  const AVATAR_COLORS = ['#ef4444','#3b82f6','#8b5cf6','#10b981','#f59e0b','#ec4899']
  const colorIndex = email.split('').reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0) % AVATAR_COLORS.length

  const user = await prisma.user.create({
    data: {
      email,
      password: hashed,
      name: displayName,
      extensionConnected: true,
      extensionConnectedAt: new Date(),
      linkedinAccounts: {
        create: {
          name: displayName,
          email,
          avatarColor: AVATAR_COLORS[colorIndex],
          isDefault: true,
        },
      },
    },
  })

  const token = await new SignJWT({ sub: user.id, plan: user.plan })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .sign(getJwtSecret())

  return NextResponse.json({ token, userId: user.id, plan: user.plan }, { status: 201 })
}
