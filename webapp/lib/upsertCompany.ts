// Plan 3 — idempotent Company upsert.
//
// Called from POST handlers that create Contacts / Leads (Iter 17). The
// caller may pass a free-text company name + optional URL / industry /
// size hints; this helper canonicalises the name, derives a domain, and
// upserts on (userId, normalizedName).

import { prisma } from './prisma'
import { normalizeCompanyName, domainFromUrl } from './normalizeCompany'

export type UpsertCompanyInput = {
  userId: string
  name: string
  websiteUrl?: string | null
  linkedinUrl?: string | null
  industry?: string | null
  size?: string | null
  country?: string | null
  city?: string | null
}

/**
 * Upserts a Company row for this user. Returns the row's id and whether a
 * new row was created (`created=true`) vs an existing one updated.
 *
 * Throws if the input name is empty after normalization. Callers should
 * wrap in try/catch when they want a fail-soft behaviour at the create-site.
 */
export async function upsertCompany(
  input: UpsertCompanyInput
): Promise<{ id: string; created: boolean }> {
  const trimmedName = (input.name ?? '').trim()
  if (!trimmedName) throw new Error('upsertCompany: name is empty')

  const normalizedName = normalizeCompanyName(trimmedName)
  if (!normalizedName) throw new Error('upsertCompany: name normalises to empty')

  const existing = await prisma.company.findUnique({
    where: { userId_normalizedName: { userId: input.userId, normalizedName } },
    select: { id: true },
  })

  const domain = domainFromUrl(input.websiteUrl)

  if (existing) {
    // Fill in any newly-known fields without overwriting populated ones.
    await prisma.company.update({
      where: { id: existing.id },
      data: {
        websiteUrl: input.websiteUrl ?? undefined,
        linkedinUrl: input.linkedinUrl ?? undefined,
        industry: input.industry ?? undefined,
        size: input.size ?? undefined,
        country: input.country ?? undefined,
        city: input.city ?? undefined,
        domain: domain ?? undefined,
      },
    })
    return { id: existing.id, created: false }
  }

  const created = await prisma.company.create({
    data: {
      userId: input.userId,
      name: trimmedName,
      normalizedName,
      websiteUrl: input.websiteUrl ?? null,
      linkedinUrl: input.linkedinUrl ?? null,
      industry: input.industry ?? null,
      size: input.size ?? null,
      country: input.country ?? null,
      city: input.city ?? null,
      domain,
    },
    select: { id: true },
  })
  return { id: created.id, created: true }
}

/**
 * Helper for Contact/Lead create sites — given a freshly-created row and a
 * free-text company name, upsert the Company and link `companyId` on the
 * source row. Maintains the denormalised contactCount / leadCount counter.
 *
 * Fail-soft: any thrown error is swallowed with a console.error so the
 * caller's main flow (creating the Contact / Lead) doesn't 500 because of
 * a company-link mishap.
 */
export async function linkToCompany(opts: {
  userId: string
  entity: 'contact' | 'lead'
  entityId: string
  name: string | null | undefined
}): Promise<{ companyId: string | null }> {
  if (!opts.name || !opts.name.trim()) return { companyId: null }
  try {
    const result = await upsertCompany({ userId: opts.userId, name: opts.name })
    const counterField = opts.entity === 'contact' ? 'contactCount' : 'leadCount'
    if (opts.entity === 'contact') {
      await prisma.contact.update({ where: { id: opts.entityId }, data: { companyId: result.id } })
    } else {
      await prisma.lead.update({ where: { id: opts.entityId }, data: { companyId: result.id } })
    }
    if (result.created) {
      // Newly-created Company: aggregate already starts at 0; bump exactly once.
      await prisma.company.update({
        where: { id: result.id },
        data: { [counterField]: 1, lastActivityAt: new Date() },
      })
    } else {
      await prisma.company.update({
        where: { id: result.id },
        data: {
          [counterField]: { increment: 1 },
          lastActivityAt: new Date(),
        },
      })
    }
    return { companyId: result.id }
  } catch (err) {
    console.error('[linkToCompany] failed', opts, err)
    return { companyId: null }
  }
}
