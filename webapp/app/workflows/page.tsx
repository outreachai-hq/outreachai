'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Zap, Plus, X, CheckCircle, AlertCircle, XCircle, Clock } from 'lucide-react'
import { TRIGGERS, ACTIONS } from '@/lib/workflowCatalog'

// ─── Types ────────────────────────────────────────────────────────────────────

interface WorkflowRun {
  id: string
  result: 'success' | 'skipped' | 'error'
  actionsRun: number
  entityId: string | null
  entityType: string | null
  error: string | null
  createdAt: string
  payload: Record<string, unknown> | null
}

interface Workflow {
  id: string
  name: string
  description: string | null
  active: boolean
  triggerKey: string
  conditions: unknown[]
  actions: Array<{ key: string; config: Record<string, unknown> }>
  runCount: number
  lastRunAt: string | null
  createdAt: string
}

// ─── Templates ───────────────────────────────────────────────────────────────

const TEMPLATES = [
  {
    name: 'Reply → Pipeline',
    triggerKey: 'lead.replied',
    conditions: [],
    actions: [
      { key: 'deal.create', config: {} },
      { key: 'task.create', config: { title: 'Follow up', type: 'call', dueDaysFromNow: 1 } },
    ],
  },
  {
    name: 'Hot lead alert',
    triggerKey: 'lead.email_opened',
    conditions: [{ field: 'lead.openCount', operator: 'gte', value: 3 }],
    actions: [{ key: 'lead.add_tag', config: { tag: 'hot' } }],
  },
  {
    name: 'Booking → Deal',
    triggerKey: 'booking.confirmed',
    conditions: [],
    actions: [{ key: 'deal.create', config: {} }],
  },
  {
    name: 'Won deal → Webhook',
    triggerKey: 'deal.won',
    conditions: [],
    actions: [{ key: 'notify.webhook', config: { url: '' } }],
  },
  {
    name: 'Overdue task alert',
    triggerKey: 'task.overdue',
    conditions: [],
    actions: [{ key: 'notify.webhook', config: { url: '' } }],
  },
  {
    name: 'Signal → Tag lead',
    triggerKey: 'signal.fired',
    conditions: [],
    actions: [{ key: 'lead.add_tag', config: { tag: 'signal' } }],
  },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTriggerLabel(key: string): string {
  return TRIGGERS.find((t) => t.key === key)?.label ?? key
}

function getActionLabel(key: string): string {
  return ACTIONS.find((a) => a.key === key)?.label ?? key
}

function relativeTime(iso: string | null): string {
  if (!iso) return 'never'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

// ─── Run Log Modal ────────────────────────────────────────────────────────────

function RunLogModal({ workflow, onClose }: { workflow: Workflow; onClose: () => void }) {
  const [runs, setRuns] = useState<WorkflowRun[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/workflows/${workflow.id}/runs`)
      .then((r) => r.json())
      .then((d) => { setRuns(d.runs ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [workflow.id])

  function resultIcon(result: WorkflowRun['result']) {
    if (result === 'success') return <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
    if (result === 'skipped') return <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
    return <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
            Run log: {workflow.name}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 divide-y divide-gray-100 dark:divide-gray-800">
          {loading && (
            <div className="p-6 text-center text-sm text-gray-400">Loading...</div>
          )}
          {!loading && runs.length === 0 && (
            <div className="p-6 text-center text-sm text-gray-400">No runs yet.</div>
          )}
          {runs.map((run) => (
            <div key={run.id} className="flex items-start gap-3 px-5 py-3">
              {resultIcon(run.result)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-gray-900 dark:text-gray-100 capitalize">
                    {run.result}
                  </span>
                  {run.entityType && run.entityId && (
                    <span className="text-gray-500 dark:text-gray-400 text-xs">
                      {run.entityType}: {run.entityId.slice(0, 8)}…
                    </span>
                  )}
                  <span className="text-xs text-gray-400 ml-auto">{relativeTime(run.createdAt)}</span>
                </div>
                {run.result === 'success' && (
                  <p className="text-xs text-gray-500 mt-0.5">{run.actionsRun} action{run.actionsRun !== 1 ? 's' : ''} run</p>
                )}
                {run.result === 'skipped' && (
                  <p className="text-xs text-amber-600 mt-0.5">Condition not met</p>
                )}
                {run.error && (
                  <p className="text-xs text-red-600 mt-0.5 truncate">{run.error}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Workflow Row ─────────────────────────────────────────────────────────────

function WorkflowRow({
  workflow,
  onToggle,
  onDelete,
  onLogs,
}: {
  workflow: Workflow
  onToggle: (id: string, active: boolean) => void
  onDelete: (id: string) => void
  onLogs: (workflow: Workflow) => void
}) {
  const router = useRouter()
  const firstAction = workflow.actions[0]?.key

  return (
    <div className="flex items-center gap-4 p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 transition-colors">
      {/* Status dot */}
      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${workflow.active ? 'bg-emerald-400' : 'bg-gray-300'}`} />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{workflow.name}</span>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
          {getTriggerLabel(workflow.triggerKey)}
          {firstAction && <> &rarr; {getActionLabel(firstAction)}</>}
          {workflow.actions.length > 1 && ` +${workflow.actions.length - 1} more`}
        </p>
      </div>

      {/* Stats */}
      <div className="flex-shrink-0 text-right hidden sm:block">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{workflow.runCount} runs</p>
        <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1 justify-end">
          <Clock className="w-3 h-3" />
          {relativeTime(workflow.lastRunAt)}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Active toggle */}
        <button
          onClick={() => onToggle(workflow.id, !workflow.active)}
          title={workflow.active ? 'Pause' : 'Enable'}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            workflow.active ? 'bg-emerald-400' : 'bg-gray-200 dark:bg-gray-700'
          }`}
        >
          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${workflow.active ? 'translate-x-4' : 'translate-x-1'}`} />
        </button>

        <button
          onClick={() => router.push(`/workflows/${workflow.id}`)}
          className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          Edit
        </button>
        <button
          onClick={() => onLogs(workflow)}
          className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          Logs
        </button>
        <button
          onClick={() => onDelete(workflow.id)}
          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition-colors"
          title="Delete"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WorkflowsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [loading, setLoading] = useState(true)
  const [logsWorkflow, setLogsWorkflow] = useState<Workflow | null>(null)

  const load = useCallback(() => {
    fetch('/api/workflows')
      .then((r) => r.json())
      .then((d) => { setWorkflows(d.workflows ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (status === 'authenticated') load()
  }, [status, load, router])

  async function handleToggle(id: string, active: boolean) {
    await fetch(`/api/workflows/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    })
    setWorkflows((prev) => prev.map((w) => w.id === id ? { ...w, active } : w))
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this workflow?')) return
    await fetch(`/api/workflows/${id}`, { method: 'DELETE' })
    setWorkflows((prev) => prev.filter((w) => w.id !== id))
  }

  async function handleTemplate(tpl: typeof TEMPLATES[0]) {
    const res = await fetch('/api/workflows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: tpl.name,
        triggerKey: tpl.triggerKey,
        conditions: tpl.conditions,
        actions: tpl.actions,
      }),
    })
    if (res.ok) {
      const { workflow } = await res.json()
      router.push(`/workflows/${workflow.id}`)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) return null

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-950 min-h-screen">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-900 flex items-center justify-center">
              <Zap className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Workflows</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Automate your outreach with if-this-then-that rules</p>
            </div>
          </div>
          <button
            onClick={() => router.push('/workflows/new')}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-lg transition-colors self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            New workflow
          </button>
        </div>

        {/* Template section — shown when 0 workflows */}
        {workflows.length === 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">
              Start from a template
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {TEMPLATES.map((tpl) => (
                <button
                  key={tpl.name}
                  onClick={() => handleTemplate(tpl)}
                  className="text-left p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-violet-400 dark:hover:border-violet-600 hover:shadow-sm transition-all group"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center flex-shrink-0 group-hover:bg-violet-100 dark:group-hover:bg-violet-900/30 transition-colors">
                      <Zap className="w-4 h-4 text-violet-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{tpl.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                        {getTriggerLabel(tpl.triggerKey)} &rarr; {getActionLabel(tpl.actions[0]?.key)}
                        {tpl.actions.length > 1 && ` +${tpl.actions.length - 1}`}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Workflow list */}
        {workflows.length > 0 ? (
          <div className="space-y-3">
            {workflows.map((wf) => (
              <WorkflowRow
                key={wf.id}
                workflow={wf}
                onToggle={handleToggle}
                onDelete={handleDelete}
                onLogs={setLogsWorkflow}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400">
            <Zap className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No workflows yet. Automate your outreach with workflows.</p>
          </div>
        )}
      </div>

      {/* Run Log Modal */}
      {logsWorkflow && (
        <RunLogModal
          workflow={logsWorkflow}
          onClose={() => setLogsWorkflow(null)}
        />
      )}
    </div>
  )
}
