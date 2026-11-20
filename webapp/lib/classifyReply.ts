import { prisma } from './prisma'

type ReplyLabel = 'interested' | 'not_interested' | 'out_of_office' | 'other'

export async function classifyReplyIfNeeded(userId: string, conversationId: string): Promise<void> {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, userId },
    include: {
      messages: { orderBy: { sentAt: 'desc' }, take: 5 },
    },
  })
  if (!conversation) return

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { aiKeyAnthropic: true, aiKeyOpenai: true },
  })
  if (!user?.aiKeyAnthropic && !user?.aiKeyOpenai) return

  const messageSummary = conversation.messages
    .slice()
    .reverse()
    .map((m) => `${m.direction === 'in' ? 'Prospect' : 'You'}: ${m.body.slice(0, 300)}`)
    .join('\n')

  const prompt = `Classify this sales conversation reply as one of: interested, not_interested, out_of_office, other. Reply with just the label, nothing else.\n\nConversation:\n${messageSummary}`

  let label: ReplyLabel = 'other'

  try {
    if (user.aiKeyAnthropic) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': user.aiKeyAnthropic,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 10,
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      if (res.ok) {
        const data = await res.json()
        const text = (data.content?.[0]?.text ?? '').trim().toLowerCase()
        if (['interested', 'not_interested', 'out_of_office', 'other'].includes(text)) {
          label = text as ReplyLabel
        }
      }
    } else if (user.aiKeyOpenai) {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user.aiKeyOpenai}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          max_tokens: 10,
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      if (res.ok) {
        const data = await res.json()
        const text = (data.choices?.[0]?.message?.content ?? '').trim().toLowerCase()
        if (['interested', 'not_interested', 'out_of_office', 'other'].includes(text)) {
          label = text as ReplyLabel
        }
      }
    }
  } catch {
    return
  }

  if (label !== 'other') {
    const current = conversation.labels ?? []
    if (!current.includes(label)) {
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { labels: [...current.filter((l) => !['interested', 'not_interested', 'out_of_office'].includes(l)), label] },
      })
    }
  }
}
