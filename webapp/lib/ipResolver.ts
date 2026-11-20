// Resolves an IP address to org/company name using ipinfo.io free API.
// Free tier: 50,000 requests/month, no key needed for basic org lookup.
// Returns null if IP is private, localhost, or resolution fails.

interface IpInfo {
  org?: string   // e.g. "AS15169 Google LLC"
  hostname?: string
}

export async function resolveIp(ip: string): Promise<{ org: string | null; domain: string | null }> {
  // Skip private/localhost IPs
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
    return { org: null, domain: null }
  }

  try {
    const res = await fetch(`https://ipinfo.io/${ip}/json`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(3000),  // 3s timeout
    })
    if (!res.ok) return { org: null, domain: null }
    const data: IpInfo = await res.json()

    // org format: "AS15169 Google LLC" — strip the AS number
    const org = data.org ? data.org.replace(/^AS\d+\s+/, '').trim() : null

    // Try to derive domain from hostname or org name
    let domain: string | null = null
    if (data.hostname) {
      const parts = data.hostname.split('.')
      if (parts.length >= 2) domain = parts.slice(-2).join('.')
    }

    return { org, domain }
  } catch {
    return { org: null, domain: null }
  }
}
