// POST { t: trackingId, u: url, r: referrer, ua: userAgent }
// Called by the JS snippet. Returns 200 with a 1x1 transparent gif.
// Processes asynchronously — don't make the visitor wait.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveIp } from '@/lib/ipResolver'
import { runWorkflowsForEvent } from '@/lib/workflowEngine'

export const runtime = 'nodejs'

// 1x1 transparent GIF
const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')

export async function POST(req: NextRequest) {
  // Respond immediately — process async
  const body = await req.json().catch(() => ({}))
  const { t: trackingId, u: url, r: referrer } = body

  if (!trackingId) {
    return new NextResponse(GIF, { status: 200, headers: { 'Content-Type': 'image/gif' } })
  }

  // Get real IP (handle proxies)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || null

  const userAgent = req.headers.get('user-agent') ?? undefined

  // Process in background — don't await
  processVisit({ trackingId, ip, url, referrer, userAgent }).catch(() => {})

  return new NextResponse(GIF, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    },
  })
}

export async function GET(req: NextRequest) {
  // Also support GET for img src beacon (fallback)
  const { searchParams } = req.nextUrl
  const trackingId = searchParams.get('t')
  const url = searchParams.get('u') ?? undefined
  const referrer = searchParams.get('r') ?? undefined

  if (!trackingId) {
    return new NextResponse(GIF, { status: 200, headers: { 'Content-Type': 'image/gif' } })
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null
  const userAgent = req.headers.get('user-agent') ?? undefined

  processVisit({ trackingId, ip, url, referrer, userAgent }).catch(() => {})

  return new NextResponse(GIF, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    },
  })
}

async function processVisit(opts: {
  trackingId: string
  ip: string | null
  url?: string
  referrer?: string
  userAgent?: string
}) {
  const { trackingId, ip, url, referrer, userAgent } = opts

  // 1. Find the user by trackingId
  const user = await prisma.user.findUnique({
    where: { websiteTrackingId: trackingId },
    select: { id: true },
  })
  if (!user) return

  // 2. Resolve IP to org/company
  const { org: resolvedOrg, domain: resolvedDomain } = ip
    ? await resolveIp(ip)
    : { org: null, domain: null }

  // 3. Try to match to a known lead/contact/company
  let matchedLeadId: string | null = null
  let matchedContactId: string | null = null
  let matchedCompanyId: string | null = null

  if (resolvedOrg) {
    // Try company match first
    const company = await prisma.company.findFirst({
      where: {
        userId: user.id,
        OR: [
          { name: { contains: resolvedOrg, mode: 'insensitive' } },
          ...(resolvedDomain ? [{ domain: { contains: resolvedDomain, mode: 'insensitive' as const } }] : []),
        ],
      },
      select: { id: true },
    })
    if (company) matchedCompanyId = company.id

    // Try contact match via company name
    if (!matchedContactId) {
      const contact = await prisma.contact.findFirst({
        where: { userId: user.id, company: { contains: resolvedOrg, mode: 'insensitive' } },
        select: { id: true },
      })
      if (contact) matchedContactId = contact.id
    }

    // Try lead match via company name
    if (!matchedLeadId) {
      const lead = await prisma.lead.findFirst({
        where: { company: { contains: resolvedOrg, mode: 'insensitive' }, leadList: { userId: user.id } },
        select: { id: true },
      })
      if (lead) matchedLeadId = lead.id
    }
  }

  // 4. Store the visit
  const visit = await prisma.websiteVisit.create({
    data: {
      userId: user.id,
      trackingId,
      ip,
      resolvedOrg,
      resolvedDomain,
      matchedLeadId,
      matchedContactId,
      matchedCompanyId,
      url: url ?? null,
      referrer: referrer ?? null,
      userAgent: userAgent ?? null,
    },
  })

  // 5. Fire WatchlistSignal for any active website_visit watchlists
  const watchlists = await prisma.watchlist.findMany({
    where: { userId: user.id, signalType: 'website_visit', active: true },
    select: { id: true, name: true },
  })

  for (const wl of watchlists) {
    const signal = await prisma.watchlistSignal.create({
      data: {
        watchlistId: wl.id,
        userId: user.id,
        leadId: matchedLeadId,
        contactId: matchedContactId,
        companyId: matchedCompanyId,
        title: resolvedOrg
          ? `${resolvedOrg} visited your website`
          : `Anonymous visitor from ${ip ?? 'unknown IP'}`,
        body: url ? `Page: ${url}` : null,
        payload: { ip, resolvedOrg, resolvedDomain, url, referrer },
      },
    })

    // 6. Fire workflow signal.fired event
    runWorkflowsForEvent('signal.fired', user.id, {
      signalId: signal.id,
      watchlistId: wl.id,
      leadId: matchedLeadId ?? undefined,
      contactId: matchedContactId ?? undefined,
      companyId: matchedCompanyId ?? undefined,
      org: resolvedOrg ?? undefined,
    }).catch(() => {})
  }

  // Suppress unused variable warning
  void visit
}
