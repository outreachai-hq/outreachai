'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, ArrowLeft, Save, Zap } from 'lucide-react'
import { TRIGGERS, ACTIONS } from '@/lib/workflowCatalog'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Condition {
  field: string
  operator: string
  value: string
}

interface WorkflowAction {
  key: string
  config: Record<string, unknown>
}

interface PipelineStage {
  id: string
  name: string
  pipelineId: string
  pipelineName?: string
}

interface WorkflowBuilderProps {
  initialData?: {
    id?: string
    name?: string
    description?: string
    triggerKey?: string
    conditions?: Condition[]
    actions?: WorkflowAction[]
  }
}

const CONDITION_FIELDS = [
  { value: 'lead.score', label: 'Lead score' },
  { value: 'lead.status', label: 'Lead status' },
  { value: 'lead.email', label: 'Lead email' },
  { value: 'lead.company', label: 'Lead company' },
  { value: 'lead.openCount', label: 'Open count' },
  { value: 'deal.value', label: 'Deal value' },
  { value: 'deal.status', label: 'Deal status' },
  { value: 'conversation.channel', label: 'Channel' },
]

const CONDITION_OPERATORS = [
  { value: 'eq', label: 'equals' },
  { value: 'not_eq', label: 'does not equal' },
  { value: 'gt', label: 'greater than' },
  { value: 'lt', label: 'less than' },
  { value: 'gte', label: 'greater than or equal' },
  { value: 'lte', label: 'less than or equal' },
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'does not contain' },
  { value: 'is_empty', label: 'is empty' },
  { value: 'not_empty', label: 'is not empty' },
]

// ─── StagePicker ──────────────────────────────────────────────────────────────

function StagePicker({
  value,
  onChange,
}: {
  value: string
  onChange: (stageId: string) => void
}) {
  const [stages, setStages] = useState<PipelineStage[]>([])

  useEffect(() => {
    fetch('/api/pipelines')
      .then((r) => r.json())
      .then((d) => {
        const all: PipelineStage[] = []
        for (const p of d.pipelines ?? []) {
          for (const s of p.stages ?? []) {
            all.push({ id: s.id, name: s.name, pipelineId: p.id, pipelineName: p.name })
          }
        }
        setStages(all)
      })
      .catch(() => {})
  }, [])

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
    >
      <option value="">First stage (default)</option>
      {stages.map((s) => (
        <option key={s.id} value={s.id}>
          {s.pipelineName} &gt; {s.name}
        </option>
      ))}
    </select>
  )
}

// ─── ActionConfigFields ───────────────────────────────────────────────────────

