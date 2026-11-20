// Destination resolution for email click-tracking redirects.
//
// Click-tracking routes take the original link as a `url` query param. Without
// checks, anyone could craft /api/.../track/click?url=https://evil.example and
// use this domain as an open redirect for phishing. We only follow the link when
// it belongs to a real tracked send (the caller resolved the tracking id) and is
// a plain http(s) URL; otherwise we send the visitor to the app home page.

export function appHomeUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '') + '/'
}

/** The routes historically decoded the already-decoded `url` param once more. */
function decodeParam(raw: string): string {
  try { return decodeURIComponent(raw) } catch { return raw }
}

export function resolveTrackedDestination(rawUrl: string | null, isKnownSend: boolean): string {
  const home = appHomeUrl()
  if (!rawUrl || !isKnownSend) return home
  let parsed: URL
  try {
    parsed = new URL(decodeParam(rawUrl))
  } catch {
    return home
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return home
  return parsed.toString()
}
