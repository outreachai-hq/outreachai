'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Zap } from 'lucide-react'
import { AddToPipelineButton } from '@/components/AddToPipelineButton'
import { chipClass, chipLabel } from '@/lib/chipStatus'

interface HotLead {
  id: string
  profileId?: string
  firstName: string
  lastName: string | null
  company: string | null
  headline: string | null
  linkedinUrl: string | null
  email: string | null
  score: number
  signal: string
  status: string
  campaignName: string | null
  lastActivityAt: string | null
}

function getAvatarColor(name: string): string {
  const colors = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899', '#14B8A6', '#6366F1', '#EF4444']
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

function ScoreStars({ score }: { score: number }) {
  if (score >= 80) {
    return <span className="text-amber-400 text-sm">⭐⭐⭐</span>
  } else if (score >= 60) {
    return <span className="text-amber-400 text-sm">⭐⭐</span>
  } else if (score >= 40) {
    return <span className="text-amber-400 text-sm">⭐</span>
  }
  return <span className="text-gray-300 text-sm">—</span>
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={chipClass(status)}>
      {chipLabel(status)}
    </span>
  )
}

type TabKey = 'all' | 'replied' | 'high_score' | 'followup'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'replied', label: 'Replied' },
  { key: 'high_score', label: 'High Score' },
  { key: 'followup', label: 'Awaiting followup' },
]

function filterLeads(leads: HotLead[], tab: TabKey): HotLead[] {
  switch (tab) {
    case 'replied':
      return leads.filter((l) => l.status.toLowerCase() === 'replied')
    case 'high_score':
      return leads.filter((l) => l.score >= 80)
    case 'followup':
      return leads.filter((l) => l.status.toLowerCase() === 'followup')
    default:
      return leads
  }
}

export default function HotLeadsPage() {
  const { status } = useSession()
  const router = useRouter()
  const [leads, setLeads] = useState<HotLead[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>('all')

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/leads/hot')
      if (res.ok) {
        const data = await res.json()
        setLeads(Array.isArray(data) ? data : [])
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login')
    if (status === 'authenticated') fetchLeads()
  }, [status, fetchLeads, router])

  const filteredLeads = filterLeads(leads, activeTab)

  if (status === 'loading' || loading) {
    return (
      <div className="p-8 text-center text-gray-400 dark:text-gray-500 text-sm">
        Loading hot leads…
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Zap className="w-6 h-6 text-amber-400" />
            Hot Leads ({leads.length})
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            AI-surfaced leads showing high purchase intent. Follow up now.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-700 overflow-x-auto no-scrollbar">
        {TABS.map((tab) => {
          const count = filterLeads(leads, tab.key).length
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span
                  className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                    activeTab === tab.key
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200'
                      : 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-300'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Empty state */}
      {filteredLeads.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 py-20 text-center">
          <Zap className="w-12 h-12 text-gray-200 dark:text-gray-700 mx-auto mb-4" />
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">No hot leads here yet</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 max-w-sm mx-auto">
            Hot leads are contacts who have shown strong buying signals — like replying to your emails,
            opening them multiple times, or accepting a LinkedIn connection. They will appear here automatically
            as your campaigns run.
          </p>
        </div>
      ) : (
        /* Table */
        <div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
          Score legend: ⭐⭐⭐ = 80+&nbsp;&nbsp;⭐⭐ = 60+&nbsp;&nbsp;⭐ = 40+
        </p>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                  <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 px-4 py-3 w-24">Score</th>
                  <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 px-4 py-3">Lead</th>
                  <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 px-4 py-3">Company</th>
                  <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 px-4 py-3">Signal</th>
                  <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 px-4 py-3">Campaign</th>
                  <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 px-4 py-3">Status</th>
                  <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {filteredLeads.map((lead) => {
                  const fullName = [lead.firstName, lead.lastName].filter(Boolean).join(' ') || 'Unknown'
                  const initials = fullName
                    .split(' ')
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((w) => w[0].toUpperCase())
                    .join('')
                  const avatarColor = getAvatarColor(fullName)

                  return (
                    <tr key={lead.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      {/* Score */}
                      <td className="px-4 py-3">
                        <ScoreStars score={lead.score} />
                      </td>

                      {/* Avatar + Name + Headline */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold"
                            style={{ backgroundColor: avatarColor }}
                          >
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 dark:text-white truncate">{fullName}</p>
                            {lead.headline && (
                              <p className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-[200px]">
                                {lead.headline}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Company */}
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                        {lead.company ?? <span className="text-gray-300 dark:text-gray-600">—</span>}
                      </td>

                      {/* Signal */}
                      <td className="px-4 py-3">
                        <span className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full px-2 py-0.5 text-xs whitespace-nowrap">
                          {lead.signal}
                        </span>
                      </td>

                      {/* Campaign */}
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                        {lead.campaignName ?? <span className="text-gray-300 dark:text-gray-600">—</span>}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <StatusBadge status={lead.status} />
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <a
                            href={`/inbox?profileId=${lead.profileId ?? lead.id}`}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 rounded-md transition-colors whitespace-nowrap"
                          >
                            Reply
                          </a>
                          {lead.linkedinUrl ? (
                            <a
                              href={lead.linkedinUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 text-xs px-3 py-1.5 rounded-md transition-colors whitespace-nowrap"
                            >
                              Schedule call
                            </a>
                          ) : (
                            <button
                              disabled
                              className="border border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-600 text-xs px-3 py-1.5 rounded-md cursor-not-allowed whitespace-nowrap"
                            >
                              Schedule call
                            </button>
                          )}
                          <AddToPipelineButton
                            contactName={fullName}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        </div>
      )}
    </div>
  )
}
