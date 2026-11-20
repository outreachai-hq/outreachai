'use client'

import { useState, useEffect, useCallback } from 'react'
import { HelpPanel } from '@/components/HelpPanel'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Megaphone, Mail, Users, Eye, AlertTriangle } from 'lucide-react'

interface MarketingCampaign {
  id: string
  name: string
  subject: string
  fromName: string
  status: string
  createdAt: string
  sentAt: string | null
  _count: { sends: number }
  emailAccount: { id: string; name: string; email: string } | null
  leadList: { id: string; name: string } | null
}

interface StatsMap {
  [id: string]: {
    sent: number
    delivered: number
    opened: number
    bounced: number
    complained: number
    openRate: number
    bounceRate: number
    complaintRate: number
  }
}

const STATUS_STYLES: Record<string, string> = {
  draft:      'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300',
  scheduled:  'bg-yellow-50 text-yellow-700 border border-yellow-200 dark:bg-yellow-900/60 dark:text-yellow-300 dark:border-yellow-700/50',
  sending:    'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-600/50',
  sent:       'bg-green-50 text-green-700 border border-green-200 dark:bg-green-900 dark:text-green-200 dark:border-green-600/50',
  paused:     'bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-900/60 dark:text-orange-300 dark:border-orange-700/50',
  ab_testing: 'bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-900 dark:text-purple-200 dark:border-purple-600/50',
}

const STATUS_LABEL: Record<string, string> = {
  ab_testing: 'A/B Testing',
}

