'use client'

import { useState, useEffect, use } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Flame } from 'lucide-react'

interface WarmupEmail {
  id: string
  direction: string
  fromEmail: string
  toEmail: string
  subject: string
  replied: boolean
  repliedAt: string | null
  sentAt: string
}

interface WarmupAccount {
  id: string
  status: string
  dailyTarget: number
  currentDay: number
  totalSent: number
  totalReceived: number
  totalReplied: number
  startedAt: string
  lastRunAt: string | null
  emailAccount: { id: string; name: string; email: string }
  sentEmails: WarmupEmail[]
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day:   'numeric',
    hour:  '2-digit',
    minute:'2-digit',
  })
}

export default function WarmupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { status } = useSession()
  const router = useRouter()
  const [account, setAccount] = useState<WarmupAccount | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login')
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    fetch(`/api/warmup/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setAccount(d?.account ?? null)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id, status])

  if (status === 'loading' || loading) {
    return <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
  }

  if (!account) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-gray-500">Warmup account not found.</p>
        <Link href="/warmup" className="mt-4 inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
          <ArrowLeft className="w-4 h-4" /> Back to Warmup
        </Link>
      </div>
    )
  }

  const statusCls =
    account.status === 'active'
      ? 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-950 dark:text-green-200 dark:border-green-600'
      : 'bg-yellow-50 text-yellow-700 border border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-700'

  return (
    <div className="p-8 max-w-4xl">
      {/* Back */}
      <Link
        href="/warmup"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Warmup
      </Link>

      {/* Account header */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-500" />
              {account.emailAccount.name}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{account.emailAccount.email}</p>
          </div>
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${statusCls}`}>
            {account.status}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Day', value: account.currentDay },
            { label: 'Total Sent', value: account.totalSent },
            { label: 'Total Received', value: account.totalReceived },
            { label: 'Total Replied', value: account.totalReplied },
          ].map(({ label, value }) => (
            <div key={label} className="text-center bg-gray-50 dark:bg-gray-800 rounded-lg py-3">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 flex gap-4">
          <span>Daily target: <strong className="text-gray-700 dark:text-gray-300">{account.dailyTarget}</strong></span>
          <span>Started: <strong className="text-gray-700 dark:text-gray-300">{formatDate(account.startedAt)}</strong></span>
          {account.lastRunAt && (
            <span>Last run: <strong className="text-gray-700 dark:text-gray-300">{formatDate(account.lastRunAt)}</strong></span>
          )}
        </div>
      </div>

      {/* Recent emails */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            Recent Warmup Emails
            <span className="ml-2 text-xs font-normal text-gray-400">(last 20)</span>
          </h2>
        </div>

        {account.sentEmails.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            No warmup emails sent yet. Click &quot;Run Now&quot; on the dashboard to start.
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Direction</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">From</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">To</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Subject</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Sent At</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Replied</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {account.sentEmails.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-5 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${e.direction === 'sent' ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400' : 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-400'}`}>
                      {e.direction}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 max-w-[140px] truncate">{e.fromEmail}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 max-w-[140px] truncate">{e.toEmail}</td>
                  <td className="px-4 py-3 text-xs text-gray-700 dark:text-gray-300 max-w-[200px] truncate">{e.subject}</td>
                  <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{formatDate(e.sentAt)}</td>
                  <td className="px-4 py-3">
                    {e.replied
                      ? <span className="text-xs text-green-600 font-medium">Yes</span>
                      : <span className="text-xs text-gray-400">No</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  )
}
