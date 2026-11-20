import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { safeDecrypt } from '@/lib/encryption'
import { prisma } from '@/lib/prisma'
import { searchApollo, findEmailHunter } from '@/lib/enrichment'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { provider } = (await req.json()) as { provider: 'apollo' | 'hunter' }
  if (!provider) return NextResponse.json({ error: 'provider is required' }, { status: 400 })

  // Fetch the lead (verify ownership via leadList)
  const lead = await prisma.lead.findFirst({
    where: { id, leadList: { userId: session.user.id } },
  })
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { apolloApiKey: true, hunterApiKey: true },
  })

  const rawKey = provider === 'apollo' ? user?.apolloApiKey : user?.hunterApiKey
  const apiKey = safeDecrypt(rawKey)
  if (!apiKey) {
    return NextResponse.json(
      { error: `No ${provider} API key configured. Add it in Settings > Enrichment API Keys.` },
      { status: 400 },
    )
  }

  const updates: Partial<{
    email: string; linkedinUrl: string; headline: string; company: string
  }> = {}

  try {
    if (provider === 'apollo') {
      const domain = lead.company?.toLowerCase().replace(/\s+/g, '') + '.com'
      const results = await searchApollo(apiKey, {
        title: lead.headline ?? '',
        company: lead.company ?? undefined,
        domain: lead.company ? domain : undefined,
        limit: 5,
      })
      const match = results.find(r =>
        r.firstName.toLowerCase() === lead.firstName.toLowerCase() &&
        (r.lastName ?? '').toLowerCase() === (lead.lastName ?? '').toLowerCase(),
      ) ?? results[0]

      if (match) {
        if (!lead.email && match.email)       updates.email = match.email
        if (!lead.linkedinUrl && match.linkedInUrl) updates.linkedinUrl = match.linkedInUrl
        if (!lead.headline && match.title)    updates.headline = match.title
        if (!lead.company && match.company)   updates.company = match.company
      }
    } else {
      // Hunter: find email by name + domain
      const domain = lead.company?.toLowerCase().replace(/\s+/g, '') + '.com'
      if (!lead.email && lead.lastName) {
        const result = await findEmailHunter(apiKey, lead.firstName, lead.lastName, domain)
        if (result.email) updates.email = result.email
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Enrichment failed'
    return NextResponse.json({ error: msg }, { status: 502 })
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ lead, enriched: false })
  }

  const updated = await prisma.lead.update({ where: { id }, data: updates })
  return NextResponse.json({ lead: updated, enriched: true })
}
