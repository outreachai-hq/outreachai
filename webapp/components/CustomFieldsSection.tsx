'use client'

// Plan 5 — Custom Fields management UI for the Settings page.
//
// Entity tabs (Lead / Contact / Company) → table of defs → add/edit modal.
// AI columns expose prompt + provider/model/auto-run knobs. Type changes
// are disabled in the edit form because the API rejects them (corruption
// risk — see route notes).

import { useEffect, useState } from 'react'
import { Sparkles, Database, Plus, Trash2, Pencil, Check, X, Loader2 } from 'lucide-react'

type EntityKind = 'lead' | 'contact' | 'company'

type FieldDef = {
  id:           string
  entity:       EntityKind
  key:          string
  label:        string
  type:         string
  options?:     string[] | null
  defaultValue?: unknown
  aiPrompt?:    string | null
  aiProvider?:  string | null
  aiModel?:     string | null
  aiMaxTokens?: number | null
  aiAutoRun?:   boolean
  position?:    number
}

const TYPES: Array<{ value: string; label: string }> = [
  { value: 'text',        label: 'Text'         },
  { value: 'number',      label: 'Number'       },
  { value: 'date',        label: 'Date'         },
  { value: 'url',         label: 'URL'          },
  { value: 'bool',        label: 'Yes / No'     },
  { value: 'select',      label: 'Select (one)' },
  { value: 'multiselect', label: 'Select (many)'},
  { value: 'ai',          label: '🤖 AI column' },
]

const ENTITY_TABS: Array<{ key: EntityKind; label: string }> = [
  { key: 'lead',    label: 'Lead'    },
  { key: 'contact', label: 'Contact' },
  { key: 'company', label: 'Company' },
]

const PROVIDERS = ['(default)', 'anthropic', 'openai', 'gemini'] as const

type DraftState = {
  label:        string
  type:         string
  optionsInput: string
  aiPrompt:     string
  aiProvider:   string
  aiModel:      string
  aiMaxTokens:  string
  aiAutoRun:    boolean
}

const EMPTY_DRAFT: DraftState = {
  label: '', type: 'text', optionsInput: '',
  aiPrompt: '', aiProvider: '(default)', aiModel: '', aiMaxTokens: '200', aiAutoRun: false,
}

function fromDef(d: FieldDef): DraftState {
  return {
    label:        d.label,
    type:         d.type,
    optionsInput: Array.isArray(d.options) ? d.options.join(', ') : '',
    aiPrompt:     d.aiPrompt ?? '',
    aiProvider:   d.aiProvider ?? '(default)',
    aiModel:      d.aiModel ?? '',
    aiMaxTokens:  String(d.aiMaxTokens ?? 200),
    aiAutoRun:    !!d.aiAutoRun,
  }
}

function buildBody(draft: DraftState, entity: EntityKind): Record<string, unknown> {
  const isAI = draft.type === 'ai'
  const needsOptions = draft.type === 'select' || draft.type === 'multiselect'
  return {
    entity,
    label: draft.label.trim(),
    type:  draft.type,
    ...(needsOptions && draft.optionsInput.trim()
      ? { options: draft.optionsInput.split(',').map((s) => s.trim()).filter(Boolean) }
      : {}),
    ...(isAI
      ? {
          aiPrompt:    draft.aiPrompt.trim(),
          aiProvider:  draft.aiProvider === '(default)' ? null : draft.aiProvider,
          aiModel:     draft.aiModel.trim() || null,
          aiMaxTokens: Number(draft.aiMaxTokens) || 200,
          aiAutoRun:   draft.aiAutoRun,
        }
      : {}),
  }
}

