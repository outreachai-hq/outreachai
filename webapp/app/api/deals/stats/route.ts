import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/getUserId'

export async function GET(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const pipelineId = searchParams.get('pipelineId')

  const where: Record<string, unknown> = { userId }
  if (pipelineId) where.pipelineId = pipelineId

  // Total pipeline value (open deals)
  const openDeals = await prisma.deal.findMany({
    where: { ...where, status: 'open' },
    select: { value: true },
  })
  const totalPipeline = openDeals.reduce((sum, d) => sum + (d.value ?? 0), 0)
  const openDealsCount = openDeals.length

  // Won this calendar month
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const wonThisMonth = await prisma.deal.findMany({
    where: { ...where, status: 'won', wonAt: { gte: monthStart } },
    select: { value: true },
  })
  const wonThisMonthValue = wonThisMonth.reduce((sum, d) => sum + (d.value ?? 0), 0)

  // Average deal size (open deals with value)
  const openWithValue = openDeals.filter((d) => d.value != null)
  const avgDealSize = openWithValue.length > 0
    ? openWithValue.reduce((sum, d) => sum + (d.value ?? 0), 0) / openWithValue.length
    : 0

  // Close rate (last 90 days)
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  const [wonCount, lostCount] = await Promise.all([
    prisma.deal.count({ where: { ...where, status: 'won', wonAt: { gte: ninetyDaysAgo } } }),
    prisma.deal.count({ where: { ...where, status: 'lost', lostAt: { gte: ninetyDaysAgo } } }),
  ])
  const closeRate = wonCount + lostCount > 0
    ? Math.round((wonCount / (wonCount + lostCount)) * 100)
    : 0

  return NextResponse.json({
    totalPipeline,
    openDeals: openDealsCount,
    wonThisMonth: wonThisMonthValue,
    avgDealSize,
    closeRate,
  })
}
