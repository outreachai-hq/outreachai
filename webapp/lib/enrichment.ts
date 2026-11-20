export interface EnrichedLead {
  firstName: string
  lastName: string
  email: string | null
  company: string | null
  title: string | null
  linkedInUrl: string | null
  domain: string | null
  location: string | null
}

// Thrown when a provider hits its rate or quota limit — triggers fallback
export class QuotaError extends Error {
  readonly provider: string
  constructor(provider: string) {
    super(`${provider} quota/rate limit reached`)
    this.provider = provider
  }
}

// ── Apollo ────────────────────────────────────────────────────────────────────

export async function searchApollo(
  apiKey: string,
  query: { title: string; company?: string; domain?: string; limit?: number },
): Promise<EnrichedLead[]> {
  const body: Record<string, unknown> = {
    api_key: apiKey,
    person_titles: [query.title],
    page: 1,
    per_page: query.limit ?? 10,
  }
  if (query.domain) body.q_organization_domains = [query.domain]
  if (query.company) body.q_keywords = query.company

  const res = await fetch('https://api.apollo.io/v1/mixed_people/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (res.status === 401) throw new Error('Invalid Apollo API key')
  if (res.status === 429 || res.status === 402) throw new QuotaError('apollo')
  if (!res.ok) throw new Error(`Apollo error: ${res.status}`)

  const data = await res.json()
  // Apollo returns quota_exceeded in 200 responses when free credits are exhausted
  if (data.error_code === 'DAILY_USAGE_LIMIT_EXCEEDED' || data.error_code === 'MONTHLY_USAGE_LIMIT_EXCEEDED') {
    throw new QuotaError('apollo')
  }
  const people: Record<string, unknown>[] = data.people ?? []
  return people.map(p => {
    const org = p.organization as Record<string, unknown> | null | undefined
    return {
      firstName:   String(p.first_name ?? ''),
      lastName:    String(p.last_name ?? ''),
      email:       (p.email as string) ?? null,
      company:     (org?.name as string) ?? null,
      title:       (p.title as string) ?? null,
      linkedInUrl: (p.linkedin_url as string) ?? null,
      domain:      (org?.primary_domain as string) ?? null,
      location:    (p.city as string) ?? null,
    }
  })
}

// ── Hunter ────────────────────────────────────────────────────────────────────

export async function findEmailHunter(
  apiKey: string,
  firstName: string,
  lastName: string,
  domain: string,
): Promise<{ email: string | null; confidence: number }> {
  const url = new URL('https://api.hunter.io/v2/email-finder')
  url.searchParams.set('domain', domain)
  url.searchParams.set('first_name', firstName)
  url.searchParams.set('last_name', lastName)
  url.searchParams.set('api_key', apiKey)

  const res = await fetch(url.toString())
  if (res.status === 401) throw new Error('Invalid Hunter API key')
  if (res.status === 429 || res.status === 402) throw new QuotaError('hunter')
  if (!res.ok) throw new Error(`Hunter error: ${res.status}`)

  const data = await res.json()
  // Hunter returns errors in 200 responses when quota is exhausted
  if (data.errors?.some((e: { code: number }) => e.code === 429 || e.code === 402)) {
    throw new QuotaError('hunter')
  }
  return {
    email:      (data.data?.email as string) ?? null,
    confidence: (data.data?.score as number) ?? 0,
  }
}

// Hunter domain search — finds all known emails at a domain
// Used as fallback when Apollo quota is exhausted
export async function searchHunterDomain(
  apiKey: string,
  domain: string,
  titleFilter?: string,
): Promise<EnrichedLead[]> {
  const url = new URL('https://api.hunter.io/v2/domain-search')
  url.searchParams.set('domain', domain)
  url.searchParams.set('limit', '10')
  url.searchParams.set('api_key', apiKey)
  if (titleFilter) url.searchParams.set('seniority', '') // Hunter doesn't filter by title — we filter client-side

  const res = await fetch(url.toString())
  if (res.status === 401) throw new Error('Invalid Hunter API key')
  if (res.status === 429 || res.status === 402) throw new QuotaError('hunter')
  if (!res.ok) throw new Error(`Hunter domain search error: ${res.status}`)

  const data = await res.json()
  if (data.errors?.some((e: { code: number }) => e.code === 429 || e.code === 402)) {
    throw new QuotaError('hunter')
  }

  const emails: Record<string, unknown>[] = data.data?.emails ?? []
  const companyName = (data.data?.organization as string) ?? null

  let results = emails.map(e => {
    const firstName = String(e.first_name ?? '')
    const lastName  = String(e.last_name ?? '')
    return {
      firstName,
      lastName,
      email:       (e.value as string) ?? null,
      company:     companyName,
      title:       (e.position as string) ?? null,
      linkedInUrl: (e.linkedin as string) ?? null,
      domain,
      location:    null,
    }
  })

  // Client-side title filter when titleFilter provided
  if (titleFilter) {
    const q = titleFilter.toLowerCase()
    const filtered = results.filter(r => r.title?.toLowerCase().includes(q))
    if (filtered.length > 0) results = filtered
  }

  return results
}

// ── Waterfall ─────────────────────────────────────────────────────────────────
// Try Apollo first. On QuotaError, fall back to Hunter domain search.
// Returns leads + which provider actually served the result.

export async function searchWithFallback(
  apolloKey: string | null,
  hunterKey: string | null,
  query: { title: string; company?: string; domain?: string; limit?: number },
): Promise<{ leads: EnrichedLead[]; provider: 'apollo' | 'hunter'; fallbackTriggered: boolean }> {
  // 1. Try Apollo
  if (apolloKey) {
    try {
      const leads = await searchApollo(apolloKey, query)
      return { leads, provider: 'apollo', fallbackTriggered: false }
    } catch (err) {
      if (!(err instanceof QuotaError)) throw err
      // Apollo quota hit — fall through to Hunter
    }
  }

  // 2. Fall back to Hunter domain search
  if (hunterKey) {
    const domain = query.domain ?? (query.company ? query.company.toLowerCase().replace(/\s+/g, '') + '.com' : null)
    if (!domain) {
      throw new Error('Apollo quota reached and no domain available for Hunter fallback. Provide a domain to enable fallback.')
    }
    const leads = await searchHunterDomain(hunterKey, domain, query.title)
    return { leads, provider: 'hunter', fallbackTriggered: true }
  }

  throw new Error('No API keys configured. Add Apollo or Hunter keys in Settings → Enrichment API Keys.')
}

export async function verifyEmailHunter(
  apiKey: string,
  email: string,
): Promise<{ status: 'valid' | 'invalid' | 'unknown'; score: number }> {
  const url = new URL('https://api.hunter.io/v2/email-verifier')
  url.searchParams.set('email', email)
  url.searchParams.set('api_key', apiKey)

  const res = await fetch(url.toString())
  if (res.status === 401) throw new Error('Invalid API key')
  if (res.status === 429) throw new Error('Rate limit reached — try again in a moment')
  if (!res.ok) throw new Error(`Hunter error: ${res.status}`)

  const data = await res.json()
  const raw = data.data?.status as string | undefined
  const status: 'valid' | 'invalid' | 'unknown' =
    raw === 'valid' ? 'valid' : raw === 'invalid' ? 'invalid' : 'unknown'
  return { status, score: (data.data?.score as number) ?? 0 }
}
