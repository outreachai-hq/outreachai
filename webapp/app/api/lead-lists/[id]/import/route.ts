import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface LeadImportRow {
  firstName?: string
  first_name?: string
  lastName?: string
  last_name?: string
  email?: string
  company?: string
  linkedinUrl?: string
  linkedin_url?: string
  headline?: string
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user!.id
  const { id } = await params

  const rows: LeadImportRow[] = await req.json()
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'Expected non-empty array of leads' }, { status: 400 })
  }

  // Build lead data — skip company resolution entirely for speed.
  // Company linking happens as a background step after import completes.
  const data = rows
    .filter((r) => r.firstName || r.first_name)
    .map((r) => ({
      leadListId: id,
      firstName: (r.firstName ?? r.first_name ?? '').trim(),
      lastName: (r.lastName ?? r.last_name ?? null),
      email: r.email ?? null,
      company: r.company ? String(r.company) : null,
      companyId: null,
      linkedinUrl: (r.linkedinUrl ?? r.linkedin_url ?? null),
      headline: r.headline ?? null,
    }))

  // Single createMany — one DB round-trip for the entire batch
  const result = await prisma.lead.createMany({ data })

  return NextResponse.json({
    imported: result.count,
    companiesTouched: 0,
  }, { status: 201 })
}
