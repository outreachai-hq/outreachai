import { NextRequest, NextResponse } from 'next/server'
import { seedDemo } from '@/prisma/seed'

// One-shot seed endpoint — only works with the correct secret.
// Use: POST /api/admin/seed with header X-Seed-Secret: <SEED_SECRET>
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-seed-secret')
  if (!secret || secret !== process.env.SEED_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    await seedDemo()
    return NextResponse.json({ ok: true, message: 'Seed complete — akhilesh@demo.com / password123' })
  } catch (err) {
    console.error('[seed]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
