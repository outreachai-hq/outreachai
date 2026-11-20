import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { linkToCompany } from '@/lib/upsertCompany'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const list = await prisma.leadList.findFirst({ where: { id, userId: session.user!.id } })
  if (!list) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const leads = await prisma.lead.findMany({
    where: { leadListId: id },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(leads)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const list = await prisma.leadList.findFirst({ where: { id, userId: session.user!.id } })
  if (!list) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const { firstName, lastName, email, company, linkedinUrl, headline } = body

  if (!firstName) return NextResponse.json({ error: 'firstName is required' }, { status: 400 })

  const lead = await prisma.lead.create({
    data: {
      leadListId: id,
      firstName,
      lastName: lastName ?? null,
      email: email ?? null,
      company: company ?? null,
      linkedinUrl: linkedinUrl ?? null,
      headline: headline ?? null,
    },
  })

  if (company) {
    await linkToCompany({
      userId: session.user!.id,
      entity: 'lead',
      entityId: lead.id,
      name: company,
    })
  }

  return NextResponse.json(lead, { status: 201 })
}
