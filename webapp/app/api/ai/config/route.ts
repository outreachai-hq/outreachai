import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { AI_MODELS, getConfiguredProviders } from '@/lib/ai'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const configured = getConfiguredProviders()
  const models = AI_MODELS.filter(m => configured.includes(m.provider))

  return NextResponse.json({
    configured,
    models,
    activeProvider: process.env.AI_PROVIDER ?? 'anthropic',
    activeModel:    process.env.AI_MODEL    ?? null,
  })
}
