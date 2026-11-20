import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { safeDecrypt } from '@/lib/encryption'
import { prisma } from '@/lib/prisma'
import { verifyEmailHunter } from '@/lib/enrichment'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { email } = await req.json()
  if (!email?.trim()) return NextResponse.json({ error: 'email is required' }, { status: 400 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { hunterApiKey: true },
  })

  const apiKey = safeDecrypt(user?.hunterApiKey)
  if (!apiKey) {
    return NextResponse.json(
      { error: 'No Hunter.io API key configured. Add it in Settings > Enrichment API Keys.' },
      { status: 400 },
    )
  }

  try {
    const result = await verifyEmailHunter(apiKey, email.trim())
    return NextResponse.json(result)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Verification failed'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
