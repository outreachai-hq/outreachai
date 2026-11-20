'use client'

// Plan 5 — Reusable per-entity custom-fields panel.
//
// Props:
//   entity / entityId / patchUrl — caller-controlled because each entity has
//     its own update endpoint
//   initialValues / initialAiRuns — read from the entity row
//   onChange — fires after a successful save so the parent can refresh state
//
// Inline-edit semantics: text/number/url/date save on blur; bool/select/
// multiselect save on change. AI columns render the stored value + a 🔁
// button that POSTs to /api/custom-fields/[defId]/run.

import { useEffect, useState, useCallback } from 'react'
import { Database, RefreshCw, Loader2, AlertCircle, Sparkles } from 'lucide-react'

type EntityKind = 'lead' | 'contact' | 'company'

type FieldDef = {
  id:           string
  key:          string
  label:        string
  type:         string
  options?:     string[] | null
  aiPrompt?:    string | null
  aiAutoRun?:   boolean
}

type RunStatus = {
  status?: 'pending' | 'running' | 'done' | 'failed'
  lastRunAt?: string
  error?: string | null
}

export function CustomFieldsPanel(props: {
  entity:         EntityKind
  entityId:       string
  patchUrl:       string                 // PATCH URL for the entity
  initialValues:  Record<string, unknown>
  initialAiRuns:  Record<string, RunStatus>
  onChange?:      (newValues: Record<string, unknown>) => void
}) {
  const [defs, setDefs]     = useState<FieldDef[]>([])
  const [loading, setLoad]  = useState(true)
  const [values, setValues] = useState(props.initialValues ?? {})
  const [aiRuns, setRuns]   = useState<Record<string, RunStatus>>(props.initialAiRuns ?? {})
  const [runningKey, setRunning] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/custom-fields?entity=${props.entity}`)
      .then((r) => (r.ok ? r.json() : { defs: [] }))
      .then((d) => setDefs(d.defs ?? []))
      .finally(() => setLoad(false))
  }, [props.entity])

  const persist = useCallback(async (key: string, value: unknown) => {
    const res = await fetch(props.patchUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customFields: { [key]: value } }),
    })
    if (res.ok) {
      setValues((prev) => ({ ...prev, [key]: value }))
      props.onChange?.({ ...values, [key]: value })
    }
  }, [props, values])

  async function runAi(def: FieldDef) {
    setRunning(def.key)
    setRuns((prev) => ({ ...prev, [def.key]: { status: 'running' } }))
    try {
      const res = await fetch(`/api/custom-fields/${def.id}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityId: props.entityId }),
      })
      if (res.ok) {
        const { value } = await res.json()
        setValues((prev) => ({ ...prev, [def.key]: value }))
        setRuns((prev) => ({ ...prev, [def.key]: { status: 'done', lastRunAt: new Date().toISOString() } }))
        props.onChange?.({ ...values, [def.key]: value })
      } else {
        const d = await res.json().catch(() => ({}))
        setRuns((prev) => ({ ...prev, [def.key]: { status: 'failed', error: d.error ?? `HTTP ${res.status}` } }))
      }
    } finally {
      setRunning(null)
    }
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="h-6 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
      </div>
    )
  }

  if (defs.length === 0) {
    return null // hide the panel entirely when the user has no defs configured
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Database className="w-4 h-4 text-violet-600" />
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Custom fields</h3>
      </div>
      <dl className="space-y-2.5">
        {defs.map((d) => {
          const value = values[d.key]
          const runStatus = aiRuns[d.key]
          return (
            <div key={d.id} className="grid grid-cols-[110px_1fr] gap-3 items-start">
              <dt className="text-xs font-medium text-gray-500 dark:text-gray-400 pt-1 truncate" title={d.label}>
                {d.label}
              </dt>
              <dd className="min-w-0">
                {d.type === 'ai' ? (
                  <AiCell
                    def={d}
                    value={value as string | undefined}
                    runStatus={runStatus}
                    running={runningKey === d.key}
                    onRun={() => runAi(d)}
                  />
                ) : d.type === 'text' || d.type === 'url' ? (
                  <input
                    type={d.type === 'url' ? 'url' : 'text'}
                    defaultValue={(value as string) ?? ''}
                    onBlur={(e) => persist(d.key, e.target.value || null)}
                    className="w-full px-2 py-1 text-sm border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                ) : d.type === 'number' ? (
                  <input
                    type="number"
                    defaultValue={value == null ? '' : String(value)}
                    onBlur={(e) => persist(d.key, e.target.value === '' ? null : Number(e.target.value))}
                    className="w-32 px-2 py-1 text-sm border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                ) : d.type === 'date' ? (
                  <input
                    type="date"
                    defaultValue={value ? String(value).slice(0, 10) : ''}
                    onBlur={(e) => persist(d.key, e.target.value || null)}
                    className="px-2 py-1 text-sm border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                ) : d.type === 'bool' ? (
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={value === true}
                      onChange={(e) => persist(d.key, e.target.checked)}
                      className="rounded border-gray-300 text-violet-600"
                    />
                    <span className="text-gray-700 dark:text-gray-300">Yes</span>
                  </label>
                ) : d.type === 'select' ? (
                  <select
                    value={(value as string) ?? ''}
                    onChange={(e) => persist(d.key, e.target.value)}
                    className="px-2 py-1 text-sm border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    <option value="">—</option>
                    {(d.options ?? []).map((o) => (<option key={o} value={o}>{o}</option>))}
                  </select>
                ) : d.type === 'multiselect' ? (
                  <MultiselectCell
                    options={d.options ?? []}
                    value={(Array.isArray(value) ? value : []) as string[]}
                    onChange={(v) => persist(d.key, v)}
                  />
                ) : (
                  <span className="text-xs text-gray-400 italic">(unsupported type: {d.type})</span>
                )}
              </dd>
            </div>
          )
        })}
      </dl>
    </div>
  )
}

function AiCell(props: {
  def:       FieldDef
  value:     string | undefined
  runStatus: RunStatus | undefined
  running:   boolean
  onRun:     () => void
}) {
  const failed = props.runStatus?.status === 'failed'
  return (
    <div className="flex items-start gap-2">
      <div className="flex-1 min-w-0">
        {props.value ? (
          <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">{props.value}</p>
        ) : (
          <p className="text-xs text-gray-400 italic flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Not run yet
          </p>
        )}
        {failed && props.runStatus?.error && (
          <p className="text-xs text-red-500 mt-1 flex items-start gap-1">
            <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
            {props.runStatus.error}
          </p>
        )}
      </div>
      <button
        onClick={props.onRun}
        disabled={props.running}
        className="flex-shrink-0 inline-flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-700 disabled:opacity-50 px-2 py-1 border border-violet-200 dark:border-violet-800 rounded hover:bg-violet-50 dark:hover:bg-violet-950 transition-colors"
        title={props.def.aiPrompt ?? undefined}
      >
        {props.running ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
        {props.value ? 'Re-run' : 'Run'}
      </button>
    </div>
  )
}

function MultiselectCell(props: { options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {props.options.map((o) => {
        const on = props.value.includes(o)
        return (
          <button
            key={o}
            type="button"
            onClick={() => props.onChange(on ? props.value.filter((x) => x !== o) : [...props.value, o])}
            className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
              on
                ? 'bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-200 border-violet-200 dark:border-violet-800'
                : 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            {o}
          </button>
        )
      })}
    </div>
  )
}
