import type { MetadataRoute } from 'next'

const BASE = 'https://outreachai.in'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE,                       lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${BASE}/signup`,           lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE}/login`,            lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/changelog`,        lastModified: now, changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${BASE}/ai-context`,       lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },
    // Comparison pages — high priority for SEO
    { url: `${BASE}/vs/lemlist`,       lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE}/vs/hubspot`,       lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE}/vs/instantly`,     lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE}/vs/apollo`,        lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE}/vs/saleshandy`,    lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE}/vs/webengage`,     lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    // Feature pages
    { url: `${BASE}/features`,         lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/about`,            lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/privacy`,          lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${BASE}/terms`,            lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
  ]

  return staticPages
}
