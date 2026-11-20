import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { generateText, getConfiguredProviders } from '@/lib/ai'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (getConfiguredProviders().length === 0)
    return NextResponse.json({ error: 'No AI provider configured. Add an API key in Settings.' }, { status: 503 })

  const { threadMessages, leadName, context, provider, model } = await req.json()

  const prompt = `You are an expert sales development representative. Generate a warm, natural reply to this conversation thread.

Lead name: ${leadName ?? 'Unknown'}
Context: ${context ?? 'LinkedIn outreach'}

Conversation (most recent last):
${threadMessages?.map((m: { sender: string; text: string }) => `${m.sender}: ${m.text}`).join('\n') ?? 'No messages yet'}

Write a concise, personalized reply (2-3 sentences max). Be warm and human, not salesy.
Output ONLY the reply text, nothing else.`

  try {
    const reply = await generateText(prompt, {
      provider,
      model,
      maxTokens: 300,
    })
    return NextResponse.json({ reply })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'AI generation failed' },
      { status: 500 }
    )
  }
}
