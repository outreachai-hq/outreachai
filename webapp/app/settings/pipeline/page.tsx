'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2, TrendingUp } from 'lucide-react'

interface Stage {
  id: string
  name: string
  position: number
  probability: number
  type: string
  color: string
}

interface Pipeline {
  id: string
  name: string
  isDefault: boolean
  stages: Stage[]
}

export default function PipelineSettingsPage() {
  const { status } = useSession()
  const router = useRouter()

  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null)
  const [newPipelineName, setNewPipelineName] = useState('')
  const [creatingPipeline, setCreatingPipeline] = useState(false)
  const [newStageName, setNewStageName] = useState('')
  const [addingStage, setAddingStage] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login')
  }, [status, router])

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/pipelines')
    if (res.ok) {
      const data = await res.json()
      setPipelines(data.pipelines)
      if (!selectedPipelineId && data.pipelines.length > 0) {
        setSelectedPipelineId(data.pipelines[0].id)
      }
    }
    setLoading(false)
  }, [selectedPipelineId])

  useEffect(() => {
    if (status === 'authenticated') load()
  }, [status, load])

  const selectedPipeline = pipelines.find((p) => p.id === selectedPipelineId)

  async function createPipeline() {
    if (!newPipelineName.trim()) return
    setCreatingPipeline(true)
    const res = await fetch('/api/pipelines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newPipelineName.trim() }),
    })
    setCreatingPipeline(false)
    if (res.ok) {
      const d = await res.json()
      setNewPipelineName('')
      setSelectedPipelineId(d.pipeline.id)
      load()
    }
  }

  async function renamePipeline(id: string, name: string) {
    await fetch(`/api/pipelines/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    load()
  }

  async function deletePipeline(id: string) {
    if (!confirm('Delete this pipeline? Only possible if it has no deals.')) return
    const res = await fetch(`/api/pipelines/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Cannot delete pipeline')
    } else {
      setSelectedPipelineId(null)
      load()
    }
  }

  async function addStage() {
    if (!newStageName.trim() || !selectedPipelineId) return
    setAddingStage(true)
    const res = await fetch(`/api/pipelines/${selectedPipelineId}/stages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newStageName.trim() }),
    })
    setAddingStage(false)
    if (res.ok) {
      setNewStageName('')
      load()
    }
  }

  async function updateStage(stageId: string, data: Partial<Stage>) {
    if (!selectedPipelineId) return
    await fetch(`/api/pipelines/${selectedPipelineId}/stages/${stageId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    load()
  }

  async function deleteStage(stageId: string) {
    if (!selectedPipelineId) return
    if (!confirm('Delete this stage? Deals in this stage will be moved to the previous stage.')) return
    await fetch(`/api/pipelines/${selectedPipelineId}/stages/${stageId}`, { method: 'DELETE' })
    load()
  }

  if (status === 'loading' || loading) {
    return <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
  }

  return (
    <div className="p-6 md:p-8 max-w-3xl">
      <div className="mb-6">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Settings
        </Link>
        <div className="flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pipeline Settings</h1>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage your pipelines and stages.</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-sm text-red-700 flex items-center justify-between">
          {error}
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* Pipeline selector + create */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 mb-5">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Your Pipelines</h2>
        <div className="space-y-2 mb-4">
          {pipelines.map((p) => (
            <div
              key={p.id}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer transition-colors ${
                p.id === selectedPipelineId
                  ? 'bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-800'
                  : 'border border-transparent hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
              onClick={() => setSelectedPipelineId(p.id)}
            >
              <span className="flex-1 text-sm font-medium text-gray-900 dark:text-white">{p.name}</span>
              {p.isDefault && (
                <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">Default</span>
              )}
              {!p.isDefault && (
                <button
                  onClick={(e) => { e.stopPropagation(); deletePipeline(p.id) }}
                  className="text-red-400 hover:text-red-600 p-1 rounded"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newPipelineName}
            onChange={(e) => setNewPipelineName(e.target.value)}
            placeholder="New pipeline name"
            className="flex-1 text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            onKeyDown={(e) => { if (e.key === 'Enter') createPipeline() }}
          />
          <button
            onClick={createPipeline}
            disabled={creatingPipeline || !newPipelineName.trim()}
            className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg disabled:opacity-50 transition-colors font-medium"
          >
            {creatingPipeline ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>

      {/* Stages for selected pipeline */}
      {selectedPipeline && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Stages — {selectedPipeline.name}
            </h2>
          </div>

          <div className="space-y-2 mb-4">
            {selectedPipeline.stages.map((stage) => (
              <div key={stage.id} className="flex items-center gap-3 p-3 border border-gray-100 dark:border-gray-800 rounded-lg">
                {/* Color dot + input */}
                <input
                  type="color"
                  defaultValue={stage.color}
                  onBlur={(e) => updateStage(stage.id, { color: e.target.value })}
                  className="w-6 h-6 rounded-full border-0 p-0 cursor-pointer flex-shrink-0"
                  title="Stage color"
                />
                <input
                  defaultValue={stage.name}
                  onBlur={(e) => {
                    if (e.target.value.trim() !== stage.name) {
                      updateStage(stage.id, { name: e.target.value.trim() })
                    }
                  }}
                  className="flex-1 text-sm bg-transparent border-0 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1"
                />
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-400 dark:text-gray-500">prob:</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    defaultValue={stage.probability}
                    onBlur={(e) => updateStage(stage.id, { probability: parseInt(e.target.value) })}
                    className="w-14 text-xs border border-gray-200 dark:border-gray-700 rounded px-1.5 py-0.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  <span className="text-xs text-gray-400">%</span>
                </div>
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  stage.type === 'won' ? 'bg-emerald-100 text-emerald-700' :
                  stage.type === 'lost' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-600'
                }`}>{stage.type}</span>
                <button
                  onClick={() => deleteStage(stage.id)}
                  className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 p-1 rounded flex-shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Add stage */}
          <div className="flex gap-2">
            <input
              value={newStageName}
              onChange={(e) => setNewStageName(e.target.value)}
              placeholder="New stage name"
              className="flex-1 text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              onKeyDown={(e) => { if (e.key === 'Enter') addStage() }}
            />
            <button
              onClick={addStage}
              disabled={addingStage || !newStageName.trim()}
              className="inline-flex items-center gap-1.5 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg disabled:opacity-50 transition-colors font-medium"
            >
              <Plus className="w-4 h-4" />
              {addingStage ? 'Adding…' : 'Add stage'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
