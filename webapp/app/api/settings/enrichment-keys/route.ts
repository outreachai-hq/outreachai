import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { encrypt, safeDecrypt } from '@/lib/encryption'
import { prisma } from '@/lib/prisma'

function maskKey(key: string | null): string | null {
  if (!key) return null
  const decrypted = safeDecrypt(key)
  if (!decrypted || decrypted.length <= 4) return '****'
  return `${'*'.repeat(Math.max(decrypted.length - 4, 4))}${decrypted.slice(-4)}`
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { apolloApiKey: true, hunterApiKey: true },
  })

  return NextResponse.json({
    apolloApiKey: maskKey(user?.apolloApiKey ?? null),
    hunterApiKey: maskKey(user?.hunterApiKey ?? null),
  })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { apolloApiKey, hunterApiKey } = await req.json()

  const data: Record<string, string> = {}
  if (apolloApiKey?.trim()) data.apolloApiKey = encrypt(apolloApiKey.trim())
  if (hunterApiKey?.trim()) data.hunterApiKey = encrypt(hunterApiKey.trim())

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No keys provided' }, { status: 400 })
  }

  await prisma.user.update({ where: { id: session.user.id }, data })
  return NextResponse.json({ ok: true })
}
