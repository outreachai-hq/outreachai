'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Globe, Copy, Check, ArrowLeft, Users } from 'lucide-react'

interface WebsiteVisit {
  id: string
  resolvedOrg: string | null
  matchedLeadId: string | null
  matchedContactId: string | null
  matchedCompanyId: string | null
  url: string | null
  referrer: string | null
  ip: string | null
  visitedAt: string
}

interface SetupData {
  trackingId: string
  snippet: string
  beaconUrl: string
}

function formatRelTime(dateStr: string) {
  const d = new Date(dateStr)
  const diff = Date.now() - d.getTime()
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function truncateUrl(url: string | null) {
  if (!url) return '—'
  try {
    const u = new URL(url)
    const path = u.pathname + (u.search ? u.search : '')
    return path.length > 60 ? path.slice(0, 57) + '…' : path
  } catch {
    return url.length > 60 ? url.slice(0, 57) + '…' : url
  }
}

export default function WebsiteTrackingPage() {
  const { status } = useSession()
  const router = useRouter()
  const [setup, setSetup] = useState<SetupData | null>(null)
  const [visits, setVisits] = useState<WebsiteVisit[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'all' | 'identified'>('all')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login')
  }, [status, router])

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [setupRes, visitsRes] = await Promise.all([
      fetch('/api/track/setup'),
      fetch('/api/track/visits?limit=50'),
    ])
    if (setupRes.ok) setSetup(await setupRes.json())
    if (visitsRes.ok) {
      const d = await visitsRes.json()
      setVisits(d.visits ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (status === 'authenticated') fetchData()
  }, [status, fetchData])

  const fetchTabVisits = useCallback(async (t: 'all' | 'identified') => {
    const url = t === 'identified'
      ? '/api/track/visits?limit=50&matchedOnly=true'
      : '/api/track/visits?limit=50'
    const res = await fetch(url)
    if (res.ok) {
      const d = await res.json()
      setVisits(d.visits ?? [])
    }
  }, [])

  function handleTabChange(t: 'all' | 'identified') {
    setTab(t)
    fetchTabVisits(t)
  }

  async function copySnippet() {
    if (!setup?.snippet) return
    await navigator.clipboard.writeText(setup.snippet)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (status === 'loading' || loading) {
    return <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
  }

  const identifiedCount = visits.filter(
    v => v.matchedLeadId || v.matchedContactId || v.matchedCompanyId
  ).length

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Globe className="w-5 h-5 text-emerald-500" /> Website Visitor Tracking
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            See which companies visit your website and get notified of buying signals
          </p>
        </div>
      </div>

      {/* Setup section */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Snippet setup</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Paste this snippet in the <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-[11px]">&lt;head&gt;</code> of every page you want to track
            </p>
          </div>
          {setup?.trackingId && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 rounded-full border border-emerald-100 dark:border-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Active
            </span>
          )}
        </div>

        {setup?.snippet && (
          <div className="relative">
            <pre className="bg-gray-900 text-emerald-400 text-xs rounded-xl p-4 overflow-x-auto font-mono leading-relaxed">
              {setup.snippet}
            </pre>
            <button
              onClick={copySnippet}
              className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs font-medium transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        )}

        <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
          Tracking ID: <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded font-mono text-[11px] text-gray-600 dark:text-gray-300">{setup?.trackingId ?? '—'}</code>
        </p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Total visits</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{visits.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Identified</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{identifiedCount}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Identify rate</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {visits.length > 0 ? `${Math.round((identifiedCount / visits.length) * 100)}%` : '—'}
          </p>
        </div>
      </div>

      {/* Visits table */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
        {/* Tabs */}
        <div className="flex items-center gap-1 p-3 border-b border-gray-100 dark:border-gray-800">
          <div className="flex gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            {(['all', 'identified'] as const).map((t) => (
              <button
                key={t}
                onClick={() => handleTabChange(t)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  tab === t
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                }`}
              >
                {t === 'all' ? 'All visits' : 'Identified only'}
              </button>
            ))}
          </div>
        </div>

        {visits.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mb-4">
              <Globe className="w-7 h-7 text-emerald-400" />
            </div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">No visits yet</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 max-w-xs">
              Install the snippet on your website and visits will appear here automatically
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
                  <th className="px-4 py-3 font-medium">Company / Org</th>
                  <th className="px-4 py-3 font-medium">Matched</th>
                  <th className="px-4 py-3 font-medium">Page</th>
                  <th className="px-4 py-3 font-medium text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {visits.map((v) => {
                  const isIdentified = !!(v.matchedLeadId || v.matchedContactId || v.matchedCompanyId)
                  return (
                    <tr key={v.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                            <Globe className="w-3.5 h-3.5 text-gray-400" />
                          </div>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {v.resolvedOrg ?? (v.ip ? `IP: ${v.ip}` : 'Anonymous')}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {isIdentified ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">
                            <Users className="w-3 h-3" /> Identified
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-gray-500">Unknown</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                          {truncateUrl(v.url)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-xs text-gray-400">{formatRelTime(v.visitedAt)}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