const BORDER_COLOR: Record<string, string> = {
  draft:      'border-l-gray-300',
  scheduled:  'border-l-amber-400',
  sending:    'border-l-blue-400',
  sent:       'border-l-green-500',
  paused:     'border-l-orange-400',
  ab_testing: 'border-l-yellow-400',
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return null
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function MarketingPage() {
  const { status } = useSession()
  const router = useRouter()
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([])
  const [loading, setLoading] = useState(true)
  const [statsMap, setStatsMap] = useState<StatsMap>({})

  const fetchCampaigns = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/marketing/campaigns')
    if (res.ok) {
      const data = await res.json()
      const list: MarketingCampaign[] = Array.isArray(data) ? data : []
      setCampaigns(list)
      // Fetch stats for sent/ab_testing campaigns
      const sentCampaigns = list.filter((c) => c.status === 'sent' || c.status === 'ab_testing')
      const statsResults = await Promise.all(
        sentCampaigns.map((c) =>
          fetch(`/api/marketing/campaigns/${c.id}/stats`)
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => ({ id: c.id, data: d }))
        )
      )
      const newStatsMap: StatsMap = {}
      for (const { id, data } of statsResults) {
        if (data) {
          newStatsMap[id] = {
            sent: data.sent,
            delivered: data.delivered ?? 0,
            opened: data.opened,
            bounced: data.bounced ?? 0,
            complained: data.complained ?? 0,
            openRate: data.openRate,
            bounceRate: data.bounceRate ?? 0,
            complaintRate: data.complaintRate ?? 0,
          }
        }
      }
      setStatsMap(newStatsMap)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login')
    if (status === 'authenticated') {
      fetchCampaigns()
    }
  }, [status, fetchCampaigns, router])

  if (status === 'loading' || loading) {
    return <div className="p-8 text-center text-gray-400 text-sm">Loading campaigns…</div>
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Marketing</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Send broadcast emails to your lead lists.
          </p>
        </div>
        <Link
          href="/marketing/new"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Campaign
        </Link>
      </div>

      {/* Empty state */}
      {campaigns.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 py-20 text-center">
          <Megaphone className="w-12 h-12 text-gray-200 mx-auto mb-4" />
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            No marketing campaigns yet. Create your first one.
          </p>
          <Link
            href="/marketing/new"
            className="mt-4 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Campaign
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {campaigns.map((c) => {
            const borderColor = BORDER_COLOR[c.status] ?? 'border-l-gray-300'
            const href =
              c.status === 'sent' || c.status === 'ab_testing'
                ? `/marketing/${c.id}/stats`
                : `/marketing/${c.id}/edit`
            const stats         = statsMap[c.id]
            const openRatePct   = stats ? `${(stats.openRate * 100).toFixed(1)}%` : null
            const bounceWarning = stats && stats.bounceRate > 0.02
            const spamWarning   = stats && stats.complaintRate > 0.001

            return (
              <div
                key={c.id}
                className={`bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 border-l-4 ${borderColor} p-5 hover:shadow-md transition-shadow`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">
                    {c.name}
                  </h3>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {(bounceWarning || spamWarning) && (
                      <span title="Bounce or complaint rate too high">
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                      </span>
                    )}
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[c.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_LABEL[c.status] ?? c.status}
                    </span>
                  </div>
                </div>

                {/* Subject */}
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate mb-3">
                  <span className="font-medium">Subject:</span> {c.subject}
                </p>

                {/* Stats row */}
                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mb-3">
                  <span className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-gray-400" />
                    {stats?.sent ?? c._count.sends} sent
                  </span>
                  {openRatePct && (
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <Eye className="w-3 h-3" />
                      {openRatePct}
                    </span>
                  )}
                  {stats && stats.bounced > 0 && (
                    <span className={`${bounceWarning ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-orange-500'}`}>
                      {stats.bounced} bounced
                    </span>
                  )}
                  {stats && stats.complained > 0 && (
                    <span className={`${spamWarning ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-yellow-600'}`}>
                      {stats.complained} spam
                    </span>
                  )}
                </div>

                {/* Health warnings */}
                {bounceWarning && (
                  <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-md px-2.5 py-1.5 mb-3 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    Bounce rate {(stats!.bounceRate * 100).toFixed(1)}% — above 2% threshold
                  </p>
                )}
                {spamWarning && (
                  <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-md px-2.5 py-1.5 mb-3 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    Complaint rate {(stats!.complaintRate * 100).toFixed(2)}% — above 0.1% threshold
                  </p>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
                  {c.leadList && (
                    <span className="flex items-center gap-1.5 truncate">
                      <Users className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{c.leadList.name}</span>
                    </span>
                  )}
                  <span className="ml-auto flex-shrink-0">
                    {c.sentAt ? `Sent ${formatDate(c.sentAt)}` : `Created ${formatDate(c.createdAt)}`}
                  </span>
                </div>

                <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
                  <Link
                    href={href}
                    className="flex items-center justify-center gap-1.5 w-full text-xs font-medium text-blue-600 hover:text-blue-700 border border-blue-200 hover:border-blue-300 bg-blue-50 hover:bg-blue-100 rounded-lg py-2 transition-colors"
                  >
                    {(c.status === 'sent' || c.status === 'ab_testing') ? 'View Stats →' : 'Open Editor →'}
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
      <HelpPanel
        title='Marketing Campaigns'
        description='Send one-shot email blasts to your entire lead list. Unlike outreach sequences, marketing campaigns send to everyone at once — like a newsletter.'
        sections={[
        { title: 'Outreach vs Marketing', content: 'Outreach campaigns send personalised, multi-step messages over days/weeks. Marketing campaigns send one email to everyone at once — announcements, product updates, newsletters.', example: 'Outreach: "Hi Anjali, I noticed you\'re the VP Sales at Meesho..." sent on day 1, 4, 7. Marketing: "🎉 Announcing our new feature" sent to all 500 leads simultaneously.', tip: 'Use outreach for prospecting. Use marketing for existing contacts and product updates.' },
        { title: 'Creating a campaign', content: 'New Campaign → choose a name, subject line, lead list, and from email. Write your HTML body or paste formatted content. Preview with real lead data → Send.', example: '"June Product Update" → Subject: "What\'s new at OutreachAI this month" → 500 leads → From: newsletter@yourcompany.com → Send.', tip: 'Personalise even marketing emails: "Hi {{firstName}}" makes open rates 26% higher on average.' },
        { title: 'A/B testing subject lines', content: 'Enable A/B → write two subject lines and set the split percentage. OutreachAI sends version A to X% of leads, version B to the rest. Check stats after 24h to see the winner.', example: 'Subject A: "New feature alert" (40% of list) vs Subject B: "You asked, we built it" (60% of list). After 24h: A = 18% open, B = 31% open. B wins.' },
        { title: 'Reading the stats', content: 'Sent = emails delivered. Open rate = % who opened. Click rate = % who clicked any link. Unsubscribed = opted out.', example: '500 sent, 120 opened (24%), 35 clicked (7%), 3 unsubscribed (0.6%). Good performance — industry averages are 20% open, 2-5% click.', tip: "A click rate above 3% means your content and CTA are working. Below 1% means the email is interesting but the ask isn't clear." },
        ]}
      />
    </div>
  )
}
