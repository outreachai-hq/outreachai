'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, X, Check, Save } from 'lucide-react'

type StepType =
  | 'email'
  | 'visit_profile'
  | 'connection_request'
  | 'wait'
  | 'wait_until_accepted'
  | 'chat_message'
  | 'whatsapp_message'

interface ABVariant {
  id: string
  label: string
  subject: string
  message: string
  weight: number
}

interface SequenceStep {
  id: string
  type: StepType
  name: string
  waitDays: number
  message: string
  // Email-only
  subject?: string
  emailAccountId?: string | null
  markAsManual?: boolean
  // A/B testing
  abEnabled?: boolean
  variants?: ABVariant[]
}

interface EmailAccount {
  id: string
  name: string
  email: string
  isDefault: boolean
}

interface Sequence {
  id: string
  name: string
  steps: SequenceStep[]
  active: boolean
  createdAt: string
}

const STEP_TYPES: { value: StepType; label: string; icon: string; border: string; bg: string; text: string }[] = [
  { value: 'email', label: 'Email', icon: '✉️', border: 'border-emerald-400', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  { value: 'visit_profile', label: 'Visit Profile', icon: '👁️', border: 'border-blue-400', bg: 'bg-blue-50', text: 'text-blue-700' },
  { value: 'connection_request', label: 'Connection Request', icon: '🤝', border: 'border-green-400', bg: 'bg-green-50', text: 'text-green-700' },
  { value: 'chat_message', label: 'Chat Message', icon: '💬', border: 'border-purple-400', bg: 'bg-purple-50', text: 'text-purple-700' },
  { value: 'whatsapp_message', label: 'WhatsApp Message', icon: '📱', border: 'border-[#25D366]', bg: 'bg-green-50', text: 'text-[#128C7E]' },
  { value: 'wait', label: 'Wait', icon: '⏰', border: 'border-yellow-400', bg: 'bg-yellow-50', text: 'text-yellow-700' },
  { value: 'wait_until_accepted', label: 'Wait until accepted', icon: '⏳', border: 'border-amber-400', bg: 'bg-amber-50', text: 'text-amber-700' },
]

const STEP_BORDER: Record<StepType, string> = {
  email: 'border-l-emerald-400',
  visit_profile: 'border-l-blue-400',
  connection_request: 'border-l-green-400',
  wait: 'border-l-yellow-400',
  wait_until_accepted: 'border-l-amber-400',
  chat_message: 'border-l-purple-400',
  whatsapp_message: 'border-l-[#25D366]',
}

function genId() {
  return Math.random().toString(36).slice(2, 10)
}

function defaultStep(type: StepType = 'chat_message'): SequenceStep {
  const meta = STEP_TYPES.find((s) => s.value === type)!
  return {
    id: genId(),
    type,
    name: meta.label,
    waitDays: type === 'wait' ? 3 : 1,
    message: '',
    ...(type === 'email' && { subject: '', emailAccountId: null, markAsManual: false }),
  }
}

function isWhatsApp(type: StepType): boolean {
  return type === 'whatsapp_message'
}

export default function SequenceDetailPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [sequence, setSequence] = useState<Sequence | null>(null)
  const [steps, setSteps] = useState<SequenceStep[]>([])
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null)
  const [abTab, setAbTab] = useState<'a' | 'b'>('a')
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([])

  useEffect(() => {
    fetch('/api/email-accounts')
      .then((r) => (r.ok ? r.json() : { accounts: [] }))
      .then((d) => setEmailAccounts(d.accounts ?? []))
      .catch(() => {})
  }, [])

  const fetchSequence = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/sequences/${id}`)
    if (res.ok) {
      const data: Sequence = await res.json()
      setSequence(data)
      setName(data.name)
      const rawSteps = Array.isArray(data.steps) ? data.steps : []
      setSteps(
        rawSteps.map((s: Partial<SequenceStep>) => ({
          id: s.id ?? genId(),
          type: (s.type as StepType) ?? 'chat_message',
          name: s.name ?? (STEP_TYPES.find((t) => t.value === s.type)?.label ?? 'Step'),
          waitDays: s.waitDays ?? 1,
          message: s.message ?? '',
          subject: s.subject ?? '',
          emailAccountId: s.emailAccountId ?? null,
          markAsManual: s.markAsManual ?? false,
          abEnabled: s.abEnabled ?? false,
          variants: s.variants ?? undefined,
        }))
      )
    } else {
      router.replace('/sequences')
    }
    setLoading(false)
  }, [id, router])

  useEffect(() => {
    if (status === 'unauthenticated') { router.replace('/login'); return }
    if (status === 'authenticated') {
      const t = setTimeout(() => fetchSequence(), 0)
      return () => clearTimeout(t)
    }
  }, [status, fetchSequence, router])

  async function save() {
    setSaving(true)
    setSaveError(null)
    // Strip email-only fields off non-email steps so Zod doesn't gag
    const cleanSteps = steps.map((s) => {
      if (s.type === 'email') return s
      const { subject: _s, emailAccountId: _e, markAsManual: _m, ...rest } = s
      return rest
    })
    const res = await fetch(`/api/sequences/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, steps: cleanSteps }),
    })
    if (res.ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } else {
      const j = await res.json().catch(() => ({}))
      setSaveError(j.error ?? 'Save failed')
    }
    setSaving(false)
  }

  function addStepAfter(index: number) {
    const newStep = defaultStep()
    const updated = [...steps]
    updated.splice(index + 1, 0, newStep)
    setSteps(updated)
    setSelectedStepId(newStep.id)
  }

  function removeStep(stepId: string) {
    setSteps((prev) => prev.filter((s) => s.id !== stepId))
    if (selectedStepId === stepId) setSelectedStepId(null)
  }

  function updateStep(stepId: string, changes: Partial<SequenceStep>) {
    setSteps((prev) =>
      prev.map((s) => {
        if (s.id !== stepId) return s
        const updated = { ...s, ...changes }
        // Auto-update name when type changes
        if (changes.type) {
          const meta = STEP_TYPES.find((t) => t.value === changes.type)
          if (meta) updated.name = meta.label
        }
        return updated
      })
    )
  }

  const selectedStep = steps.find((s) => s.id === selectedStepId) ?? null

  if (status === 'loading' || loading) {
    return <div className="p-8 text-center text-gray-400 text-sm">Loading sequence…</div>
  }

  if (!sequence) return null

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="flex items-center gap-3">
          <Link href="/sequences" className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="text-xl font-bold text-gray-900 dark:text-white bg-transparent border-b-2 border-transparent focus:border-blue-500 focus:outline-none px-1 py-0.5 transition-colors min-w-[200px]"
          />
        </div>
        <button
          onClick={save}
          disabled={saving}
          className={`inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg transition-colors ${
            saved
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white'
          }`}
        >
          {saved ? <><Check className="w-4 h-4" />Saved!</> : <><Save className="w-4 h-4" />{saving ? 'Saving…' : 'Save'}</>}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sequence builder */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-md mx-auto">
            {/* Sequence start node */}
            <div className="flex flex-col items-center mb-2">
              <div className="bg-gray-900 dark:bg-gray-700 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-sm">
                Sequence start
              </div>
              {steps.length > 0 && (
                <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mt-2" />
              )}
            </div>

            {/* Add first step button (if empty) */}
            {steps.length === 0 && (
              <div className="flex flex-col items-center mt-2">
                <button
                  onClick={() => addStepAfter(-1)}
                  className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium border-2 border-dashed border-blue-300 hover:border-blue-400 px-6 py-3 rounded-xl transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add first step
                </button>
              </div>
            )}

            {/* Steps */}
            {steps.map((step, index) => {
              const meta = STEP_TYPES.find((t) => t.value === step.type)!
              const isSelected = selectedStepId === step.id

              return (
                <div key={step.id} className="flex flex-col items-center">
                  {/* Step card */}
                  <div
                    onClick={() => setSelectedStepId(isSelected ? null : step.id)}
                    className={`w-full border-l-4 ${STEP_BORDER[step.type]} bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 cursor-pointer transition-all hover:shadow-sm ${
                      isSelected ? 'ring-2 ring-blue-500 ring-offset-1' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3">
                        <span className="text-xl leading-none mt-0.5">{meta.icon}</span>
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{step.name}</p>
                          <p className={`text-xs font-medium ${meta.text} mt-0.5`}>{meta.label}</p>
                          {step.type !== 'wait' && step.waitDays > 0 && (
                            <p className="text-xs text-gray-400 mt-1">Wait {step.waitDays} day{step.waitDays !== 1 ? 's' : ''} before</p>
                          )}
                          {step.type === 'wait' && (
                            <p className="text-xs text-gray-400 mt-1">Wait {step.waitDays} day{step.waitDays !== 1 ? 's' : ''}</p>
                          )}
                          {step.message && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 line-clamp-2 italic">{step.message}</p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeStep(step.id) }}
                        className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Connector + add button */}
                  <div className="flex flex-col items-center my-1">
                    <div className="w-px h-4 bg-gray-300 dark:bg-gray-600" />
                    <button
                      onClick={() => addStepAfter(index)}
                      className="group flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 font-medium transition-colors py-1"
                    >
                      <span className="w-5 h-5 flex items-center justify-center rounded-full border-2 border-dashed border-gray-300 group-hover:border-blue-400 transition-colors">
                        <Plus className="w-3 h-3" />
                      </span>
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity">Add step</span>
                    </button>
                    {index < steps.length - 1 && <div className="w-px h-4 bg-gray-300 dark:bg-gray-600" />}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right panel: step config */}
        {selectedStep && (
          <div className="w-80 flex-shrink-0 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-y-auto p-5">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Step Config</h3>
              <button onClick={() => setSelectedStepId(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Step type */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Step Type</label>
                <select
                  value={selectedStep.type}
                  onChange={(e) => updateStep(selectedStep.id, { type: e.target.value as StepType })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-white dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
                >
                  {STEP_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                  ))}
                </select>
              </div>

              {/* Custom name */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Step Name</label>
                <input
                  type="text"
                  value={selectedStep.name}
                  onChange={(e) => updateStep(selectedStep.id, { name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-white dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
                />
              </div>

              {/* Wait days */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  {selectedStep.type === 'wait' ? 'Wait Days' : 'Wait Days Before This Step'}
                </label>
                <input
                  type="number"
                  min={0}
                  max={365}
                  value={selectedStep.waitDays}
                  onChange={(e) => updateStep(selectedStep.id, { waitDays: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-white dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
                />
              </div>

              {/* Message (for chat_message and connection_request) */}
              {(selectedStep.type === 'chat_message' || selectedStep.type === 'connection_request') && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                    Message
                    <span className="text-gray-400 font-normal ml-1">(use {'{{firstName}}'} for personalization)</span>
                  </label>
                  <textarea
                    rows={6}
                    value={selectedStep.message}
                    onChange={(e) => updateStep(selectedStep.id, { message: e.target.value })}
                    placeholder={
                      selectedStep.type === 'connection_request'
                        ? "Hi {{firstName}}, I'd love to connect…"
                        : "Hi {{firstName}}, following up on…"
                    }
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent resize-none bg-white dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
                  />
                </div>
              )}

              {/* WhatsApp message */}
              {isWhatsApp(selectedStep.type) && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                    Message
                    <span className="text-gray-400 font-normal ml-1">(use {'{{firstName}}'} for personalization)</span>
                  </label>
                  <textarea
                    rows={6}
                    value={selectedStep.message}
                    onChange={(e) => updateStep(selectedStep.id, { message: e.target.value })}
                    placeholder="Hi {{firstName}}, I came across your profile and wanted to reach out…"
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent resize-none bg-white dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
                  />
                  <p className="text-xs text-gray-400 mt-1.5">
                    A task will be created in your Tasks page when this step runs. The lead must have a phone number.
                  </p>
                </div>
              )}

              {/* Email-only fields */}
              {selectedStep.type === 'email' && (
                <>
                  {/* A/B toggle */}
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">A/B Test</label>
                    <button
                      type="button"
                      onClick={() => {
                        const enabling = !selectedStep.abEnabled
                        if (enabling && !selectedStep.variants) {
                          updateStep(selectedStep.id, {
                            abEnabled: true,
                            variants: [
                              { id: 'a', label: 'A', subject: selectedStep.subject ?? '', message: selectedStep.message ?? '', weight: 50 },
                              { id: 'b', label: 'B', subject: selectedStep.subject ?? '', message: selectedStep.message ?? '', weight: 50 },
                            ],
                          })
                          setAbTab('a')
                        } else {
                          updateStep(selectedStep.id, { abEnabled: enabling })
                        }
                      }}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${selectedStep.abEnabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${selectedStep.abEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                  </div>

                  {selectedStep.abEnabled && Array.isArray(selectedStep.variants) ? (
                    <>
                      {/* Variant tab switcher */}
                      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                        {selectedStep.variants.map((v) => (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => setAbTab(v.id as 'a' | 'b')}
                            className={`flex-1 px-3 py-1 rounded-md text-xs font-semibold transition-colors ${abTab === v.id ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
                          >
                            Variant {v.label}
                          </button>
                        ))}
                      </div>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500 -mt-1">50% of leads receive this variant</p>
                      {selectedStep.variants.filter((v) => v.id === abTab).map((variant) => (
                        <div key={variant.id} className="space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Subject</label>
                            <input
                              type="text"
                              value={variant.subject}
                              onChange={(e) => {
                                const updated = selectedStep.variants!.map((v) => v.id === variant.id ? { ...v, subject: e.target.value } : v)
                                updateStep(selectedStep.id, { variants: updated })
                              }}
                              placeholder="Quick question, {{firstName}}"
                              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                              Body
                              <span className="text-gray-400 font-normal ml-1">(use {'{{firstName}}'}, {'{{company}}'}, etc.)</span>
                            </label>
                            <textarea
                              rows={7}
                              value={variant.message}
                              onChange={(e) => {
                                const updated = selectedStep.variants!.map((v) => v.id === variant.id ? { ...v, message: e.target.value } : v)
                                updateStep(selectedStep.id, { variants: updated })
                              }}
                              placeholder={"Hi {{firstName}},\n\nNoticed {{company}} is…\n\n— {{name}}"}
                              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none bg-white dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
                            />
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Subject</label>
                        <input
                          type="text"
                          value={selectedStep.subject ?? ''}
                          onChange={(e) => updateStep(selectedStep.id, { subject: e.target.value })}
                          placeholder="Quick question, {{firstName}}"
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-white dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                          Body
                          <span className="text-gray-400 font-normal ml-1">(use {'{{firstName}}'}, {'{{company}}'}, etc.)</span>
                        </label>
                        <textarea
                          rows={8}
                          value={selectedStep.message}
                          onChange={(e) => updateStep(selectedStep.id, { message: e.target.value })}
                          placeholder={"Hi {{firstName}},\n\nNoticed {{company}} is…\n\nWould love to chat — does next Tuesday work?\n\n— {{name}}"}
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent resize-none bg-white dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Sender</label>
                    <select
                      value={selectedStep.emailAccountId ?? ''}
                      onChange={(e) =>
                        updateStep(selectedStep.id, { emailAccountId: e.target.value || null })
                      }
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-white dark:bg-gray-800 dark:text-white"
                    >
                      <option value="">Use campaign sender pool</option>
                      {emailAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} &lt;{a.email}&gt;{a.isDefault ? ' (default)' : ''}
                        </option>
                      ))}
                    </select>
                    {emailAccounts.length === 0 && (
                      <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
                        No email account configured. Add one in <a href="/settings" className="underline">Settings</a>.
                      </p>
                    )}
                  </div>
                  <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                    <input
                      type="checkbox"
                      checked={selectedStep.markAsManual ?? false}
                      onChange={(e) => updateStep(selectedStep.id, { markAsManual: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    Create a task instead of auto-sending
                  </label>
                </>
              )}
            </div>

            {saveError && (
              <p className="mt-3 text-xs text-red-600 dark:text-red-400">{saveError}</p>
            )}

            <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-800">
              <button
                onClick={save}
                disabled={saving}
                className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving…' : 'Save Sequence'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
