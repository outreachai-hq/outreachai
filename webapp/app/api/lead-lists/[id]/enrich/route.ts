import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const list = await prisma.leadList.findFirst({
    where: { id, userId: session.user!.id },
    include: {
      leads: {
        where: { aiOpener: null },
      },
    },
  })

  if (!list) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const leadsToEnrich = list.leads
  if (leadsToEnrich.length === 0) {
    return NextResponse.json({ enriched: 0, message: 'All leads already enriched' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  let enriched = 0
  const errors: string[] = []

  for (const lead of leadsToEnrich) {
    try {
      // Use rich context if available
      const seniority = (() => {
        const h = (lead.headline || '').toLowerCase()
        if (/\b(ceo|cto|coo|cfo|chief|founder|co-founder|owner|president)\b/.test(h)) return 'C-Suite / Founder'
        if (/\b(vp|vice president|head of|director)\b/.test(h)) return 'VP / Director'
        if (/\b(senior|lead|principal|staff|manager)\b/.test(h)) return 'Senior / Manager'
        return 'Mid-level'
      })()

      const hasRichContext = lead.aboutSection || lead.recentPost

      const prompt = hasRichContext
        ? `You are an expert LinkedIn SDR. Write a 1-2 sentence personalized opener for ${lead.firstName}${lead.company ? ` at ${lead.company}` : ''}${lead.headline ? `, ${lead.headline}` : ''} (${seniority}).
${lead.aboutSection ? `\nAbout them: "${lead.aboutSection.slice(0, 400)}"` : ''}
${lead.recentPost ? `\nRecent post: "${lead.recentPost.slice(0, 300)}"` : ''}

Rules: Reference specific details above. Never use "I came across your profile". Don't start with "I". Max 2 sentences.

Output ONLY the opener.`
        : `You are an expert LinkedIn outreach copywriter. Write a short, personalized 1-2 sentence opener for a cold LinkedIn connection request message to ${lead.firstName}${lead.company ? ` at ${lead.company}` : ''}${lead.headline ? ` who is a ${lead.headline}` : ''}.

The opener should feel genuine and specific, be conversational and not salesy, and be 1-2 sentences max.

Reply with ONLY the opener text, no quotes, no explanation.`

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 200,
          messages: [{ role: 'user', content: prompt }],
        }),
      })

      if (!response.ok) {
        errors.push(`Lead ${lead.id}: API error ${response.status}`)
        continue
      }

      const data = await response.json()
      const opener = data.content?.[0]?.text?.trim()

      if (opener) {
        await prisma.lead.update({
          where: { id: lead.id },
          data: { aiOpener: opener },
        })
        enriched++
      }
    } catch (err) {
      errors.push(`Lead ${lead.id}: ${err}`)
    }
  }

  return NextResponse.json({
    enriched,
    total: leadsToEnrich.length,
    errors: errors.length > 0 ? errors : undefined,
  })
}
