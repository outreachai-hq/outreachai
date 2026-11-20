import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { encrypt } from '@/lib/encryption'
import { prisma } from '@/lib/prisma'

// Stores AI API keys encrypted in the user's profile (DB).
// The lib/ai.ts generateText() reads them back per-request.
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { provider, apiKey } = await req.json()
  if (!provider || !apiKey?.trim())
    return NextResponse.json({ error: 'provider and apiKey required' }, { status: 400 })

  const allowed = ['anthropic', 'openai', 'gemini']
  if (!allowed.includes(provider))
    return NextResponse.json({ error: 'Invalid provider' }, { status: 400 })

  const encrypted = encrypt(apiKey.trim())

  // Store as JSON in user's metadata field (we'll use the extensionConnected pattern)
  // We store per-provider keys as a JSON blob in a dedicated column
  const fieldMap: Record<string, string> = {
    anthropic: 'aiKeyAnthropic',
    openai:    'aiKeyOpenai',
    gemini:    'aiKeyGemini',
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { [fieldMap[provider]]: encrypted },
  })

  return NextResponse.json({ ok: true })
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { aiKeyAnthropic: true, aiKeyOpenai: true, aiKeyGemini: true },
  })

  // Return which providers are configured (not the keys themselves)
  return NextResponse.json({
    configured: {
      anthropic: !!user?.aiKeyAnthropic,
      openai:    !!user?.aiKeyOpenai,
      gemini:    !!user?.aiKeyGemini,
    }
  })
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { provider } = await req.json()
  const allowed = ['anthropic', 'openai', 'gemini']
  if (!allowed.includes(provider))
    return NextResponse.json({ error: 'Invalid provider' }, { status: 400 })

  const fieldMap: Record<string, string> = {
    anthropic: 'aiKeyAnthropic',
    openai:    'aiKeyOpenai',
    gemini:    'aiKeyGemini',
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { [fieldMap[provider]]: null },
  })

  return NextResponse.json({ ok: true })
}
