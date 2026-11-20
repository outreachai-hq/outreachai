'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import WorkflowBuilder from '@/components/WorkflowBuilder'

function NewWorkflowInner() {
  const searchParams = useSearchParams()
  const triggerKey = searchParams.get('trigger') ?? undefined
  return <WorkflowBuilder initialData={triggerKey ? { triggerKey } : undefined} />
}

export default function NewWorkflowPage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-400 text-sm">Loading…</div>}>
      <NewWorkflowInner />
    </Suspense>
  )
}
