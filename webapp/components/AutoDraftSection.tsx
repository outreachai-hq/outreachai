'use client'

// Plan 8 — Auto-draft AI replies toggle for the Settings page.
// Persisted on User.aiReplyAutoDraft via /api/settings/auto-draft.

import { useEffect, useState } from 'react'
import { Sparkles, Loader2, Check } from 'lucide-react'

const OPTIONS: Array<{ value: string; label: string; sub: string }> = [
  { value: 'off',      label: 'Off',          sub: 'Manual replies only' },
  { value: 'email',    label: 'Email only',   sub: 'Drafts queue when an email reply arrives' },
  { value: 'linkedin', label: 'LinkedIn only',sub: 'Drafts queue when a LinkedIn DM arrives' },
  { value: 'both',     label: 'Both channels',sub: 'Email + LinkedIn auto-drafts' },
]

export function AutoDraftSection() {
  const [value, setValue]     = useState<string>('off')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)

  useEffect(() => {
    fetch('/api/settings/auto-draft')
      .then((r) => (r.ok ? r.json() : { aiReplyAutoDraft: 'off' }))
      .then((d) => setValue(d.aiReplyAutoDraft ?? 'off'))
      .finally(() => setLoading(false))
  }, [])

  async function pick(v: string) {
    if (saving || v === value) return
    setSaving(true)
    const res = await fetch('/api/settings/auto-draft', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aiReplyAutoDraft: v }),
    })
    setSaving(false)
    if (res.ok) {
      setValue(v)
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    }
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 bg-violet-50 dark:bg-violet-950 rounded-lg">
            <Sparkles className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Auto-draft AI replies</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              When a prospect replies, queue an AI-drafted response in <a href="/outreach-queue" className="text-blue-600 hover:underline">Outreach Queue</a> for your review.
            </p>
          </div>
        </div>
        {saved && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
            <Check className="w-3.5 h-3.5" /> Saved
          </span>
        )}
      </div>

      {loading ? (
        <div className="h-16 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => pick(o.value)}
              disabled={saving}
              className={`text-left p-3 border rounded-lg transition-colors ${
                value === o.value
                  ? 'border-violet-400 bg-violet-50 dark:bg-violet-950/30 dark:border-violet-600'
                  : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${value === o.value ? 'bg-violet-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{o.label}</p>
                {saving && value === o.value && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400 ml-auto" />}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-4.5">{o.sub}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