export function CustomFieldsSection() {
  const [entity, setEntity]   = useState<EntityKind>('lead')
  const [defs, setDefs]       = useState<FieldDef[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding]   = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft]     = useState<DraftState>(EMPTY_DRAFT)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/custom-fields?entity=${entity}`)
      .then((r) => (r.ok ? r.json() : { defs: [] }))
      .then((d) => setDefs(d.defs ?? []))
      .finally(() => setLoading(false))
  }, [entity])

  function openNew() {
    setDraft(EMPTY_DRAFT); setEditingId(null); setAdding(true); setError(null)
  }
  function openEdit(d: FieldDef) {
    setDraft(fromDef(d)); setEditingId(d.id); setAdding(true); setError(null)
  }
  function close() {
    setAdding(false); setEditingId(null); setError(null)
  }

  async function save() {
    if (!draft.label.trim()) { setError('Label required'); return }
    if (draft.type === 'ai' && !draft.aiPrompt.trim()) { setError('AI prompt required'); return }
    setSaving(true)
    try {
      const body = buildBody(draft, entity)
      const url = editingId ? `/api/custom-fields/${editingId}` : '/api/custom-fields'
      // PATCH can't change entity/type/key — strip those for edits.
      if (editingId) { delete body.entity; delete body.type }
      const method = editingId ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error ?? `Save failed (${res.status})`)
        return
      }
      const { def } = await res.json()
      setDefs((prev) => {
        const i = prev.findIndex((p) => p.id === def.id)
        if (i >= 0) return prev.map((p) => (p.id === def.id ? def : p))
        return [...prev, def]
      })
      close()
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this field? Existing values stay on rows as orphan data — recreating with the same key restores them.')) return
    const res = await fetch(`/api/custom-fields/${id}`, { method: 'DELETE' })
    if (res.ok) setDefs((prev) => prev.filter((d) => d.id !== id))
  }

  const isAI         = draft.type === 'ai'
  const needsOptions = draft.type === 'select' || draft.type === 'multiselect'

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 bg-violet-50 dark:bg-violet-950 rounded-lg">
            <Database className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Custom fields</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              User-defined columns on leads, contacts, and companies. Pick <code className="font-mono px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">🤖 AI column</code> to auto-fill with a prompt.
            </p>
          </div>
        </div>
        <button onClick={openNew}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700">
          <Plus className="w-4 h-4" /> Add field
        </button>
      </div>

      {/* Entity tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 mb-4">
        {ENTITY_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setEntity(t.key)}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              entity === t.key
                ? 'border-violet-600 text-violet-700 dark:text-violet-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

      {adding && (
        <div className="mb-4 p-4 border border-violet-200 dark:border-violet-900 bg-violet-50 dark:bg-gray-800 rounded-lg space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Label (e.g. Decision-maker score)"
              value={draft.label}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <select
              value={draft.type}
              onChange={(e) => setDraft({ ...draft, type: e.target.value })}
              disabled={!!editingId}
              className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-60"
            >
              {TYPES.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
            </select>
          </div>

          {needsOptions && (
            <input
              type="text"
              placeholder="Options, comma-separated (e.g. Low, Med, High)"
              value={draft.optionsInput}
              onChange={(e) => setDraft({ ...draft, optionsInput: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          )}

          {isAI && (
            <div className="space-y-2 border-l-2 border-violet-400 pl-3">
              <div>
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-violet-500" /> AI prompt
                </p>
                <textarea
                  placeholder={'Write a one-line opener for {{firstName}} at {{company}} based on {{headline}}.'}
                  value={draft.aiPrompt}
                  onChange={(e) => setDraft({ ...draft, aiPrompt: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 text-sm font-mono border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 resize-y"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  Variables: <code>{'{{firstName}}'}</code> <code>{'{{lastName}}'}</code> <code>{'{{company}}'}</code> <code>{'{{headline}}'}</code> <code>{'{{email}}'}</code> <code>{'{{linkedinUrl}}'}</code> <code>{'{{about}}'}</code> <code>{'{{recentPost}}'}</code>
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <select
                  value={draft.aiProvider}
                  onChange={(e) => setDraft({ ...draft, aiProvider: e.target.value })}
                  className="px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  {PROVIDERS.map((p) => (<option key={p} value={p}>{p}</option>))}
                </select>
                <input
                  type="text"
                  placeholder="Model (optional)"
                  value={draft.aiModel}
                  onChange={(e) => setDraft({ ...draft, aiModel: e.target.value })}
                  className="px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
                <input
                  type="number"
                  placeholder="Max tokens"
                  value={draft.aiMaxTokens}
                  onChange={(e) => setDraft({ ...draft, aiMaxTokens: e.target.value })}
                  className="px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                <input type="checkbox"
                  checked={draft.aiAutoRun}
                  onChange={(e) => setDraft({ ...draft, aiAutoRun: e.target.checked })}
                  className="rounded border-gray-300 text-violet-600" />
                Auto-run on new rows (and re-run when the row is updated)
              </label>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={save}
              disabled={saving || !draft.label.trim()}
              className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {editingId ? 'Save changes' : 'Add field'}
            </button>
            <button onClick={close}
              className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[...Array(2)].map((_, i) => (<div key={i} className="h-12 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />))}
        </div>
      ) : defs.length === 0 && !adding ? (
        <div className="text-center py-6 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">No custom fields on {entity} yet.</p>
          <button onClick={openNew} className="text-sm text-violet-600 hover:underline">+ Add your first field</button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {defs.map((d) => (
            <div key={d.id} className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{d.label}</p>
                  <code className="text-[10px] font-mono text-gray-500 dark:text-gray-400">{d.key}</code>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">
                    {d.type === 'ai' ? '🤖 AI' : d.type}
                  </span>
                  {d.type === 'ai' && d.aiAutoRun && (
                    <span className="text-[10px] font-medium text-violet-700 dark:text-violet-200 bg-violet-100 dark:bg-violet-900/40 px-1.5 py-0.5 rounded">
                      auto
                    </span>
                  )}
                </div>
                {d.type === 'ai' && d.aiPrompt && (
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 truncate font-mono">{d.aiPrompt}</p>
                )}
                {Array.isArray(d.options) && d.options.length > 0 && (
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{d.options.join(' · ')}</p>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => openEdit(d)}
                  className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950 rounded transition-colors"
                  aria-label="Edit"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => remove(d.id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 rounded transition-colors"
                  aria-label="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
