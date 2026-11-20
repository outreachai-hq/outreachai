// Plan 5 — Custom field helpers.
//
// Three responsibilities live here:
//   1. Key shape validation + native-field collision checks
//   2. Value coercion (`text`, `number`, `date`, `select`, `multiselect`,
//      `url`, `bool`, `ai` — `ai` is always stored as a string)
//   3. Prompt template rendering for AI columns

import type { Prisma } from '@prisma/client'
import { prisma } from './prisma'

const asJson = (o: Record<string, unknown>) => o as Prisma.InputJsonValue

export const ENTITY_KINDS = ['lead', 'contact', 'company'] as const
export type EntityKind = (typeof ENTITY_KINDS)[number]

export const FIELD_TYPES = ['text', 'number', 'date', 'select', 'multiselect', 'url', 'bool', 'ai'] as const
export type FieldType = (typeof FIELD_TYPES)[number]

// Keys we'll never let a user's custom field shadow — those would collide
// with native columns when we read/write rows.
const NATIVE_FIELD_KEYS: Record<EntityKind, Set<string>> = {
  lead:    new Set(['firstName', 'lastName', 'email', 'company', 'companyId', 'linkedinUrl', 'headline', 'status', 'score', 'phone', 'tags', 'aiOpener', 'companyNews', 'challenges', 'aboutSection', 'recentPost', 'leadListId', 'createdAt', 'id']),
  contact: new Set(['profileId', 'name', 'company', 'companyId', 'linkedinUrl', 'headline', 'status', 'sentAt', 'followupAt', 'notes', 'createdAt', 'userId', 'id']),
  company: new Set(['name', 'normalizedName', 'domain', 'websiteUrl', 'linkedinUrl', 'industry', 'market', 'type', 'size', 'employeeCount', 'foundedYear', 'city', 'state', 'region', 'country', 'technologies', 'tags', 'notes', 'contactCount', 'leadCount', 'lastActivityAt', 'createdAt', 'updatedAt', 'userId', 'id']),
}

const KEY_PATTERN = /^[a-z][a-z0-9_]{0,30}$/

export function validateKey(key: string, entity: EntityKind): string | null {
  if (!KEY_PATTERN.test(key))   return 'key must match /^[a-z][a-z0-9_]{0,30}$/'
  if (NATIVE_FIELD_KEYS[entity].has(key)) return `key "${key}" collides with a native ${entity} field`
  return null
}

export function slugifyKey(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 31) || 'field'
}

/**
 * Coerce a value into the shape expected by the field type. Used by entity
 * POST/PATCH handlers before writing to `customFields`.
 */
export function coerceValue(type: FieldType, raw: unknown): unknown {
  if (raw === null || raw === undefined) return null
  switch (type) {
    case 'text':   return String(raw)
    case 'url':    return String(raw)
    case 'ai':     return String(raw)
    case 'number': {
      const n = Number(raw)
      return Number.isFinite(n) ? n : null
    }
    case 'date': {
      const d = new Date(String(raw))
      return Number.isFinite(d.getTime()) ? d.toISOString() : null
    }
    case 'bool': {
      if (typeof raw === 'boolean') return raw
      if (typeof raw === 'string') return raw === 'true' || raw === '1' || raw === 'yes'
      return Boolean(raw)
    }
    case 'select':      return String(raw)
    case 'multiselect': return Array.isArray(raw) ? raw.map(String) : [String(raw)]
    default:            return raw
  }
}

/**
 * Render an AI-column prompt template against a row's known fields. Naïve
 * string substitution — see gotcha #3 in the plan: a lead whose firstName
 * is "Ignore previous instructions" can prompt-inject. Acceptable v1.
 */
