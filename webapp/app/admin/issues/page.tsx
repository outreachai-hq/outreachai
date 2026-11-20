'use client'

import { useState } from 'react'
import { Bug, Sparkles, MessageSquare, CheckCircle2, Loader2 } from 'lucide-react'

interface Issue {
  id: string; title: string; description: string; type: string
  email: string | null; url: string | null; status: string; createdAt: string
}

const STATUS_STYLES: Record<string, string> = {
  open:        'bg-blue-500/10 text-blue-400 border-blue-500/20',
  in_progress: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  resolved:    'bg-green-500/10 text-green-400 border-green-500/20',
  wont_fix:    'bg-gray-500/10 text-gray-400 border-gray-500/20',
}
const TYPE_ICONS: Record<string, typeof Bug> = { bug: Bug, feature: Sparkles, other: MessageSquare }

export default function AdminIssuesPage() {
  const [key,      setKey]      = useState('')
  const [authed,   setAuthed]   = useState(false)
  const [issues,   setIssues]   = useState<Issue[]>([])
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  async function fetchIssues(k: string) {
    setLoading(true); setError(null)
    const res = await fetch('/api/issues', { headers: { 'x-admin-key': k } })
    if (res.status === 401) { setError('Wrong admin key'); setLoading(false); return }
    setIssues(await res.json()); setAuthed(true); setLoading(false)
  }

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/issues/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
      body: JSON.stringify({ status }),
    })
    setIssues(prev => prev.map(i => i.id === id ? { ...i, status } : i))
  }

  if (!authed) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-white mb-6 text-center">Issues Admin</h1>
        <div className="space-y-3">
          <input type="password" placeholder="Admin key (ADMIN_SECRET)" value={key} onChange={e => setKey(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchIssues(key)}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 text-sm" />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button onClick={() => fetchIssues(key)} disabled={!key || loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />} View issues
          </button>
        </div>
      </div>
    </div>
  )

  const counts = { open: issues.filter(i=>i.status==='open').length, in_progress: issues.filter(i=>i.status==='in_progress').length, resolved: issues.filter(i=>i.status==='resolved').length }

  return (
    <div className="min-h-screen bg-gray-950 px-6 py-10">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Issue Reports</h1>
            <p className="text-gray-400 text-sm mt-1">{issues.length} total · {counts.open} open · {counts.in_progress} in progress · {counts.resolved} resolved</p>
          </div>
          <button onClick={() => fetchIssues(key)} className="text-sm text-gray-400 hover:text-white flex items-center gap-1.5 transition-colors">
            <Loader2 className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        <div className="space-y-3">
          {issues.length === 0 && (
            <div className="text-center py-16 text-gray-500">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-30" />No issues reported yet.
            </div>
          )}
          {issues.map(issue => {
            const Icon = TYPE_ICONS[issue.type] ?? MessageSquare
            const isOpen = expanded === issue.id
            return (
              <div key={issue.id} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-white/15 transition-all">
                <div className="flex items-center gap-4 px-5 py-4 cursor-pointer" onClick={() => setExpanded(isOpen ? null : issue.id)}>
                  <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm truncate">{issue.title}</p>
                    <p className="text-gray-500 text-xs mt-0.5">{issue.email ?? 'anonymous'} · {new Date(issue.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg border flex-shrink-0 ${STATUS_STYLES[issue.status] ?? ''}`}>
                    {issue.status.replace('_', ' ')}
                  </span>
                </div>
                {isOpen && (
                  <div className="border-t border-white/10 px-5 py-4 space-y-4">
                    <p className="text-gray-300 text-sm whitespace-pre-wrap">{issue.description}</p>
                    {issue.url && <p className="text-xs text-gray-500">Page: <span className="text-gray-400">{issue.url}</span></p>}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-gray-500">Status:</span>
                      {['open','in_progress','resolved','wont_fix'].map(s => (
                        <button key={s} onClick={() => updateStatus(issue.id, s)}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${issue.status===s ? STATUS_STYLES[s] : 'bg-white/5 border-white/10 text-gray-500 hover:text-white hover:border-white/20'}`}>
                          {s.replace('_',' ')}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-600">ID: {issue.id}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
