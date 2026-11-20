'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { UserSearch, Search, CheckCircle2, XCircle, HelpCircle, Loader2, Key, ExternalLink, Eye, EyeOff } from 'lucide-react'
import type { EnrichedLead } from '@/lib/enrichment'

interface LeadList { id: string; name: string }

type VerifyStatus = 'valid' | 'invalid' | 'unknown'
interface VerifyResult { status: VerifyStatus; score: number }

const LIMITS = [5, 10, 25, 50]

export default function EnrichmentPage() {
  const { status } = useSession()
  const router = useRouter()

  const [title, setTitle] = useState('')
  const [domain, setDomain] = useState('')
  const [company, setCompany] = useState('')
  const [limit, setLimit] = useState(10)
  const [listId, setListId] = useState('')
  const [lists, setLists] = useState<LeadList[]>([])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<EnrichedLead[] | null>(null)
  const [usedProvider, setUsedProvider] = useState<string | null>(null)
  const [fallbackTriggered, setFallbackTriggered] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importedCount, setImportedCount] = useState<number | null>(null)

  const [verifying, setVerifying] = useState<Record<number, boolean>>({})
  const [verifyResults, setVerifyResults] = useState<Record<number, VerifyResult>>({})
  const [verifyErrors, setVerifyErrors] = useState<Record<number, string>>({})

  // Key setup state
  const [keysLoading, setKeysLoading] = useState(true)
  const [hasApollo, setHasApollo] = useState(false)
  const [hasHunter, setHasHunter] = useState(false)
  const [apolloInput, setApolloInput] = useState('')
  const [hunterInput, setHunterInput] = useState('')
  const [showApollo, setShowApollo] = useState(false)
  const [showHunter, setShowHunter] = useState(false)
  const [savingKeys, setSavingKeys] = useState(false)
  const [keysSaved, setKeysSaved] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login')
    if (status === 'authenticated') {
      fetch('/api/lead-lists').then(r => r.json()).then(d => setLists(d.lists ?? []))
      fetch('/api/settings/enrichment-keys').then(r => r.json()).then(d => {
        setHasApollo(!!d.apolloApiKey)
        setHasHunter(!!d.hunterApiKey)
        setKeysLoading(false)
      }).catch(() => setKeysLoading(false))
    }
  }, [status, router])

  async function saveKeys() {
    if (!apolloInput.trim() && !hunterInput.trim()) return
    setSavingKeys(true)
    await fetch('/api/settings/enrichment-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apolloApiKey: apolloInput.trim() || undefined,
        hunterApiKey: hunterInput.trim() || undefined,
      }),
    })
    if (apolloInput.trim()) setHasApollo(true)
    if (hunterInput.trim()) setHasHunter(true)
    setApolloInput(''); setHunterInput('')
    setSavingKeys(false); setKeysSaved(true)
    setTimeout(() => setKeysSaved(false), 3000)
  }

  async function handleSearch() {
    if (!title.trim()) { setError('Job title is required'); return }
    setLoading(true); setError(null); setResults(null); setImportedCount(null); setUsedProvider(null); setFallbackTriggered(false)
    const res = await fetch('/api/enrichment/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: { title: title.trim(), domain: domain.trim() || undefined, company: company.trim() || undefined, limit } }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Search failed'); setLoading(false); return }
    setResults(data.leads)
    setUsedProvider(data.provider ?? null)
    setFallbackTriggered(data.fallbackTriggered ?? false)
    setLoading(false)
  }

  async function handleImport() {
    if (!listId || !results) return
    setImporting(true)
    const res = await fetch('/api/enrichment/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: { title: title.trim(), domain: domain.trim() || undefined, company: company.trim() || undefined, limit }, listId }),
    })
    const data = await res.json()
    if (res.ok) setImportedCount(data.imported)
    setImporting(false)
  }

  async function verifyEmail(email: string, idx: number) {
    setVerifying(prev => ({ ...prev, [idx]: true }))
    setVerifyErrors(prev => ({ ...prev, [idx]: '' }))
    const res = await fetch('/api/enrichment/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    if (res.ok) {
      const data: VerifyResult = await res.json()
      setVerifyResults(prev => ({ ...prev, [idx]: data }))
    } else {
      const data = await res.json().catch(() => ({}))
      setVerifyErrors(prev => ({ ...prev, [idx]: data.error ?? 'Verification failed' }))
    }
    setVerifying(prev => ({ ...prev, [idx]: false }))
  }

  const withEmail = results?.filter(l => l.email) ?? []

  if (status === 'loading') return <div className="p-8 text-sm text-gray-400">Loading…</div>

  const noKeys = !keysLoading && !hasApollo && !hasHunter

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Contact Finder</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Search for leads by job title and company. Uses your Apollo or Hunter API key — free tiers available.
        </p>
      </div>

      {/* Inline key setup — shown when no keys configured */}
      {noKeys && (
        <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl p-6 mb-6">
          <div className="flex items-start gap-3 mb-4">
            <Key className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Add an API key to start finding leads</p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                Both Apollo and Hunter have free tiers. Apollo gives ~250 emails/day free. Hunter gives 50 credits/month free.
              </p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Apollo.io API Key</label>
                <a href="https://app.apollo.io/#/settings/integrations/api" target="_blank" rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
                  Get free key <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="relative">
                <input
                  type={showApollo ? 'text' : 'password'}
                  placeholder="Paste Apollo API key…"
                  value={apolloInput}
                  onChange={e => setApolloInput(e.target.value)}
                  className="w-full px-3 py-2 pr-8 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <button onClick={() => setShowApollo(v => !v)} className="absolute right-2 top-2 text-gray-400 hover:text-gray-600">
                  {showApollo ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {hasApollo && <p className="text-xs text-green-600 mt-1">✓ Apollo key saved</p>}
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Hunter.io API Key</label>
                <a href="https://hunter.io/api-keys" target="_blank" rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
                  Get free key <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="relative">
                <input
                  type={showHunter ? 'text' : 'password'}
                  placeholder="Paste Hunter API key…"
                  value={hunterInput}
                  onChange={e => setHunterInput(e.target.value)}
                  className="w-full px-3 py-2 pr-8 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <button onClick={() => setShowHunter(v => !v)} className="absolute right-2 top-2 text-gray-400 hover:text-gray-600">
                  {showHunter ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {hasHunter && <p className="text-xs text-green-600 mt-1">✓ Hunter key saved</p>}
            </div>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={saveKeys}
              disabled={savingKeys || (!apolloInput.trim() && !hunterInput.trim())}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {savingKeys && <Loader2 className="w-4 h-4 animate-spin" />}
              {keysSaved ? '✓ Keys saved — you can search now' : 'Save & start searching'}
            </button>
            <p className="text-xs text-gray-500">Keys are encrypted and stored securely</p>
          </div>
        </div>
      )}

      {/* Key status when at least one key exists */}
      {!keysLoading && (hasApollo || hasHunter) && (
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          {hasApollo && <span className="text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 px-2.5 py-1 rounded-full">✓ Apollo key active</span>}
          {hasHunter && <span className="text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 px-2.5 py-1 rounded-full">✓ Hunter key active</span>}
          {!hasApollo && <span className="text-xs text-gray-400">No Apollo key — <button onClick={() => setHasApollo(false)} className="text-blue-500 hover:underline">add one</button></span>}
          {!hasHunter && <span className="text-xs text-gray-400">No Hunter fallback — <button onClick={() => setHasHunter(false)} className="text-blue-500 hover:underline">add one</button></span>}
        </div>
      )}

      {/* Search form */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
        {/* Provider info */}
        <div className="flex items-center gap-2 mb-5">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Provider:</span>
          <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
            Auto (Apollo → Hunter fallback)
          </span>
          {fallbackTriggered && (
            <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              ⚠ Apollo quota reached — used Hunter
            </span>
          )}
          {usedProvider && !fallbackTriggered && (
            <span className="text-xs text-gray-400">via {usedProvider}</span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Job Title <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. VP of Sales"
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Company Domain</label>
            <input
              type="text"
              value={domain}
              onChange={e => setDomain(e.target.value)}
              placeholder="e.g. acme.com"
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Company Name (optional)</label>
            <input
              type="text"
              value={company}
              onChange={e => setCompany(e.target.value)}
              placeholder="e.g. Acme Corp"
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Max results</label>
            <select
              value={limit}
              onChange={e => setLimit(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {LIMITS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={listId}
            onChange={e => setListId(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="">Import to list… (optional)</option>
            {lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <button
            onClick={handleSearch}
            disabled={loading || !title.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>

        {error && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>

      {/* Results */}
      {results !== null && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <UserSearch className="w-4 h-4 text-teal-600" />
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {results.length} found
                {withEmail.length > 0 && <span className="text-gray-400 font-normal"> · {withEmail.length} with email</span>}
              </span>
            </div>
            {listId && withEmail.length > 0 && (
              <button
                onClick={handleImport}
                disabled={importing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                {importing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {importedCount !== null ? `Imported ${importedCount}` : `Import ${withEmail.length} leads with email`}
              </button>
            )}
          </div>

          {results.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">No results found. Try a different title or domain.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Title</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Company</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {results.map((lead, idx) => {
                    const vr = verifyResults[idx]
                    return (
                      <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                          {lead.firstName} {lead.lastName}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400 max-w-[160px] truncate">{lead.title ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{lead.company ?? '—'}</td>
                        <td className="px-4 py-3">
                          {lead.email ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-gray-700 dark:text-gray-300 font-mono text-xs">{lead.email}</span>
                              {vr && (
                                vr.status === 'valid' ? <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" aria-label="Valid" /> :
                                vr.status === 'invalid' ? <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" aria-label="Invalid" /> :
                                <HelpCircle className="w-4 h-4 text-gray-400 flex-shrink-0" aria-label="Unknown" />
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">— none</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {lead.email && !vr && (
                            verifyErrors[idx] ? (
                              <span className="text-xs text-red-500" title={verifyErrors[idx]}>
                                {verifyErrors[idx].length > 40 ? verifyErrors[idx].slice(0, 37) + '…' : verifyErrors[idx]}
                              </span>
                            ) : (
                              <button
                                onClick={() => verifyEmail(lead.email!, idx)}
                                disabled={verifying[idx] || !hasHunter}
                                title={!hasHunter ? 'Add a Hunter.io API key in Settings > Enrichment API Keys' : undefined}
                                className="text-xs text-teal-600 hover:text-teal-700 font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                {verifying[idx] ? 'Checking…' : 'Verify'}
                              </button>
                            )
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
