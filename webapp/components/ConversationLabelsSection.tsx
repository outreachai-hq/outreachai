'use client'

// Plan 7 — Conversation Labels management UI for the Settings page.
//
// The five built-in labels are seeded server-side on first GET. Users can
// rename + recolor them but can't delete. Custom labels are fully editable
// and removable.

import { useEffect, useState } from 'react'
import { Tag, Plus, Trash2, Pencil, Check, X, Loader2, Star } from 'lucide-react'

type Label = {
  id: string
  key: string
  label: string
  color: string
  builtIn: boolean
  position: number
}

const PRESET_COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#6366f1', '#84cc16', '#888']

export function ConversationLabelsSection() {
  const [items, setItems]       = useState<Label[]>([])
  const [loading, setLoading]   = useState(true)
  const [adding, setAdding]     = useState(false)
  const [draft, setDraft]       = useState({ label: '', color: PRESET_COLORS[0] })
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState({ label: '', color: '#888' })

  useEffect(() => {
    fetch('/api/conversation-labels')
      .then((r) => (r.ok ? r.json() : { labels: [] }))
      .then((d) => setItems(d.labels ?? []))
      .finally(() => setLoading(false))
  }, [])

  async function create() {
    if (!draft.label.trim()) return
    setSaving(true); setError(null)
    const res = await fetch('/api/conversation-labels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    })
    setSaving(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? `Save failed (${res.status})`)
      return
    }
    const { label } = await res.json()
    setItems((prev) => [...prev, label])
    setDraft({ label: '', color: PRESET_COLORS[0] })
    setAdding(false)
  }

  async function saveEdit(id: string) {
    const res = await fetch(`/api/conversation-labels/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editDraft),
    })
    if (res.ok) {
      const { label } = await res.json()
      setItems((prev) => prev.map((l) => (l.id === id ? label : l)))
      setEditingId(null)
    }
  }

  async function remove(item: Label) {
    if (item.builtIn) return
    if (!confirm(`Delete the "${item.label}" label? It will be removed from any conversations using it.`)) return
    const res = await fetch(`/api/conversation-labels/${item.id}`, { method: 'DELETE' })
    if (res.ok) setItems((prev) => prev.filter((l) => l.id !== item.id))
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 bg-pink-50 dark:bg-pink-950 rounded-lg">
            <Tag className="w-5 h-5 text-pink-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Conversation labels</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Tags on inbox conversations. Five built-ins seed automatically; add your own to triage.
            </p>
          </div>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          <Plus className="w-4 h-4" /> Add label
        </button>
      </div>

      {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

      {adding && (
        <div className="mb-4 p-4 border border-pink-200 dark:border-pink-900 bg-pink-50 dark:bg-gray-800 rounded-lg space-y-3">
          <input
            type="text"
            placeholder="Label name (e.g. Hot deal Q3)"
            value={draft.label}
            onChange={(e) => setDraft({ ...draft, label: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-pink-500"
          />
          <div className="flex items-center gap-1.5 flex-wrap">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setDraft({ ...draft, color: c })}
                className={`w-6 h-6 rounded-full border-2 transition-transform ${
                  draft.color === c ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent'
                }`}
                style={{ backgroundColor: c }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={create}
              disabled={saving || !draft.label.trim()}
              className="flex items-center gap-1.5 px-3 py-2 bg-pink-600 hover:bg-pink-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Add label
            </button>
            <button
              onClick={() => { setAdding(false); setError(null); setDraft({ label: '', color: PRESET_COLORS[0] }) }}
              className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (<div key={i} className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />))}
        </div>
      ) : items.length === 0 && !adding ? (
        <div className="text-center py-6 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
          <p className="text-sm text-gray-500 dark:text-gray-400">No labels yet. Open the inbox to seed the built-ins.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {items.map((l) => (
            <div key={l.id} className="flex items-center gap-3 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
              {editingId === l.id ? (
                <>
                  <input
                    value={editDraft.label}
                    onChange={(e) => setEditDraft({ ...editDraft, label: e.target.value })}
                    className="flex-1 px-2 py-1 text-sm border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-pink-500"
                  />
                  <div className="flex items-center gap-1">
                    {PRESET_COLORS.slice(0, 6).map((c) => (
                      <button
                        key={c}
                        onClick={() => setEditDraft({ ...editDraft, color: c })}
                        className={`w-4 h-4 rounded-full border-2 ${editDraft.color === c ? 'border-gray-900 dark:border-white' : 'border-transparent'}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <button onClick={() => saveEdit(l.id)} className="text-pink-600 hover:text-pink-700" aria-label="Save">
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600" aria-label="Cancel">
                    <X className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <span
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium"
                    style={{ backgroundColor: `${l.color}22`, color: l.color }}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
                    {l.label}
                  </span>
                  <code className="text-[10px] font-mono text-gray-400">{l.key}</code>
                  {l.builtIn && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-gray-500 dark:text-gray-400">
                      <Star className="w-2.5 h-2.5" /> built-in
                    </span>
                  )}
                  <div className="flex-1" />
                  <button
                    onClick={() => { setEditingId(l.id); setEditDraft({ label: l.label, color: l.color }) }}
                    className="p-1.5 text-gray-400 hover:text-pink-600 hover:bg-pink-50 dark:hover:bg-pink-950 rounded transition-colors"
                    aria-label="Edit"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  {!l.builtIn && (
                    <button
                      onClick={() => remove(l)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 rounded transition-colors"
                      aria-label="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