function ActionConfigFields({
  actionKey,
  config,
  onChange,
}: {
  actionKey: string
  config: Record<string, unknown>
  onChange: (config: Record<string, unknown>) => void
}) {
  const actionDef = ACTIONS.find((a) => a.key === actionKey)
  if (!actionDef || actionDef.configFields.length === 0) return null

  return (
    <div className="mt-2 space-y-2 pl-4 border-l-2 border-gray-100 dark:border-gray-700">
      {actionDef.configFields.map((field) => {
        const val = config[field.name] ?? ''

        if (field.type === 'stage_picker') {
          return (
            <div key={field.name} className="flex items-center gap-2">
              <label className="text-xs text-gray-500 w-20 flex-shrink-0">{field.label}</label>
              <StagePicker
                value={String(val)}
                onChange={(v) => onChange({ ...config, [field.name]: v })}
              />
            </div>
          )
        }

        if (field.type === 'select' && 'options' in field) {
          return (
            <div key={field.name} className="flex items-center gap-2">
              <label className="text-xs text-gray-500 w-20 flex-shrink-0">{field.label}</label>
              <select
                value={String(val)}
                onChange={(e) => onChange({ ...config, [field.name]: e.target.value })}
                className="flex-1 px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                <option value="">Select...</option>
                {(field as { options: string[] }).options.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
          )
        }

        if (field.type === 'number') {
          return (
            <div key={field.name} className="flex items-center gap-2">
              <label className="text-xs text-gray-500 w-20 flex-shrink-0">{field.label}</label>
              <input
                type="number"
                min={1}
                value={String(val)}
                onChange={(e) => onChange({ ...config, [field.name]: Number(e.target.value) })}
                className="flex-1 px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                placeholder="1"
              />
            </div>
          )
        }

        // text / url
        return (
          <div key={field.name} className="flex items-center gap-2">
            <label className="text-xs text-gray-500 w-20 flex-shrink-0">{field.label}</label>
            <input
              type={field.type === 'url' ? 'url' : 'text'}
              value={String(val)}
              onChange={(e) => onChange({ ...config, [field.name]: e.target.value })}
              className="flex-1 px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              placeholder={field.label}
            />
          </div>
        )
      })}
    </div>
  )
}

// ─── Builder ──────────────────────────────────────────────────────────────────

export default function WorkflowBuilder({ initialData }: WorkflowBuilderProps) {
  const router = useRouter()
  const isEdit = !!initialData?.id

  const [name, setName] = useState(initialData?.name ?? '')
  const [description, setDescription] = useState(initialData?.description ?? '')
  const [triggerKey, setTriggerKey] = useState(initialData?.triggerKey ?? TRIGGERS[0].key)
  const [conditions, setConditions] = useState<Condition[]>(initialData?.conditions ?? [])
  const [actions, setActions] = useState<WorkflowAction[]>(
    initialData?.actions ?? [{ key: ACTIONS[0].key, config: {} }]
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Condition helpers ──────────────────────────────────────────────────────
  function addCondition() {
    setConditions((prev) => [...prev, { field: CONDITION_FIELDS[0].value, operator: 'eq', value: '' }])
  }
  function updateCondition(i: number, patch: Partial<Condition>) {
    setConditions((prev) => prev.map((c, idx) => idx === i ? { ...c, ...patch } : c))
  }
  function removeCondition(i: number) {
    setConditions((prev) => prev.filter((_, idx) => idx !== i))
  }

  // ── Action helpers ─────────────────────────────────────────────────────────
  function addAction() {
    setActions((prev) => [...prev, { key: ACTIONS[0].key, config: {} }])
  }
  function updateActionKey(i: number, key: string) {
    setActions((prev) => prev.map((a, idx) => idx === i ? { key, config: {} } : a))
  }
  function updateActionConfig(i: number, config: Record<string, unknown>) {
    setActions((prev) => prev.map((a, idx) => idx === i ? { ...a, config } : a))
  }
  function removeAction(i: number) {
    setActions((prev) => prev.filter((_, idx) => idx !== i))
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!name.trim()) { setError('Workflow name is required'); return }
    if (actions.length === 0) { setError('At least one action is required'); return }

    setSaving(true)
    setError(null)

    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      triggerKey,
      conditions,
      actions,
    }

    const url = isEdit ? `/api/workflows/${initialData?.id}` : '/api/workflows'
    const method = isEdit ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    setSaving(false)

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Failed to save workflow')
      return
    }

    router.push('/workflows')
    router.refresh()
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-950 min-h-screen">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        {/* Back */}
        <button
          onClick={() => router.push('/workflows')}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to workflows
        </button>

        {/* Title */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-900 flex items-center justify-center">
            <Zap className="w-5 h-5 text-violet-600 dark:text-violet-400" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {isEdit ? 'Edit workflow' : 'New workflow'}
          </h1>
        </div>

        <div className="space-y-6">
          {/* Name + description */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                Workflow name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                placeholder="e.g. Reply → create deal"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                Description (optional)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                placeholder="Short description"
              />
            </div>
          </div>

          {/* Trigger */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
            <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              Trigger
            </h2>
            <select
              value={triggerKey}
              onChange={(e) => setTriggerKey(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              {TRIGGERS.map((t) => (
                <option key={t.key} value={t.key}>{t.label}</option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-2">
              {TRIGGERS.find((t) => t.key === triggerKey)?.description}
            </p>
          </div>

          {/* Conditions */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Conditions <span className="text-gray-400 font-normal normal-case">(optional — all must match)</span>
              </h2>
            </div>

            <div className="space-y-2">
              {conditions.map((cond, i) => (
                <div key={i} className="flex items-center gap-2 flex-wrap">
                  <select
                    value={cond.field}
                    onChange={(e) => updateCondition(i, { field: e.target.value })}
                    className="px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    {CONDITION_FIELDS.map((f) => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                  <select
                    value={cond.operator}
                    onChange={(e) => updateCondition(i, { operator: e.target.value })}
                    className="px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    {CONDITION_OPERATORS.map((op) => (
                      <option key={op.value} value={op.value}>{op.label}</option>
                    ))}
                  </select>
                  {cond.operator !== 'is_empty' && cond.operator !== 'not_empty' && (
                    <input
                      type="text"
                      value={cond.value}
                      onChange={(e) => updateCondition(i, { value: e.target.value })}
                      placeholder="Value"
                      className="px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 flex-1 min-w-[80px]"
                    />
                  )}
                  <button onClick={() => removeCondition(i)} className="p-1.5 text-gray-400 hover:text-red-500 rounded transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={addCondition}
              className="mt-3 flex items-center gap-1.5 text-xs text-violet-600 dark:text-violet-400 hover:text-violet-700 font-medium transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add condition
            </button>
          </div>

          {/* Actions */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
            <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              Actions
            </h2>

            <div className="space-y-4">
              {actions.map((action, i) => (
                <div key={i} className="border border-gray-100 dark:border-gray-700 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-400 w-5 flex-shrink-0">{i + 1}.</span>
                    <select
                      value={action.key}
                      onChange={(e) => updateActionKey(i, e.target.value)}
                      className="flex-1 px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    >
                      {ACTIONS.map((a) => (
                        <option key={a.key} value={a.key}>{a.label}</option>
                      ))}
                    </select>
                    <button onClick={() => removeAction(i)} className="p-1.5 text-gray-400 hover:text-red-500 rounded transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <ActionConfigFields
                    actionKey={action.key}
                    config={action.config}
                    onChange={(cfg) => updateActionConfig(i, cfg)}
                  />
                </div>
              ))}
            </div>

            <button
              onClick={addAction}
              className="mt-3 flex items-center gap-1.5 text-xs text-violet-600 dark:text-violet-400 hover:text-violet-700 font-medium transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add action
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Save button */}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create workflow'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
