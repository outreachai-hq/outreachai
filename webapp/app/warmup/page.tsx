'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Flame, Plus, Play, Pause, X, ChevronRight } from 'lucide-react'

interface EmailAccount {
  id: string
  name: string
  email: string
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
  emailAccount: EmailAccount
}

interface Stats {
  totalSent: number
  totalReceived: number
  totalReplied: number
  activeCount: number
  totalAccounts: number
}

const WARMUP_GOAL_DAYS = 30

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'active'
      ? 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-950 dark:text-green-200 dark:border-green-600'
      : 'bg-yellow-50 text-yellow-700 border border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-700'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${cls}`}>
      {status}
    </span>
  )
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  return (
    <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5">
      <div
        className="bg-orange-500 h-1.5 rounded-full transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function AddAccountModal({
  onClose,
  onAdded,
}: {
  onClose: () => void
  onAdded: () => void
}) {
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([])
  const [emailAccountId, setEmailAccountId] = useState('')
  const [dailyTarget, setDailyTarget] = useState(5)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/email-accounts')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setEmailAccounts(d?.accounts ?? []))
      .catch(() => {})
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!emailAccountId) { setError('Select an email account'); return }
    setSaving(true)
    setError('')
    const res = await fetch('/api/warmup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailAccountId, dailyTarget }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Failed to add account')
      setSaving(false)
      return
    }
    onAdded()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Add Account to Warmup</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Email Account
            </label>
            <select
              value={emailAccountId}
              onChange={(e) => { setEmailAccountId(e.target.value); setError('') }}
              className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="">Select an account…</option>
              {emailAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.email})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Daily Target: <span className="font-bold text-orange-600">{dailyTarget} emails/day</span>
            </label>
            <input
              type="range"
              min={3}
              max={20}
              value={dailyTarget}
              onChange={(e) => setDailyTarget(Number(e.target.value))}
              className="w-full accent-orange-500"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>3</span><span>20</span>
            </div>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !emailAccountId}
              className="flex-1 px-4 py-2.5 text-sm font-semibold bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg"
            >
              {saving ? 'Adding…' : 'Start Warmup'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function WarmupPage() {
  const { status } = useSession()
  const router = useRouter()
  const [accounts, setAccounts] = useState<WarmupAccount[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [runningId, setRunningId] = useState<string | null>(null)
  const [runResult, setRunResult] = useState<{ id: string; sent: number; errors: string[] } | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [acRes, stRes] = await Promise.all([
      fetch('/api/warmup'),
      fetch('/api/warmup/stats'),
    ])
    if (acRes.ok) {
      const d = await acRes.json()
      setAccounts(d.accounts ?? [])
    }
    if (stRes.ok) {
      const d = await stRes.json()
      setStats(d)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login')
    if (status === 'authenticated') fetchData()
  }, [status, fetchData, router])

  async function toggleStatus(a: WarmupAccount) {
    const next = a.status === 'active' ? 'paused' : 'active'
    await fetch(`/api/warmup/${a.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
    fetchData()
  }

  async function runNow(a: WarmupAccount) {
    setRunningId(a.id)
    setRunResult(null)
    const res = await fetch(`/api/warmup/${a.id}/run`, { method: 'POST' })
    if (res.ok) {
      const d = await res.json()
      setRunResult({ id: a.id, ...d })
      fetchData()
    }
    setRunningId(null)
  }

  if (status === 'loading' || loading) {
    return <div className="p-8 text-center text-gray-400 text-sm">Loading warmup accounts…</div>
  }

  return (
    <>
      {showModal && (
        <AddAccountModal
          onClose={() => setShowModal(false)}
          onAdded={fetchData}
        />
      )}

      <div className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Flame className="w-6 h-6 text-orange-500" />
              Email Warmup
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Build domain reputation before sending cold outreach.
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Account
          </button>
        </div>

        {/* Stats row */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Accounts Warming', value: stats.activeCount },
              { label: 'Total Sent', value: stats.totalSent },
              { label: 'Total Received', value: stats.totalReceived },
              { label: 'Total Replied', value: stats.totalReplied },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 px-5 py-4">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Account cards */}
        {accounts.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 py-20 text-center">
            <Flame className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              No accounts warming up. Add one to start building your sender reputation.
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="mt-4 inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-lg"
            >
              <Plus className="w-4 h-4" />
              Add Account
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {accounts.map((a) => {
              const progress = Math.min(a.currentDay, WARMUP_GOAL_DAYS)
              const isRunning = runningId === a.id
              const result = runResult?.id === a.id ? runResult : null

              return (
                <div
                  key={a.id}
                  className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 border-l-4 border-l-orange-400 p-5"
                >
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {a.emailAccount.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {a.emailAccount.email}
                      </p>
                    </div>
                    <StatusBadge status={a.status} />
                  </div>

                  {/* Progress */}
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                      <span>Day {a.currentDay} of {WARMUP_GOAL_DAYS}</span>
                      <span>{Math.min(Math.round((progress / WARMUP_GOAL_DAYS) * 100), 100)}%</span>
                    </div>
                    <ProgressBar value={progress} max={WARMUP_GOAL_DAYS} />
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                    {[
                      { label: 'Sent', value: a.totalSent },
                      { label: 'Received', value: a.totalReceived },
                      { label: 'Replied', value: a.totalReplied },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-gray-50 dark:bg-gray-800 rounded-lg py-2">
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{value}</p>
                        <p className="text-[10px] text-gray-400">{label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Daily target */}
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    Target: <span className="font-medium text-gray-700 dark:text-gray-300">{a.dailyTarget} emails/day</span>
                    {a.lastRunAt && (
                      <span className="ml-2">
                        · Last run {new Date(a.lastRunAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </p>

                  {/* Run result */}
                  {result && (
                    <div className={`text-xs rounded-lg px-3 py-2 mb-3 ${result.errors.length > 0 ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400' : 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400'}`}>
                      {result.errors.length > 0
                        ? result.errors[0]
                        : `Sent ${result.sent} email${result.sent !== 1 ? 's' : ''}`}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                    <button
                      onClick={() => toggleStatus(a)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-medium border border-gray-200 dark:border-gray-700 rounded-lg py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
                    >
                      {a.status === 'active'
                        ? <><Pause className="w-3 h-3" /> Pause</>
                        : <><Play className="w-3 h-3" /> Resume</>}
                    </button>
                    <button
                      onClick={() => runNow(a)}
                      disabled={isRunning || a.status === 'paused'}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-medium bg-orange-50 hover:bg-orange-100 dark:bg-orange-950 dark:hover:bg-orange-900 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800 rounded-lg py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Flame className="w-3 h-3" />
                      {isRunning ? 'Running…' : 'Run Now'}
                    </button>
                    <Link
                      href={`/warmup/${a.id}`}
                      className="inline-flex items-center justify-center p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
