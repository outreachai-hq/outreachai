'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Users, Megaphone, MessageSquare, Plus, Mail, TrendingUp } from 'lucide-react'
import OnboardingChecklist from '@/components/OnboardingChecklist'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface DashboardStats {
  totalLeads: number
  activeCampaigns: number
  totalContacts: number
  totalReplies: number
  replies?: number  // legacy alias
  replyRate: string
  hotLeadsCount?: number
  emailsSent?: number
  sparklineEmailsSent?: number[]
  sparklineReplies?: number[]
}

interface PipelineStats {
  totalPipeline: number
  openDeals: number
  wonThisMonth: number
  avgDealSize: number
  closeRate: number
}

// ---------------------------------------------------------------------------
// Sparkline
// ---------------------------------------------------------------------------
function Sparkline({ data, color = '#3b82f6' }: { data: number[]; color?: string }) {
  if (!data || data.length < 2) return null
  const max = Math.max(...data, 1)
  const w = 80, h = 24, pts = data.length
  const points = data.map((v, i) => {
    const x = (i / (pts - 1)) * w
    const y = h - (v / max) * h
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={w} height={h} className="opacity-60">
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [pipelineStats, setPipelineStats] = useState<PipelineStats | null>(null)

  // Redirect if not authed
  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login')
  }, [status, router])

  // Fetch stats
  const fetchStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const [dashRes, pipelineRes] = await Promise.all([
        fetch('/api/dashboard/stats'),
        fetch('/api/deals/stats'),
      ])
      if (dashRes.ok) {
        const data = await dashRes.json()
        setStats(data)
      }
      if (pipelineRes.ok) {
        const data = await pipelineRes.json()
        setPipelineStats(data)
      }
    } catch {
      // ignore fetch errors
    } finally {
      setStatsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status !== 'authenticated') return
    const t = setTimeout(() => fetchStats(), 0)
    return () => clearTimeout(t)
  }, [status, fetchStats])

  if (status === 'loading') {
    return (
      <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
    )
  }

  if (!session) return null

  const userName = session.user?.name ?? session.user?.email ?? 'there'

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      {/* ── Beta banner ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900 rounded-lg text-sm">
        <span className="text-emerald-700 dark:text-emerald-200 font-medium">
          🎉 OutreachAI is in beta — all features are free, forever for early users.
        </span>
        <span className="sm:ml-auto">
          <Link href="/settings/team" className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 dark:text-emerald-200 hover:underline">
            Invite your team →
          </Link>
        </span>
      </div>

      {/* ── Top bar (welcome) ── */}
      <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white whitespace-nowrap">
            Welcome back, {userName.split(' ')[0]}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Here&apos;s what&apos;s happening with your outreach.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <a
            href="https://www.producthunt.com/products/outreachai-in?launch=outreachai-in"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-semibold text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-4 py-2 hover:bg-orange-100 transition-colors"
          >
            We&apos;re live on Product Hunt — support us!
          </a>
          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
            All features free during beta
          </span>
        </div>
      </div>

      {/* ── Book a demo card ── */}
      {/* ── Onboarding checklist ── */}
      <OnboardingChecklist />

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 animate-pulse"
            >
              <div className="h-8 bg-gray-100 dark:bg-gray-700 rounded mb-2 w-16" />
              <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-24" />
            </div>
          ))
        ) : (
          <>
            <StatCard
              icon={<Users className="w-5 h-5" />}
              color="text-blue-600 bg-blue-50"
              value={stats?.totalLeads ?? 0}
              label="Total Leads"
            />
            <StatCard
              icon={<Megaphone className="w-5 h-5" />}
              color="text-green-600 bg-green-50"
              value={stats?.activeCampaigns ?? 0}
              label="Active Campaigns"
            />
            <StatCard
              icon={<Mail className="w-5 h-5" />}
              color="text-blue-600 bg-blue-50"
              value={stats?.emailsSent ?? 0}
              label="Emails Sent"
              sparkline={stats?.sparklineEmailsSent}
              sparklineColor="#3b82f6"
            />
            <StatCard
              icon={<MessageSquare className="w-5 h-5" />}
              color="text-purple-600 bg-purple-50"
              value={stats?.totalReplies ?? stats?.replies ?? 0}
              label="Replies"
              sparkline={stats?.sparklineReplies}
              sparklineColor="#8b5cf6"
            />
          </>
        )}
      </div>

      {/* ── Pipeline card ── */}
      <div className="mb-6">
        <Link
          href="/pipeline"
          className="block bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm transition-all group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg text-blue-600 bg-blue-50 flex-shrink-0">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Pipeline</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Sales pipeline</p>
              </div>
            </div>
            <span className="text-xs text-blue-600 dark:text-blue-400 font-medium group-hover:underline">View →</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Total pipeline</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">
                {statsLoading ? '—' : pipelineStats ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(pipelineStats.totalPipeline) : '$0'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Open deals</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">
                {statsLoading ? '—' : pipelineStats?.openDeals ?? 0}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Close rate</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">
                {statsLoading ? '—' : `${pipelineStats?.closeRate ?? 0}%`}
              </p>
            </div>
          </div>
        </Link>
      </div>

      {/* ── Quick actions ── */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Link href="/campaigns/new" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          <Plus className="w-4 h-4" /> New campaign
        </Link>
        <Link href="/leads" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          <Users className="w-4 h-4" /> Import leads
        </Link>
        <Link href="/inbox" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          <MessageSquare className="w-4 h-4" /> Open inbox
        </Link>
      </div>
    </div>
  )
}

function StatCard({
  icon,
  color,
  value,
  label,
  sparkline,
  sparklineColor,
}: {
  icon: React.ReactNode
  color: string
  value: string | number
  label: string
  sparkline?: number[]
  sparklineColor?: string
}) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex items-center gap-4">
      <div
        className={`flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0 ${color}`}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
        {sparkline && sparkline.length >= 2 && (
          <div className="mt-1.5">
            <Sparkline data={sparkline} color={sparklineColor} />
          </div>
        )}
      </div>
    </div>
  )
}
