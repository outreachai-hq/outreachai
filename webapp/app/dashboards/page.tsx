'use client'

// Plan 9 — Dashboards list. First visit auto-seeds an Overview board via the
// API so the user never lands on an empty page.

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard, Plus, Loader2 } from 'lucide-react'

type Dashboard = {
  id:          string
  name:        string
  description: string | null
  position:    number
  createdAt:   string
  updatedAt:   string
}

export default function DashboardsListPage() {
  const { status } = useSession()
  const router = useRouter()

  const [items, setItems]     = useState<Dashboard[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login')
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    fetch('/api/dashboards')
      .then((r) => (r.ok ? r.json() : { dashboards: [] }))
      .then((d) => setItems(d.dashboards ?? []))
      .finally(() => setLoading(false))
  }, [status])

  async function create() {
    const name = prompt('Dashboard name?')
    if (!name?.trim()) return
    setCreating(true)
    const res = await fetch('/api/dashboards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), template: 'overview' }),
    })
    setCreating(false)
    if (res.ok) {
      const { dashboard } = await res.json()
      router.push(`/dashboards/${dashboard.id}`)
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
            <LayoutDashboard className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Dashboards</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Compose your own analytics views.</p>
          </div>
        </div>
        <button
          onClick={create}
          disabled={creating}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg px-3.5 py-2"
        >
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          New dashboard
        </button>
      </div>

      {loading ? (
        <div className="grid gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
          <LayoutDashboard className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">No dashboards yet.</p>
          <button onClick={create} className="text-sm text-blue-600 hover:underline">+ Create your first dashboard</button>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((d) => (
            <li key={d.id}>
              <Link
                href={`/dashboards/${d.id}`}
                className="block bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
              >
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{d.name}</p>
                {d.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{d.description}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
