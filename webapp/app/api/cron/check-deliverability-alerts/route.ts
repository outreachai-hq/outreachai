import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const users = await prisma.user.findMany({
    where: { deliverabilityAlerts: { some: { active: true } } },
    select: { id: true },
  })

  const results: Record<string, string[]> = {}

  for (const { id: userId } of users) {
    const alerts = await prisma.deliverabilityAlert.findMany({
      where: { userId, active: true },
    })

    // Compute real metrics for this user from the last 7 days
    const since = new Date(Date.now() - 7 * 86_400_000)
    const [totalSent, totalBounced, totalOpened, totalReplied] = await Promise.all([
      prisma.emailMessage.count({ where: { userId, sentAt: { gte: since } } }),
      prisma.emailMessage.count({ where: { userId, status: 'bounced', sentAt: { gte: since } } }),
      prisma.emailMessage.count({ where: { userId, status: 'opened', sentAt: { gte: since } } }),
      prisma.emailMessage.count({ where: { userId, status: 'replied', sentAt: { gte: since } } }),
    ])

    const metrics: Record<string, number> = {
      bounce_rate: totalSent > 0 ? (totalBounced / totalSent) * 100 : 0,
      open_rate:   totalSent > 0 ? (totalOpened  / totalSent) * 100 : 0,
      reply_rate:  totalSent > 0 ? (totalReplied / totalSent) * 100 : 0,
      score: 100, // basic fallback; full DNS score comes from the deliverability GET route
    }

    const triggered: string[] = []
    for (const alert of alerts) {
      const value = metrics[alert.metric] ?? 0
      const breached =
        alert.condition === 'above' ? value > alert.threshold :
        alert.condition === 'below' ? value < alert.threshold : false

      if (breached) {
        triggered.push(
          `${alert.metric.replace('_', ' ')} is ${value.toFixed(1)}% (${alert.condition} ${alert.threshold}%)`
        )
        // Mark alert as triggered by temporarily toggling so re-runs don't spam
        // (re-activate after 24h in a real system; for now just log)
      }
    }

    if (triggered.length) results[userId] = triggered
  }

  return NextResponse.json({ checked: users.length, triggered: Object.keys(results).length, results })
}
