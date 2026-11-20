'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'

interface AdminUser {
  id: string
  email: string
  name: string | null
  plan: string
  authMethod: 'password' | 'oauth'
  onboardingCompleted: boolean
  extensionConnected: boolean
  createdAt: string
  contacts: number
  campaigns: number
  sequences: number
}

interface UsersResponse {
  users: AdminUser[]
  total: number
  page: number
  pageSize: number
  stats: { totalUsers: number; byPlan: Record<string, number> }
}

const PAGE_SIZE = 50

export default function AdminUsersPage() {
  const [data, setData] = useState<UsersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [plan, setPlan] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQuery(query); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [query])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      if (debouncedQuery) params.set('q', debouncedQuery)
      if (plan) params.set('plan', plan)
      const res = await fetch(`/api/admin/users?${params}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Request failed (${res.status})`)
      }
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [page, debouncedQuery, plan])

  useEffect(() => { load() }, [load])

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1
  const planOptions = data ? Object.keys(data.stats.byPlan).sort() : []

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-6">
      <PageHeader
        title="Registered users"
        subtitle={data ? `${data.stats.totalUsers} total users` : 'Admin'}
        action={
          <Button variant="secondary" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={loading ? 'w-3.5 h-3.5 animate-spin' : 'w-3.5 h-3.5'} /> Refresh
          </Button>
        }
      />

      {/* Stats */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Card className="p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">Total users</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{data.stats.totalUsers}</p>
          </Card>
          {Object.entries(data.stats.byPlan).map(([p, n]) => (
            <Card key={p} className="p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{p} plan</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{n}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Search by email or name"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={plan}
          onChange={e => { setPlan(e.target.value); setPage(1) }}
          className="sm:w-40"
        >
          <option value="">All plans</option>
          {planOptions.map(p => <option key={p} value={p}>{p}</option>)}
        </Select>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800/50 px-4 py-3 text-sm flex items-center justify-between">
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={load}>Retry</Button>
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Sign-in</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Contacts</th>
                <th className="px-4 py-3 text-right">Campaigns</th>
                <th className="px-4 py-3 text-right">Sequences</th>
                <th className="px-4 py-3">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading && !data && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                  <Loader2 className="w-5 h-5 animate-spin inline" />
                </td></tr>
              )}
              {data && data.users.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                  No users match your filters.
                </td></tr>
              )}
              {data?.users.map(u => (
                <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 dark:text-gray-100">{u.name || '—'}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{u.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={u.plan === 'free' ? 'gray' : 'green'} className="capitalize">{u.plan}</Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                    {u.authMethod === 'password' ? 'Email' : 'Google / GitHub'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <Badge variant={u.onboardingCompleted ? 'blue' : 'yellow'}>
                        {u.onboardingCompleted ? 'Onboarded' : 'Onboarding'}
                      </Badge>
                      {u.extensionConnected && <Badge variant="purple">Extension</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">{u.contacts}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">{u.campaigns}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">{u.sequences}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                    {new Date(u.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data && data.total > data.pageSize && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-800 text-sm text-gray-500 dark:text-gray-400">
            <span>Page {data.page} of {totalPages} · {data.total} users</span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="w-3.5 h-3.5" /> Prev
              </Button>
              <Button variant="secondary" size="sm" disabled={page >= totalPages || loading} onClick={() => setPage(p => p + 1)}>
                Next <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
