'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import WorkflowBuilder from '@/components/WorkflowBuilder'

interface WorkflowData {
  id: string
  name: string
  description: string | null
  triggerKey: string
  conditions: Array<{ field: string; operator: string; value: string }>
  actions: Array<{ key: string; config: Record<string, unknown> }>
}

export default function EditWorkflowPage() {
  const { id } = useParams<{ id: string }>()
  const [workflow, setWorkflow] = useState<WorkflowData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    fetch(`/api/workflows/${id}`)
      .then((r) => {
        if (!r.ok) { setNotFound(true); setLoading(false); return null }
        return r.json()
      })
      .then((d) => {
        if (d) { setWorkflow(d.workflow); setLoading(false) }
      })
      .catch(() => { setNotFound(true); setLoading(false) })
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (notFound || !workflow) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Workflow not found.</p>
      </div>
    )
  }

  return (
    <WorkflowBuilder
      initialData={{
        id: workflow.id,
        name: workflow.name,
        description: workflow.description ?? undefined,
        triggerKey: workflow.triggerKey,
        conditions: workflow.conditions,
        actions: workflow.actions,
      }}
    />
  )
}
