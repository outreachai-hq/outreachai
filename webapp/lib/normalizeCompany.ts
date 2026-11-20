// Plan 3 helpers — pure / no IO. Used by upsertCompany and the backfill
// script. Kept in a separate file so they're easy to unit-test.

const SUFFIX_REGEX = /\b(inc|llc|ltd|corp|co|gmbh|ag|pvt|pte|sa|sas|sarl|sàrl|bv|nv|kk|kg|spa|srl|sl|sp\s*z\s*o\s*o)\b\.?/g

/**
 * Lowercase + drop trailing "Inc/LLC/Ltd/Corp/Co" suffixes + drop punctuation.
 * Used as the dedupe key (Company.normalizedName).
 *
 * Examples:
 *   "Stripe, Inc."    -> "stripe"
 *   "Acme Corp."       -> "acme"
 *   "Google LLC"      -> "google"
 *   "Open AI"          -> "open ai"
 */
export function normalizeCompanyName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[.,’']/g, '')
    .replace(SUFFIX_REGEX, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Extract a domain (host without "www.") from a URL.
 * Used to set Company.domain at create time. Returns null on garbage input
 * so the column stays NULL.
 */
export function domainFromUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const trimmed = url.trim()
  if (!trimmed) return null
  try {
    const hasScheme = /^https?:\/\//i.test(trimmed)
    const u = new URL(hasScheme ? trimmed : `https://${trimmed}`)
    const host = u.hostname.replace(/^www\./, '').toLowerCase().trim()
    return host || null
  } catch {
    return null
  }
}
