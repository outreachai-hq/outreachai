import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/getUserId'
import { linkToCompany } from '@/lib/upsertCompany'
import { emitActivity } from '@/lib/activity'

export async function GET(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const contacts = await prisma.contact.findMany({
    where: { userId },
    orderBy: { sentAt: 'desc' },
  })
  return NextResponse.json({ contacts })
}

export async function POST(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  if (!body.name) return NextResponse.json({ error: 'name required' }, { status: 400 })
  const contact = await prisma.contact.create({
    data: {
      userId,
      profileId: body.profileId ?? '',
      name: body.name,
      email: body.email ?? null,
      company: body.company ?? null,
      headline: body.headline ?? null,
      linkedinUrl: body.linkedinUrl ?? null,
      status: body.status ?? 'sent',
      sentAt: body.sentAt ? new Date(body.sentAt) : new Date(),
      followupAt: body.followupAt ? new Date(body.followupAt) : null,
      notes: body.notes ?? null,
    },
  })

  // Plan 3 — link to a Company row when the contact carries a company name.
  // Fail-soft: errors here don't break the contact-create response.
  if (body.company) {
    const linked = await linkToCompany({
      userId,
      entity: 'contact',
      entityId: contact.id,
      name: body.company,
    })
    if (linked.companyId) (contact as { companyId?: string | null }).companyId = linked.companyId
  }

  // Activity timeline — the extension just messaged this contact on LinkedIn.
  emitActivity({
    userId,
    contactId: contact.id,
    type: 'linkedin.message_sent',
    channel: 'linkedin',
    source: 'extension',
    title: `Sent LinkedIn message to ${body.name}`,
    payload: {
      profileId: body.profileId ?? null,
      linkedinUrl: body.linkedinUrl ?? null,
      company: body.company ?? null,
      headline: body.headline ?? null,
    },
  }).catch(() => {})

  return NextResponse.json({ contact }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, status } = await req.json()
  await prisma.contact.updateMany({ where: { id, userId }, data: { status } })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await req.json()
  await prisma.contact.deleteMany({ where: { id, userId } })
  return NextResponse.json({ ok: true })
}
