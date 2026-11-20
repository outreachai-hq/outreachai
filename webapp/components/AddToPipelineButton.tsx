'use client'

import { useState, useEffect } from 'react'
import { Plus, X, TrendingUp } from 'lucide-react'

interface PipelineStage {
  id: string
  name: string
  position: number
  color: string
}

interface Pipeline {
  id: string
  name: string
  stages: PipelineStage[]
}

interface AddToPipelineButtonProps {
  contactId?: string
  companyId?: string
  contactName?: string
}

export function AddToPipelineButton({ contactId, companyId, contactName }: AddToPipelineButtonProps) {
  const [open, setOpen] = useState(false)
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [selectedPipelineId, setSelectedPipelineId] = useState('')
  const [selectedStageId, setSelectedStageId] = useState('')
  const [title, setTitle] = useState(contactName ?? '')
  const [value, setValue] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open && pipelines.length === 0) {
      fetch('/api/pipelines')
        .then((r) => r.ok ? r.json() : { pipelines: [] })
        .then((d) => {
          setPipelines(d.pipelines)
          if (d.pipelines.length > 0) {
            const first = d.pipelines[0]
            setSelectedPipelineId(first.id)
            if (first.stages.length > 0) {
              setSelectedStageId(first.stages[0].id)
            }
          }
        })
        .catch(() => {})
    }
  }, [open, pipelines.length])

  // When pipeline changes, reset stage to first
  useEffect(() => {
    const p = pipelines.find((p) => p.id === selectedPipelineId)
    if (p && p.stages.length > 0) {
      setSelectedStageId(p.stages[0].id)
    }
  }, [selectedPipelineId, pipelines])

  const selectedPipeline = pipelines.find((p) => p.id === selectedPipelineId)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !selectedPipelineId || !selectedStageId) return
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          pipelineId: selectedPipelineId,
          stageId: selectedStageId,
          value: value ? parseFloat(value) : null,
          contactId: contactId ?? null,
          companyId: companyId ?? null,
        }),
      })

      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error ?? 'Failed to create deal')
        setSubmitting(false)
        return
      }

      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        setOpen(false)
        setTitle(contactName ?? '')
        setValue('')
      }, 2000)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-xs font-medium text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/30 hover:bg-purple-100 dark:hover:bg-purple-900/40 rounded-md px-2 py-1.5 transition-colors whitespace-nowrap"
      >
        <Plus className="w-3 h-3" />
        Pipeline
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />

          {/* Modal */}
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-purple-600" />
                <h3 className="text-base font-bold text-gray-900 dark:text-white">Add to Pipeline</h3>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            {success ? (
              <div className="text-center py-6">
                <p className="text-2xl mb-2">✓</p>
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Deal added!</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Deal title *</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    placeholder="Deal title"
                    className="w-full text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Value ($)</label>
                  <input
                    type="number"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="0"
                    className="w-full text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                {pipelines.length > 1 && (
                  <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Pipeline</label>
                    <select
                      value={selectedPipelineId}
                      onChange={(e) => setSelectedPipelineId(e.target.value)}
                      className="w-full text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      {pipelines.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Stage</label>
                  <select
                    value={selectedStageId}
                    onChange={(e) => setSelectedStageId(e.target.value)}
                    className="w-full text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    {(selectedPipeline?.stages ?? []).map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                {error && <p className="text-xs text-red-600">{error}</p>}

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="flex-1 text-sm py-2 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !title.trim() || !selectedStageId}
                    className="flex-1 text-sm py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition-colors font-semibold"
                  >
                    {submitting ? 'Adding…' : 'Add to pipeline'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
