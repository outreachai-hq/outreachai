'use client'

// Plan 7 — Snippets management UI for the Settings page.
// Self-contained: own fetch, own state. Mirrors the visual pattern of the
// surrounding sections (Webhooks, AI Providers, etc.).

import { useEffect, useState } from 'react'
import { Loader2, Plus, Trash2, FileText, Pencil, Check, X } from 'lucide-react'

type Snippet = {
  id: string
  key: string
  label: string
  body: string
  tags: string[]
  updatedAt: string
}

export function SnippetsSection() {
  const [snippets, setSnippets] = useState<Snippet[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  const [adding, setAdding]     = useState(false)
  const [form, setForm]         = useState<{ label: string; body: string }>({ label: '', body: '' })
  const [saving, setSaving]     = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm]   = useState<{ label: string; body: string }>({ label: '', body: '' })

  useEffect(() => {
    fetch('/api/snippets')
      .then((r) => (r.ok ? r.json() : { snippets: [] }))
      .then((d) => setSnippets(d.snippets ?? []))
      .finally(() => setLoading(false))
  }, [])

  async function add() {
    if (!form.label.trim() || !form.body.trim()) return
    setSaving(true); setError(null)
    const res = await fetch('/api/snippets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? `Save failed (${res.status})`)
      return
    }
    const { snippet } = await res.json()
    setSnippets((prev) => [snippet, ...prev])
    setForm({ label: '', body: '' })
    setAdding(false)
  }

  async function saveEdit(id: string) {
    const res = await fetch(`/api/snippets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    })
    if (res.ok) {
      const { snippet } = await res.json()
      setSnippets((prev) => prev.map((s) => (s.id === id ? snippet : s)))
      setEditingId(null)
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this snippet?')) return
    const res = await fetch(`/api/snippets/${id}`, { method: 'DELETE' })
    if (res.ok) setSnippets((prev) => prev.filter((s) => s.id !== id))
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 bg-violet-50 dark:bg-violet-950 rounded-lg">
            <FileText className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Snippets</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Reusable text blocks. Type <code className="font-mono px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">/key</code> in any composer to insert.
            </p>
          </div>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          <Plus className="w-4 h-4" /> Add snippet
        </button>
      </div>

      {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

      {adding && (
        <div className="mb-4 p-4 border border-violet-200 dark:border-violet-900 bg-violet-50 dark:bg-gray-800 rounded-lg space-y-3">
          <input
            type="text"
            placeholder="Label (e.g. Intro signoff)"
            value={form.label}
            onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <textarea
            placeholder="Snippet body. Supports {{firstName}} etc. once a lead is in scope."
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            rows={4}
            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 resize-y"
          />
          <div className="flex gap-2">
            <button
              onClick={add}
              disabled={saving || !form.label.trim() || !form.body.trim()}
              className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save snippet
            </button>
            <button
              onClick={() => { setAdding(false); setError(null); setForm({ label: '', body: '' }) }}
              className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : snippets.length === 0 && !adding ? (
        <div className="text-center py-6 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">No snippets yet.</p>
          <button onClick={() => setAdding(true)} className="text-sm text-violet-600 hover:underline">
            + Add your first snippet
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {snippets.map((s) => (
            <div key={s.id} className="px-3 py-2.5 bg-gray-50 dark:bg-gray-800 rounded-lg">
              {editingId === s.id ? (
                <div className="space-y-2">
                  <input
                    value={editForm.label}
                    onChange={(e) => setEditForm((f) => ({ ...f, label: e.target.value }))}
                    className="w-full px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                  <textarea
                    value={editForm.body}
                    onChange={(e) => setEditForm((f) => ({ ...f, body: e.target.value }))}
                    rows={3}
                    className="w-full px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 resize-y"
                  />
                  <div className="flex gap-1.5">
                    <button onClick={() => saveEdit(s.id)} className="inline-flex items-center gap-1 text-xs text-violet-700 hover:underline">
                      <Check className="w-3.5 h-3.5" /> Save
                    </button>
                    <button onClick={() => setEditingId(null)} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:underline">
                      <X className="w-3.5 h-3.5" /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{s.label}</p>
                      <code className="text-[11px] font-mono text-violet-700 dark:text-violet-200 bg-violet-50 dark:bg-violet-950 px-1.5 py-0.5 rounded">
                        /{s.key}
                      </code>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2 whitespace-pre-wrap">{s.body}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => { setEditingId(s.id); setEditForm({ label: s.label, body: s.body }) }}
                      className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950 rounded transition-colors"
                      aria-label="Edit"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => remove(s.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 rounded transition-colors"
                      aria-label="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
