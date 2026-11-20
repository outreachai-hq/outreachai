// Plan 7 — Snippets CRUD list + create endpoint.
//
// Snippets are short reusable text fragments inserted in any composer via
// `/key`. `key` is auto-generated from `label` if the client omits it
// ("Intro signoff" → "intro_signoff"), enforcing the slug shape so the
// /key tokenizer in the composer doesn't have to escape exotic chars.

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function slugify(label: string): string {
  return label.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'snippet'
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const snippets = await prisma.snippet.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: 'desc' },
  })
  return NextResponse.json({ snippets })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const label = typeof body.label === 'string' ? body.label.trim() : ''
  const text  = typeof body.body  === 'string' ? body.body.trim()  : ''
  if (!label || !text) return NextResponse.json({ error: 'label and body required' }, { status: 400 })

  const rawKey = typeof body.key === 'string' ? body.key : slugify(label)
  // Final-form key normalisation regardless of source
  const key = slugify(rawKey)

  try {
    const snippet = await prisma.snippet.create({
      data: {
        userId: session.user.id,
        key,
        label,
        body: text,
        tags: Array.isArray(body.tags) ? body.tags.filter((t: unknown) => typeof t === 'string') : [],
      },
    })
    return NextResponse.json({ snippet }, { status: 201 })
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code
    if (code === 'P2002') {
      return NextResponse.json({ error: `Key "${key}" already in use. Pick a different label.` }, { status: 409 })
    }
    throw err
  }
}
