import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { safeDecrypt } from '@/lib/encryption'
import { prisma } from '@/lib/prisma'
import { searchWithFallback } from '@/lib/enrichment'
import { upsertCompany } from '@/lib/upsertCompany'
import { normalizeCompanyName } from '@/lib/normalizeCompany'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { query, listId } = body as {
    query: { title: string; company?: string; domain?: string; limit?: number }
    listId?: string
  }

  if (!query?.title) return NextResponse.json({ error: 'query.title is required' }, { status: 400 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { apolloApiKey: true, hunterApiKey: true },
  })

  const apolloKey = safeDecrypt(user?.apolloApiKey) ?? null
  const hunterKey = safeDecrypt(user?.hunterApiKey) ?? null

  if (!apolloKey && !hunterKey) {
    return NextResponse.json(
      { error: 'No enrichment API keys configured. Add Apollo or Hunter keys in Settings → Enrichment API Keys.' },
      { status: 400 },
    )
  }

  let leads, provider, fallbackTriggered
  try {
    ;({ leads, provider, fallbackTriggered } = await searchWithFallback(apolloKey, hunterKey, query))
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Enrichment failed'
    return NextResponse.json({ error: msg }, { status: 502 })
  }

  let imported = 0
  if (listId) {
    // Verify the list belongs to this user
    const list = await prisma.leadList.findFirst({ where: { id: listId, userId: session.user.id } })
    if (!list) return NextResponse.json({ error: 'Lead list not found' }, { status: 404 })

    const toImport = leads.filter(l => l.email)
    if (toImport.length > 0) {
      // Plan 3 — pre-upsert Companies for the unique names in this batch so
      // each lead lands with companyId already set. Mirrors the lead-list
      // CSV-import path. Failures are fail-soft per company.
      const companyByNorm = new Map<string, string>()
      const countsByNorm  = new Map<string, number>()
      for (const l of toImport) {
        if (!l.company) continue
        const norm = normalizeCompanyName(l.company)
        if (!norm) continue
        countsByNorm.set(norm, (countsByNorm.get(norm) ?? 0) + 1)
        if (!companyByNorm.has(norm)) {
          try {
            const result = await upsertCompany({
              userId: session.user.id,
              name: l.company,
            })
            companyByNorm.set(norm, result.id)
          } catch (err) {
            console.error('[enrichment-search] upsertCompany failed', l.company, err)
          }
        }
      }

      await prisma.lead.createMany({
        data: toImport.map(l => {
          const norm = l.company ? normalizeCompanyName(l.company) : ''
          return {
            leadListId: listId,
            firstName:  l.firstName,
            lastName:   l.lastName || null,
            email:      l.email,
            company:    l.company,
            companyId:  norm ? companyByNorm.get(norm) ?? null : null,
            linkedinUrl: l.linkedInUrl,
            headline:   l.title,
          }
        }),
        skipDuplicates: true,
      })
      imported = toImport.length

      // Bump Company.leadCount + lastActivityAt for each touched company.
      const now = new Date()
      for (const [norm, n] of countsByNorm.entries()) {
        const cid = companyByNorm.get(norm)
        if (!cid) continue
        try {
          await prisma.company.update({
            where: { id: cid },
            data: { leadCount: { increment: n }, lastActivityAt: now },
          })
        } catch (err) {
          console.error('[enrichment-search] company counter update failed', cid, err)
        }
      }
    }
  }

  return NextResponse.json({ leads, imported, provider, fallbackTriggered })
}
