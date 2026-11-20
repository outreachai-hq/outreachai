import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { safeDecrypt } from '@/lib/encryption'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { phone, phoneNumber } = await req.json()
  if (!phone || !phoneNumber) return NextResponse.json({ error: 'phone and phoneNumber required' }, { status: 400 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { waApiKey: true, waBaseUrl: true },
  })
  const apiKey  = user?.waApiKey  ? (safeDecrypt(user.waApiKey) ?? null)  : null
  const baseUrl = user?.waBaseUrl ?? null
  if (!apiKey || !baseUrl)
    return NextResponse.json({ error: 'WhatsApp not configured.' }, { status: 400 })

  const res = await fetch(`${baseUrl}/api/v2/wa/phones/pairing-code`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'x-phone': phone,
    },
    body: JSON.stringify({ phone_number: phoneNumber }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) return NextResponse.json({ error: data?.message ?? 'Failed to get pairing code' }, { status: res.status })
  return NextResponse.json({ code: data.code ?? data?.data?.code })
}
