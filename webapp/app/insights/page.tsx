'use client'

// Plan 10 — Insights page. Stack of cards computed from existing data.
// No LLM call in v1.

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Sparkles, ArrowRight, TrendingUp, TrendingDown, AlertCircle, AlertTriangle, Loader2 } from 'lucide-react'

type Insight = {
  id:       string
  severity: 'info' | 'good' | 'warn' | 'critical'
  title:    string
  body:     string
  href?:    string
}

const SEV_META: Record<Insight['severity'], { icon: typeof TrendingUp; iconBg: string; iconColor: string; border: string }> = {
  info:     { icon: Sparkles,        iconBg: 'bg-blue-50 dark:bg-blue-900',     iconColor: 'text-blue-600 dark:text-blue-400',  border: 'border-blue-100 dark:border-blue-600' },
  good:     { icon: TrendingUp,      iconBg: 'bg-green-50 dark:bg-green-900',   iconColor: 'text-green-600 dark:text-green-400', border: 'border-green-100 dark:border-green-600' },
  warn:     { icon: AlertTriangle,   iconBg: 'bg-amber-50 dark:bg-amber-900/60',   iconColor: 'text-amber-600 dark:text-amber-400', border: 'border-amber-100 dark:border-amber-700' },
  critical: { icon: AlertCircle,     iconBg: 'bg-red-50 dark:bg-red-900',       iconColor: 'text-red-600 dark:text-red-400',   border: 'border-red-100 dark:border-red-600' },
}

export default function InsightsPage() {
  const { status } = useSession()
  const router = useRouter()
  const [insights, setInsights] = useState<Insight[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login')
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    fetch('/api/insights')
      .then((r) => (r.ok ? r.json() : { insights: [] }))
      .then((d) => setInsights(d.insights ?? []))
      .finally(() => setLoading(false))
  }, [status])

  return (
    <div className="max-w-3xl mx-auto p-6 md:p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-violet-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Insights</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">Patterns we noticed across your outreach this week.</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : insights.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
          <Sparkles className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Nothing standing out yet. Insights surface here once you&apos;ve sent a few campaigns.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {insights.map((ins) => {
            const m = SEV_META[ins.severity]
            const card = (
              <div className={`flex items-start gap-3 px-4 py-3.5 bg-white dark:bg-gray-900 rounded-xl border ${m.border} hover:shadow-sm transition-shadow`}>
                <div className={`w-9 h-9 rounded-lg ${m.iconBg} flex items-center justify-center flex-shrink-0`}>
                  <m.icon className={`w-4.5 h-4.5 ${m.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{ins.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{ins.body}</p>
                </div>
                {ins.href && (
                  <ArrowRight className="w-4 h-4 text-gray-400 mt-2 flex-shrink-0" />
                )}
              </div>
            )
            return (
              <li key={ins.id}>
                {ins.href ? <Link href={ins.href} className="block">{card}</Link> : card}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
