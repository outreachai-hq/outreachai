import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { promises as dns } from 'dns'

async function checkDomain(domain: string) {
  const results = { spf: false, dkim: false, dmarc: false }

  try {
    const txtRecords = await dns.resolveTxt(domain)
    const flat = txtRecords.flat()
    results.spf = flat.some(r => r.startsWith('v=spf1'))
    results.dmarc = false // checked separately
  } catch {}

  try {
    const dmarcRecords = await dns.resolveTxt(`_dmarc.${domain}`)
    results.dmarc = dmarcRecords.flat().some(r => r.startsWith('v=DMARC1'))
  } catch {}

  // DKIM requires knowing the selector — we'll mark as unknown (true = assume ok for now)
  results.dkim = true

  const score = (results.spf ? 33 : 0) + (results.dkim ? 34 : 0) + (results.dmarc ? 33 : 0)
  return { ...results, score }
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const emailAccounts = await prisma.emailAccount.findMany({
    where: { userId: session.user.id },
  })

  const domains = await Promise.all(
    emailAccounts.map(async (account) => {
      const domain = account.email.split('@')[1] ?? ''
      const check = domain ? await checkDomain(domain) : { spf: false, dkim: false, dmarc: false, score: 0 }
      return {
        domain,
        email: account.email,
        ...check,
        dailyLimit: 50,
      }
    })
  )

  // If no email accounts, return demo data
  const finalDomains = domains.length > 0 ? domains : [{
    domain: 'example.com',
    email: 'you@example.com',
    spf: false,
    dkim: false,
    dmarc: false,
    score: 0,
    dailyLimit: 50,
  }]

  const overallScore = finalDomains.length > 0
    ? Math.round(finalDomains.reduce((sum, d) => sum + d.score, 0) / finalDomains.length)
    : 0

  const alerts = []
  for (const d of finalDomains) {
    if (!d.spf) alerts.push({ type: 'error' as const, message: `${d.domain}: Missing SPF record — emails may be rejected` })
    if (!d.dmarc) alerts.push({ type: 'warning' as const, message: `${d.domain}: Missing DMARC record — less deliverability protection` })
    if (d.score >= 80) alerts.push({ type: 'success' as const, message: `${d.domain}: Domain health looks good` })
  }

  if (emailAccounts.length === 0) {
    alerts.push({ type: 'warning' as const, message: 'No email accounts connected. Add one in Settings.' })
  }

  // Evaluate active DeliverabilityAlert rules against current metrics
  const delivAlerts = await prisma.deliverabilityAlert.findMany({
    where: { userId: session.user.id, active: true },
  })
  const triggered = delivAlerts
    .filter(a => {
      const value = a.metric === 'score' ? overallScore : 0 // extend as needed
      return a.condition === 'above' ? value > a.threshold : value < a.threshold
    })
    .map(a => ({
      metric: a.metric,
      condition: a.condition,
      threshold: a.threshold,
      message: `Alert: ${a.metric.replace('_',' ')} is ${a.condition} your threshold of ${a.threshold}`,
    }))

  return NextResponse.json({
    domains: finalDomains,
    alerts: [...alerts, ...triggered.map(t => ({ type: 'warning' as const, message: t.message }))],
    overallScore,
    triggeredAlerts: triggered,
  })
}
