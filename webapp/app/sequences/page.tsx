'use client'

import { useState, useEffect } from 'react'
import { HelpPanel } from '@/components/HelpPanel'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Plus, GitBranch, Trash2, X, Check, ToggleLeft, ToggleRight, Pencil } from 'lucide-react'

interface SequenceStep {
  day: number
  templateId: string
  templateName: string
}

interface Sequence {
  id: string
  name: string
  steps: SequenceStep[]
  active: boolean
  createdAt: string
}

interface Template {
  id: string
  name: string
}

export default function SequencesPage() {
  const { data: session } = useSession()
  const [sequences, setSequences] = useState<Sequence[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formName, setFormName] = useState('')
  const [steps, setSteps] = useState<SequenceStep[]>([
    { day: 1, templateId: '', templateName: '' },
  ])
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (session) fetchData()
  }, [session])

  async function fetchData() {
    setLoading(true)
    const [seqRes, tmplRes] = await Promise.all([
      fetch('/api/sequences'),
      fetch('/api/templates'),
    ])
    if (seqRes.ok) setSequences(await seqRes.json())
    if (tmplRes.ok) setTemplates(await tmplRes.json())
    setLoading(false)
  }

  function addStep() {
    const lastDay = steps[steps.length - 1]?.day ?? 0
    setSteps([...steps, { day: lastDay + 3, templateId: '', templateName: '' }])
  }

  function removeStep(index: number) {
    setSteps(steps.filter((_, i) => i !== index))
  }

  function updateStep(index: number, field: 'day' | 'templateId', value: string | number) {
    setSteps((prev) =>
      prev.map((s, i) => {
        if (i !== index) return s
        if (field === 'templateId') {
          const tmpl = templates.find((t) => t.id === value)
          return { ...s, templateId: value as string, templateName: tmpl?.name ?? '' }
        }
        return { ...s, day: Number(value) }
      })
    )
  }

  function cancelForm() {
    setShowForm(false)
    setFormName('')
    setSteps([{ day: 1, templateId: '', templateName: '' }])
    setFormError(null)
  }

  async function saveSequence(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setFormError(null)

    try {
      const res = await fetch('/api/sequences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formName, steps, active: false }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setFormError(data.error ?? 'Failed to create sequence. Please try again.')
        return
      }

      cancelForm()
      fetchData()
    } catch {
      setFormError('Network error. Please check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteSequence(id: string) {
    setDeletingId(id)
    await fetch(`/api/sequences?id=${id}`, { method: 'DELETE' })
    setSequences((prev) => prev.filter((s) => s.id !== id))
    setDeletingId(null)
  }

  async function toggleActive(seq: Sequence) {
    const res = await fetch('/api/sequences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: seq.id, active: !seq.active }),
    })
    if (res.ok) {
      setSequences((prev) => prev.map((s) => (s.id === seq.id ? { ...s, active: !s.active } : s)))
    }
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sequences</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Automated multi-step outreach campaigns.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          New Sequence
        </button>
      </div>

      {/* New Sequence Form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-blue-200 shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">New Sequence</h2>
            <button onClick={cancelForm} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={saveSequence} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Sequence name</label>
              <input
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. SaaS founders campaign"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent dark:bg-gray-800 dark:border-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Steps</label>
              <div className="space-y-3">
                {steps.map((step, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-400 dark:text-gray-500 w-5">Day</span>
                      <input
                        type="number"
                        min={1}
                        required
                        value={step.day}
                        onChange={(e) => updateStep(i, 'day', e.target.value)}
                        className="w-16 px-2 py-2 border border-gray-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                      />
                    </div>
                    <select
                      required
                      value={step.templateId}
                      onChange={(e) => updateStep(i, 'templateId', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                    >
                      <option value="">Select template…</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                    {steps.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeStep(i)}
                        className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addStep}
                className="mt-3 inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                Add step
              </button>
            </div>

            {formError && (
              <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>
            )}
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={cancelForm}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                <Check className="w-4 h-4" />
                {saving ? 'Saving…' : 'Create Sequence'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Sequences list */}
      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Loading sequences…</div>
      ) : sequences.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 py-16 text-center">
          <GitBranch className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">No sequences yet.</p>
          <p className="text-xs text-gray-400 mt-1">Create a sequence to automate your follow-ups.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sequences.map((seq) => (
            <div
              key={seq.id}
              className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-2 min-w-0">
                  <GitBranch className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{seq.name}</h3>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => toggleActive(seq)}
                    className={`transition-colors ${seq.active ? 'text-blue-600' : 'text-gray-300 hover:text-gray-400'}`}
                    title={seq.active ? 'Deactivate' : 'Activate'}
                  >
                    {seq.active ? (
                      <ToggleRight className="w-5 h-5" />
                    ) : (
                      <ToggleLeft className="w-5 h-5" />
                    )}
                  </button>
                  <button
                    onClick={() => deleteSequence(seq.id)}
                    disabled={deletingId === seq.id}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    title={deletingId === seq.id ? 'Deleting…' : 'Delete'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="mb-3">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    seq.active ? 'bg-green-50 text-green-700' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {seq.active ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className="space-y-2">
                {seq.steps.map((step, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2"
                  >
                    <span className="font-semibold text-blue-600 w-12 flex-shrink-0">
                      Day {step.day}
                    </span>
                    <span className="truncate">{step.templateName || 'Unknown template'}</span>
                  </div>
                ))}
              </div>

              <p className="text-xs text-gray-300 mt-3">
                {seq.steps.length} step{seq.steps.length !== 1 ? 's' : ''}
                {' · '}
                {new Date(seq.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>

              <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
                <Link
                  href={`/sequences/${seq.id}`}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 border border-blue-200 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  View / Edit
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
      <HelpPanel
        title='Sequences'
        description='A sequence is a multi-step outreach script — the messages and timing used across campaigns.'
        sections={[
        { title: 'What is a sequence?', content: "A sequence defines WHAT to send and WHEN. It's a reusable script: step 1 on day 1 (LinkedIn invite), step 2 on day 3 (LinkedIn message), step 3 on day 7 (email).", example: '"Cold Outreach v1" sequence: Day 1 → connection request. Day 3 → "Hi {{firstName}}, noticed your work at {{company}}...". Day 7 → email follow-up.', tip: 'Build one great sequence and reuse it across many campaigns rather than recreating messages each time.' },
        { title: 'Adding steps', content: 'Click into a sequence → Add Step → choose the type: LinkedIn connection, LinkedIn message, email, or wait. Set the delay between steps and write the message.', example: 'Step 1: Connect (no message). Step 2: Wait 2 days. Step 3: Chat message "Hi {{firstName}}...". Step 4: Wait 5 days. Step 5: Email "Following up on my LinkedIn message..."', tip: 'Keep LinkedIn messages under 300 characters — longer messages feel like spam and get lower acceptance rates.' },
        { title: 'Variables (personalisation)', content: 'Use {{firstName}}, {{company}}, {{headline}}, {{aiOpener}} in your messages. These are replaced with real lead data when the step executes.', example: '"Hi {{firstName}}, I noticed you\'re the {{headline}} at {{company}} — we help teams like yours 3x reply rates." becomes "Hi Anjali, I noticed you\'re the VP Sales at Meesho — we help teams like yours 3x reply rates."', tip: '{{aiOpener}} uses AI to write a unique opening line for each lead based on their LinkedIn profile.' },
        { title: 'A/B testing steps', content: 'Enable A/B on any email step to test two subject lines. OutreachAI splits your leads 50/50 and shows which version gets more opens.', example: 'Subject A: "Quick question about {{company}}" vs Subject B: "How {{company}} could improve reply rates" — after 100 sends, Subject A wins 34% open rate vs 21%.' },
        ]}
      />
    </div>
  )
}
