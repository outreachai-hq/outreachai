import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { randomBytes } from 'crypto'
import { Resend } from 'resend'

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  const user = await prisma.user.findUnique({ where: { email } })
  // Always return 200 to prevent email enumeration
  if (!user) return NextResponse.json({ ok: true })

  const token = randomBytes(32).toString('hex')
  const expiry = new Date(Date.now() + 1000 * 60 * 60) // 1 hour

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordResetToken: token, passwordResetExpiry: expiry },
  })

  const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`

  const resend = new Resend(process.env.RESEND_API_KEY)
  await resend.emails.send({
    from: 'OutReachAI <noreply@outreachai.in>',
    replyTo: 'outreachai.in@gmail.com',
    to: email,
    subject: 'Reset your OutReachAI password',
    text: `Click the link below to reset your password (expires in 1 hour):\n\n${resetUrl}\n\nIf you didn't request this, ignore this email.`,
    html: `<p>Click the link below to reset your password (expires in 1 hour):</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you didn't request this, ignore this email.</p>`,
  })

  return NextResponse.json({ ok: true })
}
