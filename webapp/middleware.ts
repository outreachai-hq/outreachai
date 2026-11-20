import { NextRequest, NextResponse } from 'next/server'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const EXTENSION_ROUTES = new Set([
  '/api/leads/enrich-from-extension',
  '/api/captured-posts',
  '/api/contacts',
  '/api/contacts/by-profile',
  '/api/inbox/sync',
])

function isExtensionRoute(pathname: string) {
  return pathname.startsWith('/api/extension/') || EXTENSION_ROUTES.has(pathname)
}

export function middleware(req: NextRequest) {
  if (!isExtensionRoute(req.nextUrl.pathname)) return NextResponse.next()

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
  }

  const res = NextResponse.next()
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.headers.set(k, v))
  return res
}

export const config = {
  matcher: [
    '/api/extension/:path*',
    '/api/leads/enrich-from-extension',
    '/api/captured-posts',
    '/api/contacts',
    '/api/contacts/by-profile',
    '/api/inbox/sync',
  ],
}
