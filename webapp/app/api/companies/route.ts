// Plan 3 (Iter 16) — list + create Companies for the current user.

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { upsertCompany } from '@/lib/upsertCompany'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q        = searchParams.get('q')?.trim()
  const industry = searchParams.get('industry')
  const country  = searchParams.get('country')
  const size     = searchParams.get('size')
  const limit    = Math.min(Number(searchParams.get('limit') ?? 200), 1000)

  const companies = await prisma.company.findMany({
    where: {
      userId: session.user.id,
      ...(q ? {
        OR: [
          { name:   { contains: q, mode: 'insensitive' as const } },
          { domain: { contains: q, mode: 'insensitive' as const } },
        ],
      } : {}),
      ...(industry ? { industry } : {}),
      ...(country  ? { country }  : {}),
      ...(size     ? { size }     : {}),
    },
    orderBy: { name: 'asc' },
    take: limit,
  })

  return NextResponse.json({ companies })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const name = typeof body.name === 'string' ? body.name : ''
  if (!name.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 })

  try {
    const result = await upsertCompany({
      userId: session.user.id,
      name,
      websiteUrl: body.websiteUrl ?? null,
      linkedinUrl: body.linkedinUrl ?? null,
      industry: body.industry ?? null,
      size: body.size ?? null,
      country: body.country ?? null,
      city: body.city ?? null,
    })
    const company = await prisma.company.findUnique({ where: { id: result.id } })
    return NextResponse.json({ company, created: result.created }, { status: result.created ? 201 : 200 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 400 })
  }
}
