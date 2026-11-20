/**
 * Plan 3 backfill — Contact.company / Lead.company strings -> Company rows.
 *
 * Iters 15-17 wire up the Company model and auto-link new Contacts/Leads
 * going forward. This script catches up the HISTORICAL data — runs once
 * after the dual-write is live in prod.
 *
 * Idempotent: re-running is safe.
 *   - Skips rows that already have companyId set.
 *   - Uses upsertCompany(), which dedupes on (userId, normalizedName).
 *   - Recomputes Company.contactCount + Company.leadCount + lastActivityAt
 *     at the end from a single GROUP BY query (avoids drift if the runner
 *     is interrupted).
 *
 * Run from webapp/:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' \
 *     scripts/backfill-companies.ts
 */

import { PrismaClient } from '@prisma/client'
import { upsertCompany } from '../lib/upsertCompany'

const prisma = new PrismaClient()

type Summary = {
  contactsScanned: number
  contactsLinked: number
  leadsScanned: number
  leadsLinked: number
  companiesTouched: number
  errors: number
}

async function backfillContacts(s: Summary): Promise<void> {
  const PAGE = 500
  let cursor: string | undefined = undefined
  for (;;) {
    const batch: { id: string; userId: string; company: string | null }[] = await prisma.contact.findMany({
      where: { companyId: null, company: { not: null } },
      take: PAGE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: 'asc' },
      select: { id: true, userId: true, company: true },
    })
    if (batch.length === 0) break
    cursor = batch[batch.length - 1].id
    s.contactsScanned += batch.length

    for (const c of batch) {
      if (!c.company || !c.company.trim()) continue
      try {
        const r = await upsertCompany({ userId: c.userId, name: c.company })
        await prisma.contact.update({ where: { id: c.id }, data: { companyId: r.id } })
        s.contactsLinked++
      } catch (err) {
        s.errors++
        console.error(`[backfill-companies] contact ${c.id} failed:`, err)
      }
    }
    console.log(`[backfill-companies] contacts processed ${s.contactsScanned}, linked ${s.contactsLinked}`)
  }
}

async function backfillLeads(s: Summary): Promise<void> {
  const PAGE = 500
  let cursor: string | undefined = undefined
  for (;;) {
    const batch: { id: string; company: string | null; leadList: { userId: string } | null }[] = await prisma.lead.findMany({
      where: { companyId: null, company: { not: null } },
      take: PAGE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: 'asc' },
      select: { id: true, company: true, leadList: { select: { userId: true } } },
    })
    if (batch.length === 0) break
    cursor = batch[batch.length - 1].id
    s.leadsScanned += batch.length

    for (const l of batch) {
      if (!l.company || !l.company.trim() || !l.leadList?.userId) continue
      try {
        const r = await upsertCompany({ userId: l.leadList.userId, name: l.company })
        await prisma.lead.update({ where: { id: l.id }, data: { companyId: r.id } })
        s.leadsLinked++
      } catch (err) {
        s.errors++
        console.error(`[backfill-companies] lead ${l.id} failed:`, err)
      }
    }
    console.log(`[backfill-companies] leads processed ${s.leadsScanned}, linked ${s.leadsLinked}`)
  }
}

async function recountAggregates(s: Summary): Promise<void> {
  // Single sweep — works regardless of how the linking phase went.
  const companies = await prisma.company.findMany({ select: { id: true } })
  s.companiesTouched = companies.length
  for (const c of companies) {
    const [contactCount, leadCount, mostRecentContact, mostRecentLead] = await Promise.all([
      prisma.contact.count({ where: { companyId: c.id } }),
      prisma.lead.count({    where: { companyId: c.id } }),
      prisma.contact.findFirst({ where: { companyId: c.id }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
      prisma.lead.findFirst({    where: { companyId: c.id }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
    ])
    const lastA = mostRecentContact?.createdAt ?? null
    const lastB = mostRecentLead?.createdAt    ?? null
    const lastActivityAt = lastA && lastB ? (lastA > lastB ? lastA : lastB) : (lastA ?? lastB)
    await prisma.company.update({
      where: { id: c.id },
      data: { contactCount, leadCount, lastActivityAt },
    })
  }
}

async function main() {
  console.log('[backfill-companies] starting', new Date().toISOString())
  const summary: Summary = {
    contactsScanned: 0, contactsLinked: 0,
    leadsScanned: 0,    leadsLinked: 0,
    companiesTouched: 0, errors: 0,
  }

  await backfillContacts(summary)
  await backfillLeads(summary)
  await recountAggregates(summary)

  console.log('[backfill-companies] done.', JSON.stringify(summary, null, 2))
  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error('[backfill-companies] fatal:', err)
  await prisma.$disconnect()
  process.exit(1)
})
