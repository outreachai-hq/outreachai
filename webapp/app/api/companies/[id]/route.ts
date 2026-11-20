// Plan 3 (Iter 16) — single Company: detail, patch, delete.

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { domainFromUrl, normalizeCompanyName } from '@/lib/normalizeCompany'

// Fields a user can edit on a Company. Aggregates (contactCount, leadCount,
// lastActivityAt) and the immutable surrogate normalizedName are deliberately
// excluded — those are server-managed.
const EDITABLE = new Set([
  'name', 'domain', 'websiteUrl', 'linkedinUrl',
  'industry', 'market', 'type', 'size', 'employeeCount', 'foundedYear',
  'city', 'state', 'region', 'country',
  'technologies', 'tags', 'notes',
  'lastFundingDate', 'lastFundingAmount', 'lastFundingStage',
])

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const company = await prisma.company.findFirst({
    where: { id, userId: session.user.id },
    include: {
      contacts: {
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, headline: true, linkedinUrl: true, status: true },
        take: 200,
      },
      leads: {
        orderBy: { createdAt: 'desc' },
        select: { id: true, firstName: true, lastName: true, email: true, headline: true, status: true, leadListId: true },
        take: 200,
      },
    },
  })
  if (!company) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ company })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const existing = await prisma.company.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, name: true, customFields: true },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const data: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(body)) {
    if (EDITABLE.has(k)) data[k] = v
  }

  // Plan 5 — merge custom fields patch.
  if (body.customFields && typeof body.customFields === 'object') {
    const { buildCustomFieldsPatch } = await import('@/lib/customFields')
    const sanitized = await buildCustomFieldsPatch({
      userId: session.user.id, entity: 'company',
      patch:  body.customFields as Record<string, unknown>,
    })
    if (Object.keys(sanitized).length > 0) {
      data.customFields = {
        ...((existing as unknown as { customFields?: Record<string, unknown> }).customFields ?? {}),
        ...sanitized,
      }
    }
  }

  // Renaming requires the normalizedName index entry to follow.
  if (typeof body.name === 'string') {
    const newName = body.name.trim()
    if (!newName) return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 })
    const normalizedName = normalizeCompanyName(newName)
    if (!normalizedName) return NextResponse.json({ error: 'name normalises to empty' }, { status: 400 })
    data.name = newName
    data.normalizedName = normalizedName
    // Keep cached strings on related rows in sync (best-effort).
    await Promise.all([
      prisma.contact.updateMany({ where: { companyId: id }, data: { company: newName } }),
      prisma.lead.updateMany({    where: { companyId: id }, data: { company: newName } }),
    ]).catch(() => {})
  }
  if (typeof body.websiteUrl === 'string') data.domain = domainFromUrl(body.websiteUrl)

  try {
    const company = await prisma.company.update({ where: { id }, data })
    return NextResponse.json({ company })
  } catch (e) {
    // P2002 = unique-constraint violation on (userId, normalizedName)
    const code = (e as { code?: string })?.code
    if (code === 'P2002') {
      return NextResponse.json({ error: 'Another company with that name already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Update failed' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const existing = await prisma.company.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Hard delete; Contact/Lead.companyId is wired ON DELETE SET NULL so
  // the rows survive (their cached `company` text column also remains).
  await prisma.company.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
