import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { sendWelcomeEmail } from '@/lib/email/welcomeEmail'

const AVATAR_COLORS = ['#ef4444','#3b82f6','#8b5cf6','#10b981','#f59e0b','#ec4899','#14b8a6','#6366f1','#f97316']

export async function POST(req: Request) {
  const { email, password, name } = await req.json()

  if (!email || !password)
    return NextResponse.json({ error: 'Email and password required' }, { status: 400 })

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing)
    return NextResponse.json({ error: 'Email already in use' }, { status: 409 })

  const hashed = await bcrypt.hash(password, 12)
  const displayName = name || email.split('@')[0]

  // Pick a consistent color based on email
  const colorIndex = email.split('').reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0) % AVATAR_COLORS.length

  const user = await prisma.user.create({
    data: {
      email,
      password: hashed,
      name: displayName,
      // Auto-create a LinkedIn account so sequence builder works immediately
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

  await sendWelcomeEmail({ to: user.email })

  return NextResponse.json({ id: user.id, email: user.email })
}
