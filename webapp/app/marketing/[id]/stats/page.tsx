'use client'

import { useState, useEffect, use, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Mail, Eye, MousePointerClick, UserMinus, Trophy, Loader2,
  CheckCircle2, XCircle, AlertTriangle, ShieldAlert,
} from 'lucide-react'

interface MarketingCampaign {
  id: string
  name: string
  subject: string
  status: string
  sentAt: string | null
  abEnabled: boolean
  abSubjectB: string | null
  abWinner: string | null
  _count: { sends: number }
  emailAccount: { id: string; name: string; email: string } | null
  leadList: { id: string; name: string } | null
}

interface AbVariantStats {
  sent: number
  opened: number
  clicked: number
  openRate: number
}

interface CampaignStats {
  total: number
  sent: number
  delivered: number
  bounced: number
  complained: number
  failed: number
  opened: number
  clicked: number
  unsubscribed: number
  openRate: number
  clickRate: number
  unsubRate: number
  bounceRate: number
  complaintRate: number
  deliveryRate: number
  ab?: {
    enabled: boolean
    variantA: AbVariantStats
    variantB: AbVariantStats
    winner: string | null
    remainingSent: number
  }
}

function StatCard({
  label, value, sub, icon: Icon, color, warning,
}: {
  label: string
  value: number | string
  sub?: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  warning?: boolean
}) {
  return (
    <div className={`bg-white dark:bg-gray-900 rounded-xl border p-5 ${
      warning
        ? 'border-red-300 dark:border-red-700 ring-1 ring-red-200 dark:ring-red-800'
        : 'border-gray-200 dark:border-gray-700'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</p>
        <span className={`p-2 rounded-lg ${color}`}><Icon className="w-4 h-4" /></span>
      </div>
      <p className={`text-2xl font-bold ${warning ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
        {value}
      </p>
      {sub && (
        <p className={`text-xs mt-1 ${warning ? 'text-red-500 dark:text-red-400' : 'text-gray-400'}`}>
          {sub}
        </p>
      )}
    </div>
  )
}

// Horizontal health bar: green < threshold, red if over
function HealthBar({ label, rate, threshold, good }: {
  label: string
  rate: number
  threshold: number
  good: 'low' | 'high'
}) {
  const pct  = Math.min(rate * 100, 100)
  const over = good === 'low' ? rate > threshold : rate < threshold
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{label}</span>
        <span className={`text-xs font-bold ${over ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
          {(rate * 100).toFixed(2)}%
          {over && ' ⚠'}
        </span>
      </div>
      <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-2 rounded-full transition-all ${over ? 'bg-red-500' : 'bg-emerald-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-gray-400 mt-1">
        {good === 'low'
          ? `Threshold: keep below ${(threshold * 100).toFixed(0)}%`
          : `Target: above ${(threshold * 100).toFixed(0)}%`}
      </p>
    </div>
  )
}

function VariantBar({ label, subject, stats, isWinner, winnerLabel }: {
  label: string
  subject: string
  stats: AbVariantStats
  isWinner: boolean
  winnerLabel: string
}) {
  const pct = Math.round(stats.openRate * 100)
  return (
    <div className={`rounded-lg border p-4 ${isWinner ? 'border-green-300 bg-green-50 dark:bg-green-900/20 dark:border-green-600' : 'border-gray-200 dark:border-gray-700'}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-semibold text-gray-900 dark:text-white">Variant {label}</span>
        {isWinner && (
          <span className="flex items-center gap-1 text-xs font-semibold text-green-700 dark:text-green-400">
            <Trophy className="w-3.5 h-3.5" /> {winnerLabel}
          </span>
        )}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 truncate mb-2">&ldquo;{subject}&rdquo;</p>
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-2 overflow-hidden">
          <div
            className={`h-2 rounded-full transition-all ${isWinner ? 'bg-green-500' : 'bg-blue-400'}`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
        <span className="text-sm font-bold text-gray-900 dark:text-white w-12 text-right">{pct}%</span>
        <span className="text-xs text-gray-400">{stats.sent} sent</span>
      </div>
    </div>
  )
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function MarketingStatsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }    = use(params)
  const { status } = useSession()
  const router    = useRouter()

  const [campaign,  setCampaign]  = useState<MarketingCampaign | null>(null)
  const [stats,     setStats]     = useState<CampaignStats | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [notFound,  setNotFound]  = useState(false)
  const [resolving, setResolving] = useState(false)
  const [resolveMsg, setResolveMsg] = useState('')

  const loadData = useCallback(async () => {
    const [campaignData, statsData] = await Promise.all([
      fetch(`/api/marketing/campaigns/${id}`).then((r) => {
        if (r.status === 404) { setNotFound(true); return null }
        return r.ok ? r.json() : null
      }),
      fetch(`/api/marketing/campaigns/${id}/stats`).then((r) => (r.ok ? r.json() : null)),
    ])
    if (campaignData) setCampaign(campaignData)
    if (statsData) setStats(statsData)
  }, [id])

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login')
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    loadData().finally(() => setLoading(false))
  }, [status, loadData])

  async function handleResolve() {
    setResolving(true)
    setResolveMsg('')
    const res = await fetch(`/api/marketing/campaigns/${id}/ab-resolve`, { method: 'POST' })
    setResolving(false)
    if (res.ok) {
      const data = await res.json()
      setResolveMsg(`Winner: Variant ${(data.winner as string).toUpperCase()} — ${data.remainingSent} remaining recipients sent.`)
      await loadData()
    } else {
      const data = await res.json().catch(() => ({}))
      setResolveMsg(data.error ?? 'Failed to resolve winner.')
    }
  }

  if (status === 'loading' || loading) {
    return <div className="p-8 text-center text-gray-400 text-sm">Loading stats…</div>
  }

  if (notFound || !campaign) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500 dark:text-gray-400">Campaign not found.</p>
        <Link href="/marketing" className="mt-3 inline-block text-sm text-blue-600 hover:underline">Back to Marketing</Link>
      </div>
    )
  }

  const totalSent     = stats?.sent ?? 0
  const delivered     = stats?.delivered ?? 0
  const opened        = stats?.opened ?? 0
  const clicked       = stats?.clicked ?? 0
  const unsubscribed  = stats?.unsubscribed ?? 0
  const bounced       = stats?.bounced ?? 0
  const complained    = stats?.complained ?? 0
  const openRate      = stats ? `${(stats.openRate * 100).toFixed(1)}%` : '—'
  const clickRate     = stats ? `${(stats.clickRate * 100).toFixed(1)}%` : '—'
  const unsubRate     = stats ? `${(stats.unsubRate * 100).toFixed(1)}%` : '—'
  const deliveryRate  = stats ? `${(stats.deliveryRate * 100).toFixed(1)}%` : '—'
  const bounceRate    = stats?.bounceRate ?? 0
  const complaintRate = stats?.complaintRate ?? 0
  const ab            = stats?.ab

  const bounceWarning    = bounceRate > 0.02    // SES suspends at 2%
  const complaintWarning = complaintRate > 0.001 // SES suspends at 0.1%

  return (
    <div className="p-8 max-w-5xl">
      <Link
        href="/marketing"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Marketing
      </Link>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{campaign.name}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Subject: {campaign.subject}
            {campaign.sentAt && (
              <span className="ml-3 text-gray-400">· Sent {formatDate(campaign.sentAt)}</span>
            )}
          </p>
        </div>
        <Link href={`/marketing/${id}/edit`} className="flex-shrink-0 text-sm text-blue-600 hover:underline">
          View campaign
        </Link>
      </div>

      {/* ── Row 1: Engagement stats ── */}
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Engagement</p>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
        <StatCard
          label="Sent"
          value={totalSent}
          sub={delivered > 0 ? `${deliveryRate} delivered` : undefined}
          icon={Mail}
          color="bg-blue-50 text-blue-600 dark:bg-blue-900 dark:text-blue-400"
        />
        <StatCard
          label="Delivered"
          value={delivered}
          sub={deliveryRate !== '—' ? `${deliveryRate} delivery rate` : undefined}
          icon={CheckCircle2}
          color="bg-teal-50 text-teal-600 dark:bg-teal-900 dark:text-teal-400"
        />
        <StatCard
          label="Opened"
          value={opened}
          sub={`${openRate} open rate`}
          icon={Eye}
          color="bg-emerald-50 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-400"
        />
        <StatCard
          label="Clicked"
          value={clicked}
          sub={`${clickRate} click rate`}
          icon={MousePointerClick}
          color="bg-purple-50 text-purple-600 dark:bg-purple-900 dark:text-purple-400"
        />
      </div>

      {/* ── Row 2: Deliverability stats ── */}
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 mt-6">Deliverability</p>
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
        <StatCard
          label="Bounced"
          value={bounced}
          sub={bounceWarning ? '⚠ Above 2% — SES may pause sending' : `${(bounceRate * 100).toFixed(2)}% bounce rate`}
          icon={XCircle}
          color={bounceWarning ? 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400' : 'bg-orange-50 text-orange-500 dark:bg-orange-900 dark:text-orange-400'}
          warning={bounceWarning}
        />
        <StatCard
          label="Complained"
          value={complained}
          sub={complaintWarning ? '⚠ Above 0.1% — SES may pause sending' : `${(complaintRate * 100).toFixed(3)}% complaint rate`}
          icon={ShieldAlert}
          color={complaintWarning ? 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400' : 'bg-yellow-50 text-yellow-500 dark:bg-yellow-900 dark:text-yellow-400'}
          warning={complaintWarning}
        />
        <StatCard
          label="Unsubscribed"
          value={unsubscribed}
          sub={`${unsubRate} unsub rate`}
          icon={UserMinus}
          color="bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
        />
      </div>

      {/* ── Deliverability health bars ── */}
      {totalSent > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Sender Reputation Health</h2>
            {(bounceWarning || complaintWarning) ? (
              <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 font-medium">
                <AlertTriangle className="w-3.5 h-3.5" /> Action required
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> Healthy
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <HealthBar label="Bounce rate" rate={bounceRate} threshold={0.02} good="low" />
            <HealthBar label="Complaint rate" rate={complaintRate} threshold={0.001} good="low" />
            <HealthBar label="Delivery rate" rate={stats?.deliveryRate ?? 0} threshold={0.95} good="high" />
          </div>
        </div>
      )}

      {/* ── A/B Test Results ── */}
      {ab?.enabled && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">A/B Test Results</h2>
            {resolveMsg && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{resolveMsg}</span>
            )}
          </div>
          <div className="space-y-3 mb-4">
            <VariantBar label="A" subject={campaign.subject} stats={ab.variantA} isWinner={ab.winner === 'a'} winnerLabel="Winner" />
            <VariantBar label="B" subject={campaign.abSubjectB ?? ''} stats={ab.variantB} isWinner={ab.winner === 'b'} winnerLabel="Winner" />
          </div>
          {ab.winner ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Winner sent to <span className="font-semibold text-gray-700 dark:text-gray-300">{ab.remainingSent}</span> remaining recipients.
            </p>
          ) : campaign.status === 'ab_testing' ? (
            <div className="flex items-center gap-3">
              <button
                onClick={handleResolve}
                disabled={resolving}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                {resolving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trophy className="w-4 h-4" />}
                {resolving ? 'Resolving…' : 'Resolve Winner Now'}
              </button>
              <p className="text-xs text-gray-400">Test still running — resolve manually or wait for auto-resolve.</p>
            </div>
          ) : null}
        </div>
      )}

      {/* ── Campaign Summary ── */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Campaign Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Total recipients</p>
            <p className="text-gray-900 dark:text-white font-medium">{stats?.total ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Successfully sent</p>
            <p className="text-gray-900 dark:text-white font-medium">{totalSent}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Failed to send</p>
            <p className="text-gray-900 dark:text-white font-medium">{stats?.failed ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Suppressed</p>
            <p className="text-gray-900 dark:text-white font-medium">{bounced + complained}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Email account</p>
            <p className="text-gray-900 dark:text-white font-medium truncate">{campaign.emailAccount?.email ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Lead list</p>
            <p className="text-gray-900 dark:text-white font-medium">{campaign.leadList?.name ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Sent at</p>
            <p className="text-gray-900 dark:text-white font-medium">{formatDate(campaign.sentAt)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
