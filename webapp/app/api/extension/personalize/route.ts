import { NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/getUserId'
import { generateText } from '@/lib/ai'

export async function POST(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { name?: string; headline?: string; company?: string; about?: string; recentPost?: string; instruction?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { name, headline, company, about, recentPost, instruction } = body
  if (!name?.trim())
    return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const baseContext = `Name: ${name}\nRole: ${headline || 'Not available'}\nCompany: ${company || 'Not available'}\nAbout: ${about || 'Not available'}\nRecent post: ${recentPost || 'Not available'}`

  const prompt = instruction
    ? `You are a LinkedIn outreach copywriter. ${instruction}. Apply this to the opening sentence of a cold outreach to:\n\n${baseContext}\n\nOutput ONLY the revised single sentence (max 25 words), nothing else.`
    : `You are a LinkedIn outreach expert. Write ONLY a single personalized opening sentence (max 25 words) for a cold outreach message to this person:\n\n${baseContext}\n\nRules:\n- If role, company, or about info is available, reference something SPECIFIC from it\n- If data is sparse, write a warm curiosity-driven opener using their name and any available context\n- Sound human and warm, not salesy\n- Do NOT start with "I" or "Hi"\n- No generic phrases like "impressed by your profile"\n- ALWAYS output a sentence — never refuse, explain, or ask for more information\n- Output ONLY the sentence, nothing else`

  try {
    const raw = await generateText(prompt, { maxTokens: 100, userId })
    // Take only the first non-empty line — prevents the model appending explanations
    const text = raw.split('\n').map(l => l.trim()).find(l => l.length > 5) ?? raw.trim()
    return NextResponse.json({ text })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'AI generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
