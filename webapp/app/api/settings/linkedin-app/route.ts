import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { encrypt, safeDecrypt } from '@/lib/encryption'
import { prisma } from '@/lib/prisma'

function maskKey(encrypted: string | null): string | null {
  if (!encrypted) return null
  const val = safeDecrypt(encrypted)
  if (!val || val.length <= 4) return '****'
  return `${'*'.repeat(Math.max(val.length - 4, 4))}${val.slice(-4)}`
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { linkedInClientId: true, linkedInClientSecret: true },
  })

  return NextResponse.json({
    clientId: maskKey(user?.linkedInClientId ?? null),
    clientSecret: maskKey(user?.linkedInClientSecret ?? null),
    configured: !!user?.linkedInClientId,
  })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { clientId, clientSecret } = await req.json()
  if (!clientId?.trim() || !clientSecret?.trim()) {
    return NextResponse.json({ error: 'Both Client ID and Client Secret are required' }, { status: 400 })
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      linkedInClientId: encrypt(clientId.trim()),
      linkedInClientSecret: encrypt(clientSecret.trim()),
    },
  })
  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await prisma.user.update({
    where: { id: session.user.id },
    data: { linkedInClientId: null, linkedInClientSecret: null },
  })
  return NextResponse.json({ ok: true })
}
