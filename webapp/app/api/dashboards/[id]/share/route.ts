// Plan 9 follow-up — create / rotate / revoke a share token on a dashboard.
//
// POST   → mint a new token (or rotate if one exists). Returns { shareToken, url }.
// DELETE → revoke (sets shareToken = null).

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function publicUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? 'https://outreachai.in'
  return `${base.replace(/\/+$/, '')}/share/dashboard/${token}`
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const owned = await prisma.dashboard.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  })
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const shareToken = crypto.randomBytes(18).toString('base64url')
  const updated = await prisma.dashboard.update({
    where: { id },
    data:  { shareToken, sharedAt: new Date() },
  })
  return NextResponse.json({
    shareToken: updated.shareToken,
    url:        updated.shareToken ? publicUrl(updated.shareToken) : null,
  })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const result = await prisma.dashboard.updateMany({
    where: { id, userId: session.user.id },
    data:  { shareToken: null, sharedAt: null },
  })
  if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
