'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Building2, Search, Plus, ExternalLink } from 'lucide-react'

interface Company {
  id: string
  name: string
  domain: string | null
  websiteUrl: string | null
  industry: string | null
  size: string | null
  country: string | null
  contactCount: number
  leadCount: number
  lastActivityAt: string | null
}

function formatRel(dateStr: string | null) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function CompaniesPage() {
  const { status } = useSession()
  const router = useRouter()
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterIndustry, setFilterIndustry] = useState<string>('all')
  const [filterCountry, setFilterCountry] = useState<string>('all')
  const [showAdd, setShowAdd] = useState(false)
  const [addName, setAddName] = useState('')
  const [addWebsite, setAddWebsite] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const url = new URL('/api/companies', window.location.origin)
    if (search.trim()) url.searchParams.set('q', search.trim())
    if (filterIndustry !== 'all') url.searchParams.set('industry', filterIndustry)
    if (filterCountry !== 'all') url.searchParams.set('country', filterCountry)
    const res = await fetch(url.toString())
    if (res.ok) {
      const d = await res.json()
      setCompanies(d.companies ?? [])
    }
    setLoading(false)
  }, [search, filterIndustry, filterCountry])

  useEffect(() => {
    if (status === 'unauthenticated') { router.replace('/login'); return }
    if (status === 'authenticated') load()
  }, [status, load, router])

  async function addCompany(e: React.FormEvent) {
    e.preventDefault()
    setAdding(true)
    setAddError(null)
    try {
      const res = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: addName.trim(),
          websiteUrl: addWebsite.trim() || null,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setAddError(d.error ?? 'Failed to add company')
      } else {
        setShowAdd(false)
        setAddName('')
        setAddWebsite('')
        load()
      }
    } catch (e) {
      setAddError(e instanceof Error ? e.message : 'Failed')
    }
    setAdding(false)
  }

  // Derive simple filter dropdown options from the loaded list.
  const industries = Array.from(new Set(companies.map((c) => c.industry).filter(Boolean))) as string[]
  const countries  = Array.from(new Set(companies.map((c) => c.country).filter(Boolean))) as string[]

  if (status === 'loading' || (loading && companies.length === 0)) {
    return <div className="p-8 text-center text-gray-400 text-sm">Loading companies…</div>
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Companies</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Account-based view of every company across your contacts and leads.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-3.5 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add company
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute top-2.5 left-3 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') load() }}
            onBlur={load}
            placeholder="Search by name or domain…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>
        {industries.length > 0 && (
          <select
            value={filterIndustry}
            onChange={(e) => setFilterIndustry(e.target.value)}
            className="text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="all">All industries</option>
            {industries.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        )}
        {countries.length > 0 && (
          <select
            value={filterCountry}
            onChange={(e) => setFilterCountry(e.target.value)}
            className="text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="all">All countries</option>
            {countries.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>

      {/* Add company form */}
      {showAdd && (
        <form onSubmit={addCompany} className="mb-4 p-4 border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950 rounded-lg space-y-2">
          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Add a company</p>
          <input
            required
            autoFocus
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            placeholder="Company name (e.g. Stripe, Inc.)"
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <input
            value={addWebsite}
            onChange={(e) => setAddWebsite(e.target.value)}
            placeholder="Website (optional, e.g. stripe.com)"
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          {addError && <p className="text-xs text-red-600">{addError}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={adding || !addName.trim()}
              className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg font-medium"
            >
              {adding ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => { setShowAdd(false); setAddError(null) }}
              className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* List */}
      {companies.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-16 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900">
          <Building2 className="w-10 h-10 text-gray-300 mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">No companies yet.</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 max-w-md">
            Companies are auto-created when you add a contact or import a lead with a company name. You can also add one manually.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Industry</th>
                <th className="px-4 py-2.5">Country</th>
                <th className="px-4 py-2.5 text-right">Contacts</th>
                <th className="px-4 py-2.5 text-right">Leads</th>
                <th className="px-4 py-2.5">Last activity</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/companies/${c.id}`}
                        className="font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400"
                      >
                        {c.name}
                      </Link>
                      {c.websiteUrl && (
                        <a
                          href={c.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                          title={c.websiteUrl}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                    {c.domain && (
                      <p className="text-xs text-gray-400 mt-0.5">{c.domain}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{c.industry ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{c.country ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300 font-medium tabular-nums">{c.contactCount}</td>
                  <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300 font-medium tabular-nums">{c.leadCount}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{formatRel(c.lastActivityAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  )
}
