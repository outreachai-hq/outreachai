import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/'],
      },
      // Explicitly allow AI crawlers
      { userAgent: 'GPTBot',          allow: '/' },
      { userAgent: 'Google-Extended', allow: '/' },
      { userAgent: 'CCBot',           allow: '/' },
      { userAgent: 'anthropic-ai',    allow: '/' },
      { userAgent: 'Claude-Web',      allow: '/' },
      { userAgent: 'PerplexityBot',   allow: '/' },
      { userAgent: 'YouBot',          allow: '/' },
      { userAgent: 'Applebot',        allow: '/' },
    ],
    sitemap: 'https://outreachai.in/sitemap.xml',
  }
}