export function renderPrompt(template: string, row: Record<string, unknown>): string {
  const get = (k: string): string => {
    const v = row?.[k]
    return v == null ? '' : String(v)
  }
  return template
    .replace(/\{\{firstName\}\}/g,   get('firstName'))
    .replace(/\{\{lastName\}\}/g,    get('lastName'))
    .replace(/\{\{name\}\}/g,        get('name'))
    .replace(/\{\{email\}\}/g,       get('email'))
    .replace(/\{\{company\}\}/g,     get('company'))
    .replace(/\{\{headline\}\}/g,    get('headline'))
    .replace(/\{\{linkedinUrl\}\}/g, get('linkedinUrl'))
    .replace(/\{\{industry\}\}/g,    get('industry'))
    .replace(/\{\{websiteUrl\}\}/g,  get('websiteUrl'))
    .replace(/\{\{about\}\}/g,       get('aboutSection'))
    .replace(/\{\{recentPost\}\}/g,  get('recentPost'))
}

type RunStatus = { status: 'pending' | 'running' | 'done' | 'failed'; lastRunAt?: string; error?: string | null }

/**
 * Validate + coerce a partial customFields patch against a user's defs for
 * the given entity. Returns the patch with valid keys only, dropping any
 * key without a matching CustomFieldDef. Throws on coercion failure.
 *
 * Caller is responsible for merging the patch into the existing JSON; this
 * keeps the helper testable without prisma.
 */
export async function buildCustomFieldsPatch(opts: {
  userId: string
  entity: EntityKind
  patch:  Record<string, unknown>
}): Promise<Record<string, unknown>> {
  const defs = await prisma.customFieldDef.findMany({
    where: { userId: opts.userId, entity: opts.entity },
    select: { key: true, type: true },
  })
  const byKey = new Map(defs.map((d) => [d.key, d.type as FieldType]))
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(opts.patch)) {
    const type = byKey.get(k)
    if (!type) continue // silently drop unknown keys
    out[k] = coerceValue(type, v)
  }
  return out
}

/**
 * Write a single custom-field value + its AI-run status to an entity row.
 * Merges into the existing customFields/aiColumnRuns JSON so we don't trash
 * other keys.
 */
export async function updateEntityCustomField(opts: {
  entity:    EntityKind
  entityId:  string
  userId:    string  // for ownership check
  key:       string
  value:     unknown
  runStatus?: RunStatus
}): Promise<void> {
  const { entity, entityId, userId, key, value, runStatus } = opts

  if (entity === 'lead') {
    const existing = await prisma.lead.findFirst({
      where: { id: entityId, leadList: { userId } },
      select: { customFields: true, aiColumnRuns: true },
    })
    if (!existing) throw new Error('Lead not found')
    await prisma.lead.update({
      where: { id: entityId },
      data: {
        customFields: asJson({ ...(existing.customFields as Record<string, unknown> ?? {}), [key]: value }),
        ...(runStatus && {
          aiColumnRuns: asJson({ ...(existing.aiColumnRuns as Record<string, unknown> ?? {}), [key]: runStatus }),
        }),
      },
    })
    return
  }
  if (entity === 'contact') {
    const existing = await prisma.contact.findFirst({
      where: { id: entityId, userId },
      select: { customFields: true, aiColumnRuns: true },
    })
    if (!existing) throw new Error('Contact not found')
    await prisma.contact.update({
      where: { id: entityId },
      data: {
        customFields: asJson({ ...(existing.customFields as Record<string, unknown> ?? {}), [key]: value }),
        ...(runStatus && {
          aiColumnRuns: asJson({ ...(existing.aiColumnRuns as Record<string, unknown> ?? {}), [key]: runStatus }),
        }),
      },
    })
    return
  }
  if (entity === 'company') {
    const existing = await prisma.company.findFirst({
      where: { id: entityId, userId },
      select: { customFields: true, aiColumnRuns: true },
    })
    if (!existing) throw new Error('Company not found')
    await prisma.company.update({
      where: { id: entityId },
      data: {
        customFields: asJson({ ...(existing.customFields as Record<string, unknown> ?? {}), [key]: value }),
        ...(runStatus && {
          aiColumnRuns: asJson({ ...(existing.aiColumnRuns as Record<string, unknown> ?? {}), [key]: runStatus }),
        }),
      },
    })
    return
  }
}
