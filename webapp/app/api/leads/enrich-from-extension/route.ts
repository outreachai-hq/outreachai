import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/getUserId'
import { generateText } from '@/lib/ai'
import { linkToCompany } from '@/lib/upsertCompany'

const LIST_NAME = 'Chrome Extension Leads'

export async function POST(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { profileId, firstName, lastName, headline, company, linkedinUrl, aboutSection, recentPosts, skills, location } = body

  if (!firstName) return NextResponse.json({ error: 'firstName required' }, { status: 400 })

  // Find or create the "Chrome Extension Leads" list
  let leadList = await prisma.leadList.findFirst({ where: { userId, name: LIST_NAME } })
  if (!leadList) {
    leadList = await prisma.leadList.create({ data: { userId, name: LIST_NAME } })
  }

  // Check if lead already exists (by linkedinUrl or profileId)
  const existing = linkedinUrl
    ? await prisma.lead.findFirst({ where: { leadListId: leadList.id, linkedinUrl } })
    : null

  // Build AI opener using all available profile context
  let aiOpener: string | null = null
  try {
    const recentPost = Array.isArray(recentPosts) && recentPosts.length > 0 ? recentPosts[0] : null
    const prompt = `Write a single personalized LinkedIn outreach opening line (max 25 words) for this person:

Name: ${firstName} ${lastName ?? ''}
Role: ${headline ?? 'Unknown'}
Company: ${company ?? 'Unknown'}
About: ${aboutSection || 'Not available'}
Recent post: ${recentPost || 'Not available'}
Skills: ${Array.isArray(skills) ? skills.slice(0, 5).join(', ') : 'Not available'}
Location: ${location || 'Not available'}

Rules:
- Reference something SPECIFIC from their profile
- Sound warm and human, not salesy
- Do NOT start with "I" or "Hi"
- Output ONLY the sentence, nothing else`

    aiOpener = await generateText(prompt, { maxTokens: 80, userId })
  } catch { /* non-fatal — lead still saved without opener */ }

  if (existing) {
    await prisma.lead.update({
      where: { id: existing.id },
      data: {
        firstName,
        lastName:    lastName    || existing.lastName,
        headline:    headline    || existing.headline,
        company:     company     || existing.company,
        linkedinUrl: linkedinUrl || existing.linkedinUrl,
        ...(aiOpener ? { aiOpener } : {}),
      },
    })
    return NextResponse.json({ aiOpener, isNew: false, leadId: existing.id })
  }

  const lead = await prisma.lead.create({
    data: {
      leadListId: leadList.id,
      firstName,
      lastName:    lastName    || null,
      headline:    headline    || null,
      company:     company     || null,
      linkedinUrl: linkedinUrl || null,
      aiOpener:    aiOpener    || null,
      status:      'pending',
    },
  })

  if (company) {
    await linkToCompany({ userId, entity: 'lead', entityId: lead.id, name: company })
  }

  return NextResponse.json({ aiOpener, isNew: true, leadId: lead.id }, { status: 201 })
}
