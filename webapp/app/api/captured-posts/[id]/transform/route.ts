import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/getUserId'
import { generateText } from '@/lib/ai'

type Format = 'twitterThread' | 'linkedinRepost' | 'newsletter'

const PROMPTS: Record<Format, (text: string, name: string) => string> = {
  twitterThread: (text, name) => `Transform this LinkedIn post by ${name} into a Twitter/X thread.

Original post:
${text}

Rules:
- Split into 4-6 tweets, each under 280 characters
- Number them: 1/ 2/ 3/ etc.
- Preserve the core insight and key points
- Make it punchy and thread-worthy
- Do NOT add "[Thread]" or "🧵" — just the numbered tweets
- Output ONLY the tweets, one per line`,

  linkedinRepost: (text, name) => `Rewrite this LinkedIn post (originally by ${name}) as a fresh LinkedIn post that shares the same insight in your own voice.

Original post:
${text}

Rules:
- Keep the core insight but rewrite it completely
- Max 1300 characters
- Use a strong hook in the first line
- Add 3-5 relevant hashtags at the end
- Sound like a thoughtful professional sharing a useful perspective
- Output ONLY the post text`,

  newsletter: (text, name) => `Transform this LinkedIn post by ${name} into a short newsletter section.

Original post:
${text}

Rules:
- Write 150-250 words
- Include: a brief intro sentence, the key insight explained in depth, and 1-2 actionable takeaways
- Format with a clear headline and short paragraphs
- Attribute the original idea to "${name}"
- Output ONLY the newsletter section (headline + body)`,
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { format } = await req.json() as { format: Format }

  if (!['twitterThread', 'linkedinRepost', 'newsletter'].includes(format))
    return NextResponse.json({ error: 'format must be twitterThread | linkedinRepost | newsletter' }, { status: 400 })

  const post = await prisma.capturedPost.findFirst({ where: { id, userId } })
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Return cached result if already generated
  if (post[format]) return NextResponse.json({ [format]: post[format] })

  const prompt = PROMPTS[format](post.postText, post.profileName)

  let result: string
  try {
    result = await generateText(prompt, { maxTokens: 1000, userId })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'AI generation failed'
    return NextResponse.json({ error: msg }, { status: 502 })
  }

  await prisma.capturedPost.update({
    where: { id },
    data: { [format]: result },
  })

  return NextResponse.json({ [format]: result })
}
