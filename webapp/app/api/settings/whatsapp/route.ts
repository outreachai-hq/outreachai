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
    select: { waApiKey: true, waPhone: true, waBaseUrl: true, waWebhookSecret: true },
  })

  return NextResponse.json({
    waApiKey: maskKey(user?.waApiKey ?? null),
    waPhone: user?.waPhone ?? null,
    waBaseUrl: user?.waBaseUrl ?? null,
    waWebhookSecret: maskKey(user?.waWebhookSecret ?? null),
  })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { waApiKey, waPhone, waBaseUrl, waWebhookSecret } = await req.json()

  const data: Record<string, string | null> = {}
  if (waApiKey?.trim())         data.waApiKey        = encrypt(waApiKey.trim())
  if (waPhone?.trim())          data.waPhone         = waPhone.trim()
  if (waBaseUrl?.trim())        data.waBaseUrl       = waBaseUrl.trim().replace(/\/$/, '')
  if (waWebhookSecret?.trim())  data.waWebhookSecret = encrypt(waWebhookSecret.trim())

  if (Object.keys(data).length === 0)
    return NextResponse.json({ error: 'No fields provided' }, { status: 400 })

  await prisma.user.update({ where: { id: session.user.id }, data })
  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await prisma.user.update({
    where: { id: session.user.id },
    data: { waApiKey: null, waPhone: null, waBaseUrl: null, waWebhookSecret: null },
  })
  return NextResponse.json({ ok: true })
}
