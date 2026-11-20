import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/getUserId'
import { linkToCompany } from '@/lib/upsertCompany'

export async function POST(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { contacts } = await req.json()
  if (!Array.isArray(contacts) || contacts.length === 0)
    return NextResponse.json({ error: 'contacts array required' }, { status: 400 })
  if (contacts.length > 500)
    return NextResponse.json({ error: 'max 500 contacts per import' }, { status: 400 })

  let imported = 0
  let skipped = 0

  for (const c of contacts) {
    if (!c.name) { skipped++; continue }
    try {
      const created = await prisma.contact.create({
        data: {
          userId,
          profileId: c.linkedinUrl?.match(/\/in\/([^/?]+)/)?.[1] ?? `csv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: String(c.name),
          email: c.email ? String(c.email) : null,
          company: c.company ? String(c.company) : null,
          headline: c.headline ? String(c.headline) : null,
          linkedinUrl: c.linkedinUrl ? String(c.linkedinUrl) : null,
          status: 'sent',
        },
      })
      if (c.company) {
        await linkToCompany({ userId, entity: 'contact', entityId: created.id, name: String(c.company) })
      }
      imported++
    } catch { skipped++ }
  }

  return NextResponse.json({ imported, skipped })
}
