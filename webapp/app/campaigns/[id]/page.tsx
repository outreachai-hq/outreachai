'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Settings, MoreHorizontal, Check, Plus, Pencil,
  Search, Phone, ChevronDown, Info, Rocket, Pause, Play,
  AlertCircle, Trash2, Upload, X, ZoomIn, ZoomOut, Maximize2,
  GripVertical, Loader2, Save,
} from 'lucide-react'

// ─── Icons ────────────────────────────────────────────────────────────────────

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  )
}

// Small LinkedIn badge: blue rounded square with "in" text
function LinkedInBadge() {
  return (
    <span
      className="inline-flex items-center justify-center rounded text-white font-bold"
      style={{ backgroundColor: '#0A66C2', width: 16, height: 16, fontSize: 9 }}
    >
      in
    </span>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface SequenceStep {
  id?: string
  type: 'email' | 'visit_profile' | 'connection_request' | 'wait' | 'chat_message' | 'wait_until_accepted' | string
  waitDays?: number
  message?: string
  subject?: string
  name?: string
  linkedinAccountId?: string
  emailAccountId?: string | null
  markAsManual?: boolean
}

interface EmailAccount {
  id: string
  name: string
  email: string
  isDefault: boolean
}

interface LinkedInAccount {
  id: string
  name: string
  email: string | null
  avatarColor: string
  isDefault: boolean
}

interface Lead {
  id: string
  firstName: string
  lastName: string | null
  email: string | null
  company: string | null
  linkedinUrl: string | null
  headline: string | null
  aiOpener: string | null
  status: string
}

interface CampaignLead {
  id: string
  currentStep: number
  status: string
  nextActionAt: string | null
  attempts?: number
  lastError?: string | null
  lastAttemptAt?: string | null
  lead: Lead
}

interface Campaign {
  id: string
  name: string
  status: string
  launchedAt: string | null
  createdAt: string
  emailAccountIds?: string[]
  dailyEmailLimit?: number
  scheduleId?: string | null
  sequence: {
    id: string
    name: string
    steps: SequenceStep[]
  }
  leadList: {
    id: string
    name: string
    leads: Lead[]
  }
  leads: CampaignLead[]
}

type Tab = 'sequence' | 'leadlist' | 'launch' | 'settings'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAvatarColor(name: string): string {
  const palette = [
    '#3B82F6', '#8B5CF6', '#10B981', '#F59E0B',
    '#EC4899', '#14B8A6', '#6366F1', '#EF4444', '#F97316',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return palette[Math.abs(hash) % palette.length]
}

function LeadAvatar({ name, size = 8 }: { name: string; size?: number }) {
  const initials = name.split(' ').map((p) => p[0] ?? '').join('').toUpperCase().slice(0, 2)
  const color = getAvatarColor(name)
  return (
    <div
      className={`w-${size} h-${size} rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold`}
      style={{ backgroundColor: color, fontSize: size <= 7 ? '0.65rem' : '0.75rem' }}
    >
      {initials}
    </div>
  )
}

const STEP_META: Record<string, { emoji: string; label: string; description: string; limit?: string; isWait?: boolean; isEmail?: boolean }> = {
  email:                { emoji: '✉️', label: 'Email',                description: 'Send automatic email',      isEmail: true },
  visit_profile:        { emoji: '👁️', label: 'Visit profile',         description: 'Soft warming touch',        limit: 'This action is limited to 30 per day and follows your daily limit.' },
  connection_request:   { emoji: '👤', label: 'Invitation',            description: 'Send a connection request', limit: undefined },
  chat_message:         { emoji: '💬', label: 'Chat message',          description: 'Message a connection',      limit: 'Chat messages and voice notes: 0/30 in the last 24 hours' },
  wait:                 { emoji: '⏰', label: 'Wait',                  description: 'Pause between steps',       isWait: true },
  wait_until_accepted:  { emoji: '✅', label: 'Wait until',            description: 'Accepted invite',           isWait: true },
}

const LEAD_STATUS_STYLE: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  pending:     { bg: 'bg-gray-100 dark:bg-gray-500/20',    text: 'text-gray-600 dark:text-gray-400',    dot: 'bg-gray-400',   label: 'Pending' },
  in_progress: { bg: 'bg-blue-50 dark:bg-blue-900',     text: 'text-blue-700 dark:text-blue-400',    dot: 'bg-blue-500',   label: 'In progress' },
  replied:     { bg: 'bg-green-50 dark:bg-green-900',   text: 'text-green-700 dark:text-green-400',  dot: 'bg-green-500',  label: 'Replied' },
  completed:   { bg: 'bg-purple-50 dark:bg-purple-900', text: 'text-purple-700 dark:text-purple-400',dot: 'bg-purple-500', label: 'Completed' },
  bounced:     { bg: 'bg-red-50 dark:bg-red-900',       text: 'text-red-600 dark:text-red-400',      dot: 'bg-red-500',    label: 'Bounced' },
  failed:      { bg: 'bg-amber-50 dark:bg-amber-900/60',   text: 'text-amber-700 dark:text-amber-400',  dot: 'bg-amber-500',  label: 'Failed' },
}

function waitLabel(days?: number) {
  if (!days) return 'Send immediately'
  return `Wait for ${days} ${days !== 1 ? 'days' : 'day'}`
}

// ─── Sequence Tab ─────────────────────────────────────────────────────────────

function SequenceTab({
  campaign,
  onSaved,
}: {
  campaign: Campaign
  onSaved: () => void
}) {
  const [steps, setSteps] = useState<SequenceStep[]>(() =>
    Array.isArray(campaign.sequence?.steps) ? (campaign.sequence.steps as SequenceStep[]) : []
  )
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [linkedinAccounts, setLinkedinAccounts] = useState<LinkedInAccount[]>([])
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([])
  const [stepStats, setStepStats] = useState<Array<{ stepIndex: number; sent: number; atStep: number; passedStep: number; totalLeads: number; opened: number; clicked: number }>>([])
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  useEffect(() => {
    fetch(`/api/campaigns/${campaign.id}/step-stats`)
      .then((r) => (r.ok ? r.json() : { stats: [] }))
      .then((d) => setStepStats(d.stats ?? []))
      .catch(() => {})
  }, [campaign.id])

  useEffect(() => {
    // Ensure user has at least one LinkedIn account (auto-create if not)
    fetch('/api/linkedin-accounts/ensure', { method: 'POST' }).catch(() => {})
    fetch('/api/linkedin-accounts')
      .then((r) => r.json())
      .then((d) => { if (d.accounts) setLinkedinAccounts(d.accounts) })
      .catch(() => {})
    fetch('/api/email-accounts')
      .then((r) => (r.ok ? r.json() : { accounts: [] }))
      .then((d) => setEmailAccounts(d.accounts ?? []))
      .catch(() => {})
  }, [])

  const selectedStep = selectedIdx !== null ? steps[selectedIdx] : null

  function updateStep(idx: number, patch: Partial<SequenceStep>) {
    setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)))
    setDirty(true)
  }

  function addStep(afterIdx: number) {
    const newStep: SequenceStep = { type: 'chat_message', waitDays: 1, message: '' }
    setSteps((prev) => {
      const next = [...prev]
      next.splice(afterIdx + 1, 0, newStep)
      return next
    })
    setSelectedIdx(afterIdx + 1)
    setDirty(true)
  }

  function removeStep(idx: number) {
    setSteps((prev) => prev.filter((_, i) => i !== idx))
    setSelectedIdx(null)
    setDirty(true)
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    // Ensure each step has an id (the Zod validator allows missing ids but
    // newer features in Plan 6 onward expect them). Generate stable ones now.
    const stamped = steps.map((s, i) => ({ ...s, id: s.id ?? `step_${Date.now()}_${i}` }))
    // Strip empty optional fields off non-matching types
    const clean = stamped.map((s) => {
      const c: SequenceStep = { id: s.id, type: s.type, waitDays: s.waitDays }
      if (s.name) c.name = s.name
      if (s.type === 'email') {
        c.subject = s.subject ?? ''
        c.message = s.message ?? ''
        if (s.emailAccountId) c.emailAccountId = s.emailAccountId
        if (s.markAsManual)   c.markAsManual = true
      } else if (s.type === 'chat_message' || s.type === 'connection_request') {
        c.message = s.message ?? ''
        if (s.linkedinAccountId) c.linkedinAccountId = s.linkedinAccountId
      } else if (s.type === 'visit_profile') {
        if (s.linkedinAccountId) c.linkedinAccountId = s.linkedinAccountId
      }
      return c
    })
    const res = await fetch(`/api/sequences/${campaign.sequence.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ steps: clean }),
    })
    setSaving(false)
    if (res.ok) {
      setDirty(false)
      onSaved()
    } else {
      const j = await res.json().catch(() => ({}))
      setSaveError(j.error ?? 'Save failed')
    }
  }

  return (
    <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
      {/* Canvas */}
      <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 relative">
        {/* Zoom controls — top-right */}
        <div className="absolute top-4 right-4 flex items-center gap-0 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 shadow-sm z-10">
          <button className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-l-lg border-r border-gray-200 dark:border-gray-700 transition-colors" title="Zoom out">
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-colors" title="Zoom in">
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-r-lg transition-colors" title="Fit">
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="max-w-md mx-auto py-8 px-4">
          {/* Sequence start box */}
          <div className="flex flex-col items-center mb-2">
            <div className="flex items-center justify-between w-full bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5">
              <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">Sequence start</span>
              <button className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 p-0.5 rounded">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>
            <div className="w-px h-5 bg-gray-300 dark:bg-gray-600 mt-0" />
          </div>

          {steps.map((step, idx) => {
            const meta = STEP_META[step.type] ?? { emoji: '📋', label: step.type, description: '' }
            const isSelected = selectedIdx === idx
            const timingText = idx === 0 ? 'Send immediately' : waitLabel(step.waitDays)
            const waitDays = idx === 0 ? null : (step.waitDays ?? 1)

            return (
              <div
                key={idx}
                className={`flex items-start gap-2 w-full transition-opacity ${dragIdx === idx ? 'opacity-40' : 'opacity-100'} ${dragOverIdx === idx && dragIdx !== idx ? 'border-t-2 border-blue-500' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragOverIdx(idx) }}
                onDrop={(e) => {
                  e.preventDefault()
                  if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setDragOverIdx(null); return }
                  setSteps((prev) => {
                    const next = [...prev]
                    const [moved] = next.splice(dragIdx, 1)
                    next.splice(idx, 0, moved)
                    return next
                  })
                  setSelectedIdx(null)
                  setDirty(true)
                  setDragIdx(null)
                  setDragOverIdx(null)
                }}
              >
                {/* Drag handle */}
                <div
                  className="flex-shrink-0 w-5 mt-1 flex flex-col items-center opacity-0 hover:opacity-100 cursor-grab pt-1 select-none"
                  draggable
                  onDragStart={(e) => { e.stopPropagation(); setDragIdx(idx) }}
                  onDragEnd={() => { setDragIdx(null); setDragOverIdx(null) }}
                >
                  <span className="text-gray-300 dark:text-gray-600 text-base leading-none">⠿</span>
                </div>

                <div className="flex flex-col items-center flex-1 min-w-0">
                  {/* TWO-BOX step card */}
                  <div
                    className={`w-full cursor-pointer rounded-lg transition-all ${
                      isSelected ? 'ring-2 ring-blue-500 ring-offset-0' : ''
                    }`}
                    onClick={() => setSelectedIdx(isSelected ? null : idx)}
                  >
                    {/* Box 1 — Timing header */}
                    <div className="flex items-center justify-between bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-t-lg px-3 py-2">
                      <div className="flex items-center gap-1.5 text-sm font-medium" style={{ color: '#374151' }}>
                        <span>⏰</span>
                        {step.type === 'wait_until_accepted' ? (
                          <span>Wait until <strong style={{ color: '#2563EB' }}>accepted invite</strong></span>
                        ) : idx === 0 || !waitDays ? (
                          <span>Send immediately</span>
                        ) : (
                          <span>
                            Wait for{' '}
                            <strong style={{ color: '#2563EB' }}>{waitDays}</strong>{' '}
                            {waitDays !== 1 ? 'days' : 'day'}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedIdx(idx) }}
                        className="p-0.5 text-gray-400 dark:text-gray-500 hover:text-blue-600 rounded transition-colors"
                        title="Edit timing"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Box 2 — Step body (only for non-wait steps) */}
                    {step.type !== 'wait' && step.type !== 'wait_until_accepted' && (
                      <div className="bg-white dark:bg-gray-800 border-x border-b border-gray-200 dark:border-gray-700 rounded-b-lg shadow-sm">
                        <div className="flex items-center justify-between px-3 py-2.5">
                          <div className="flex items-center gap-3">
                            {/* Step icon: 36px circle with emoji + channel badge */}
                            <div className="relative flex-shrink-0">
                              <div
                                className="flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600"
                                style={{ width: 36, height: 36, fontSize: 17 }}
                              >
                                {meta.emoji}
                              </div>
                              {step.type !== 'email' && (
                                <span className="absolute -bottom-0.5 -left-0.5">
                                  <LinkedInBadge />
                                </span>
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">{meta.label}</p>
                              <p className="text-xs text-gray-400 dark:text-gray-500">{meta.description}</p>
                            </div>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedIdx(idx) }}
                            className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors"
                            title="More"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </div>
                        {/* Per-step stats mini bar */}
                        {stepStats[idx] && (stepStats[idx].sent > 0 || stepStats[idx].atStep > 0 || stepStats[idx].passedStep > 0) && (
                          <div className="flex items-center gap-3 px-3 pb-2.5 pt-0 border-t border-gray-50 dark:border-gray-700/50">
                            {stepStats[idx].sent > 0 && (
                              <span className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                <span className="text-gray-300">✉</span> {stepStats[idx].sent} sent
                              </span>
                            )}
                            {stepStats[idx].atStep > 0 && (
                              <span className="text-[11px] text-blue-500 flex items-center gap-1">
                                <span>●</span> {stepStats[idx].atStep} here
                              </span>
                            )}
                            {stepStats[idx].passedStep > 0 && (
                              <span className="text-[11px] text-gray-400 flex items-center gap-1">
                                <span>✓</span> {stepStats[idx].passedStep} passed
                              </span>
                            )}
                            {stepStats[idx]?.opened > 0 && (
                              <span className="text-[11px] text-emerald-500 flex items-center gap-1">
                                <span>👁</span> {stepStats[idx].opened} opened
                              </span>
                            )}
                            {stepStats[idx]?.clicked > 0 && (
                              <span className="text-[11px] text-blue-500 flex items-center gap-1">
                                <span>🔗</span> {stepStats[idx].clicked} clicked
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* "+" button between steps */}
                  <div className="flex flex-col items-center my-0.5">
                    <div className="w-px h-4 bg-gray-300 dark:bg-gray-600" />
                    <button
                      onClick={(e) => { e.stopPropagation(); addStep(idx) }}
                      className="w-6 h-6 rounded-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-gray-700 flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-blue-600 transition-colors"
                      title="Add step"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <div className="w-px h-4 bg-gray-300 dark:bg-gray-600" />
                  </div>
                </div>
              </div>
            )
          })}

          {steps.length === 0 && (
            <div className="flex flex-col items-center">
              <button
                onClick={() => { setSteps([{ type: 'visit_profile', waitDays: 0 }]); setSelectedIdx(0); setDirty(true) }}
                className="w-full bg-white dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-400 rounded-xl py-8 text-sm text-gray-400 dark:text-gray-500 hover:text-blue-600 transition-colors"
              >
                <Plus className="w-5 h-5 mx-auto mb-2" />
                Add first step
              </button>
            </div>
          )}

          {/* Save button */}
          {dirty && (
            <div className="sticky bottom-0 pt-4">
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold py-3 rounded-xl transition-colors shadow-sm"
              >
                {saving ? 'Saving…' : 'Save sequence'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right editor panel */}
      {selectedStep && selectedIdx !== null && (
        <div className="w-full md:w-80 bg-white dark:bg-gray-900 border-t md:border-t-0 md:border-l border-gray-200 dark:border-gray-700 flex flex-col overflow-y-auto max-h-[50vh] md:max-h-none">
          {/* Panel header: step icon + name + desc + ··· */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              {/* 48px step icon */}
              <div className="relative flex-shrink-0">
                <div
                  className="flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600"
                  style={{ width: 48, height: 48, fontSize: 22 }}
                >
                  {(STEP_META[selectedStep.type] ?? { emoji: '📋' }).emoji}
                </div>
                {selectedStep.type !== 'email' && (
                  <span className="absolute -bottom-0.5 -left-0.5">
                    <LinkedInBadge />
                  </span>
                )}
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-white">
                  {(STEP_META[selectedStep.type] ?? { label: selectedStep.type }).label}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {(STEP_META[selectedStep.type] ?? { description: '' }).description}
                </p>
              </div>
            </div>
            <button
              onClick={() => setSelectedIdx(null)}
              className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 space-y-5 flex-1">
            {/* Blue info box */}
            {selectedStep.type === 'visit_profile' && (
              <div className="flex items-start gap-2 px-3 py-2.5 bg-blue-50 border border-blue-100 rounded-lg">
                <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700 flex-1">
                  This action is limited to 30 per day and follows your daily limit.
                </p>
                <div className="flex items-center gap-1 flex-shrink-0 ml-1">
                  <button className="text-blue-400 hover:text-blue-600"><Pencil className="w-3 h-3" /></button>
                  <button className="text-blue-400 hover:text-blue-600"><X className="w-3 h-3" /></button>
                </div>
              </div>
            )}

            {/* Step type selector */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                Step type
              </label>
              <div className="space-y-2">
                {Object.entries(STEP_META).map(([type, meta]) => (
                  <button
                    key={type}
                    onClick={() => updateStep(selectedIdx, { type: type as SequenceStep['type'] })}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors ${
                      selectedStep.type === type
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <span className="text-lg">{meta.emoji}</span>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{meta.label}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">{meta.description}</p>
                    </div>
                    {selectedStep.type === type && (
                      <Check className="w-4 h-4 text-blue-600 ml-auto flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Wait days */}
            {selectedIdx > 0 && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                  Wait (days)
                </label>
                <input
                  type="number"
                  min={0}
                  value={selectedStep.waitDays ?? 1}
                  onChange={(e) => updateStep(selectedIdx, { waitDays: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 dark:placeholder-gray-500"
                />
              </div>
            )}

            {/* Message */}
            {(selectedStep.type === 'chat_message' || selectedStep.type === 'connection_request') && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                  Message
                </label>
                <textarea
                  rows={6}
                  value={selectedStep.message ?? ''}
                  onChange={(e) => updateStep(selectedIdx, { message: e.target.value })}
                  placeholder="Use {{firstName}}, {{company}} for personalization"
                  className="w-full px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none"
                />
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Variables: {'{'}{'{'} firstName {'}'}{'}'}, {'{'}{'{'} company {'}'}{'}'}
                </p>
              </div>
            )}

            {/* Email-only fields */}
            {selectedStep.type === 'email' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Subject</label>
                  <input
                    type="text"
                    value={selectedStep.subject ?? ''}
                    onChange={(e) => updateStep(selectedIdx, { subject: e.target.value })}
                    placeholder="Quick question, {{firstName}}"
                    className="w-full px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Body</label>
                  <textarea
                    rows={8}
                    value={selectedStep.message ?? ''}
                    onChange={(e) => updateStep(selectedIdx, { message: e.target.value })}
                    placeholder={"Hi {{firstName}},\n\nNoticed {{company}} is…\n\n— {{name}}"}
                    className="w-full px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none"
                  />
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Variables: {'{'}{'{'} firstName {'}'}{'}'}, {'{'}{'{'} lastName {'}'}{'}'}, {'{'}{'{'} company {'}'}{'}'}
                  </p>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Sender</label>
                  </div>
                  {emailAccounts.length === 0 ? (
                    <div className="flex items-center gap-2 px-3 py-2.5 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800">
                      <span className="text-sm text-gray-400 dark:text-gray-500">No email account connected</span>
                      <a href="/settings" className="text-xs text-blue-600 hover:underline ml-auto">Connect →</a>
                    </div>
                  ) : (
                    <select
                      value={selectedStep.emailAccountId ?? ''}
                      onChange={(e) => updateStep(selectedIdx, { emailAccountId: e.target.value || null })}
                      className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      <option value="">Use campaign sender pool</option>
                      {emailAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} &lt;{a.email}&gt;{a.isDefault ? ' (default)' : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <input
                    type="checkbox"
                    checked={selectedStep.markAsManual ?? false}
                    onChange={(e) => updateStep(selectedIdx, { markAsManual: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  Create a task instead of auto-sending
                </label>
              </>
            )}

            {/* LinkedIn account — only for LinkedIn-typed steps */}
            {(selectedStep.type === 'visit_profile' || selectedStep.type === 'connection_request' || selectedStep.type === 'chat_message') && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  LinkedIn account used to visit profile <span className="text-red-500">*</span>
                </label>
                <button className="text-xs text-blue-600 hover:underline">Advanced settings</button>
              </div>
              {linkedinAccounts.length === 0 ? (
                <div className="flex items-center gap-2 px-3 py-2.5 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800">
                  <span className="text-sm text-gray-400 dark:text-gray-500">No LinkedIn account connected</span>
                  <a href="/settings" className="text-xs text-blue-600 hover:underline ml-auto">Connect →</a>
                </div>
              ) : (
                <select
                  value={selectedStep.linkedinAccountId ?? linkedinAccounts.find(a => a.isDefault)?.id ?? linkedinAccounts[0]?.id}
                  onChange={(e) => updateStep(selectedIdx, { linkedinAccountId: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  {linkedinAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}{acc.isDefault ? ' (default)' : ''}
                    </option>
                  ))}
                </select>
              )}
              {/* Show avatar of selected account */}
              {linkedinAccounts.length > 0 && (() => {
                const selId = selectedStep.linkedinAccountId ?? linkedinAccounts.find(a => a.isDefault)?.id
                const acc = linkedinAccounts.find(a => a.id === selId) ?? linkedinAccounts[0]
                const initials = acc.name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
                return (
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0" style={{ backgroundColor: acc.avatarColor }}>
                      {initials}
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{acc.email ?? acc.name}</span>
                  </div>
                )
              })()}
            </div>
            )}

            {saveError && (
              <p className="text-xs text-red-600 dark:text-red-400">{saveError}</p>
            )}

            <button
              onClick={() => removeStep(selectedIdx)}
              className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700 font-medium"
            >
              <Trash2 className="w-4 h-4" />
              Remove step
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Lead List Tab ────────────────────────────────────────────────────────────

function LeadListTab({ campaign, onRefresh }: { campaign: Campaign; onRefresh: () => void }) {
  const [search, setSearch] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [showManual, setShowManual] = useState(false)
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [manualForm, setManualForm] = useState({ firstName: '', lastName: '', email: '', company: '', linkedinUrl: '' })
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const addMenuRef = useRef<HTMLDivElement>(null)
  const [enriching, setEnriching] = useState(false)
  const [enrichResult, setEnrichResult] = useState<{ enriched: number; total: number } | null>(null)
  const [enrichingLeadId, setEnrichingLeadId] = useState<string | null>(null)

  async function enrichLeads() {
    setEnriching(true)
    setEnrichResult(null)
    const res = await fetch(`/api/lead-lists/${campaign.leadList.id}/enrich`, { method: 'POST' })
    const data = await res.json()
    setEnriching(false)
    if (res.ok) { setEnrichResult(data); onRefresh() }
  }

  async function findPhone(leadId: string) {
    setEnrichingLeadId(leadId)
    await fetch(`/api/leads/${leadId}/enrich`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'apollo' }),
    })
    setEnrichingLeadId(null)
    onRefresh()
  }

  const leads: Lead[] = Array.isArray(campaign.leadList?.leads) ? campaign.leadList.leads : []

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setShowAddMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filtered = leads.filter((l) => {
    if (!search) return true
    const q = search.toLowerCase()
    const name = `${l.firstName} ${l.lastName ?? ''}`.toLowerCase()
    return (
      name.includes(q) ||
      (l.email ?? '').toLowerCase().includes(q) ||
      (l.company ?? '').toLowerCase().includes(q)
    )
  })

  async function handleCsvImport() {
    if (!csvFile) return
    setImporting(true)
    const text = await csvFile.text()
    const lines = text.split('\n').filter(Boolean)
    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/"/g, ''))
    const rows = lines.slice(1)

    const mappedRows = []
    for (const row of rows) {
      const cols = row.split(',').map((c) => c.trim().replace(/"/g, ''))
      const obj: Record<string, string> = {}
      headers.forEach((h, i) => { obj[h] = cols[i] ?? '' })
      const firstName = obj['firstname'] || obj['first_name'] || obj['first name'] || obj['name']?.split(' ')[0] || ''
      if (!firstName) continue
      
      mappedRows.push({
        firstName,
        lastName: obj['lastname'] || obj['last_name'] || obj['last name'] || obj['name']?.split(' ').slice(1).join(' ') || '',
        email: obj['email'] || '',
        company: obj['company'] || obj['organization'] || '',
        linkedinUrl: obj['linkedin'] || obj['linkedinurl'] || obj['linkedin_url'] || '',
      })
    }

    if (mappedRows.length > 0) {
      await fetch(`/api/lead-lists/${campaign.leadList.id}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mappedRows),
      })
    }

    setImporting(false)
    setCsvFile(null)
    setShowImport(false)
    onRefresh()
  }

  async function handleManualAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!manualForm.firstName) return
    setSaving(true)
    await fetch(`/api/lead-lists/${campaign.leadList.id}/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(manualForm),
    })
    setSaving(false)
    setManualForm({ firstName: '', lastName: '', email: '', company: '', linkedinUrl: '' })
    setShowManual(false)
    onRefresh()
  }

  return (
    <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-900 z-10">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 bg-gray-50 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500 w-48"
          />
        </div>
        <button className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          Filters
        </button>

        <div className="flex-1" />

        {/* Create AI Columns */}
        <button className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-gray-200 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          Create AI Columns
          <ChevronDown className="w-3.5 h-3.5" />
        </button>

        {/* Add leads dropdown */}
        <div className="relative" ref={addMenuRef}>
          <button
            onClick={() => setShowAddMenu((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-gray-200 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Add leads
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          {showAddMenu && (
            <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg w-48 z-20">
              <button
                onClick={() => { setShowImport(true); setShowManual(false); setShowAddMenu(false) }}
                className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors rounded-t-xl"
              >
                <Upload className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                CSV import
              </button>
              <button
                onClick={() => { setShowManual(true); setShowImport(false); setShowAddMenu(false) }}
                className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors rounded-b-xl"
              >
                <Plus className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                Manual add
              </button>
            </div>
          )}
        </div>

        {/* Enrich leads */}
        <button
          onClick={enrichLeads}
          disabled={enriching}
          title="Generate AI openers for all leads without one"
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg transition-colors"
        >
          {enriching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>✦</span>}
          {enriching ? 'Enriching…' : enrichResult ? `✓ ${enrichResult.enriched} enriched` : 'Enrich leads'}
        </button>
      </div>

      {/* CSV import panel */}
      {showImport && (
        <div className="mx-6 mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-blue-800">Import from CSV</p>
            <button onClick={() => setShowImport(false)} className="text-blue-400 hover:text-blue-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-blue-700 mb-3">
            Expected columns: firstName, lastName, email, company, linkedinUrl
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-gray-600 dark:text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200"
          />
          {csvFile && (
            <div className="flex items-center gap-3 mt-3">
              <span className="text-xs text-gray-600 dark:text-gray-400">{csvFile.name}</span>
              <button
                onClick={handleCsvImport}
                disabled={importing}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition-colors"
              >
                {importing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {importing ? 'Importing…' : 'Import'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Manual add panel */}
      {showManual && (
        <div className="mx-6 mt-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Add lead manually</p>
            <button onClick={() => setShowManual(false)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={handleManualAdd} className="grid grid-cols-2 gap-3">
            <input
              required
              placeholder="First name *"
              value={manualForm.firstName}
              onChange={(e) => setManualForm((p) => ({ ...p, firstName: e.target.value }))}
              className="col-span-1 px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            <input
              placeholder="Last name"
              value={manualForm.lastName}
              onChange={(e) => setManualForm((p) => ({ ...p, lastName: e.target.value }))}
              className="col-span-1 px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            <input
              type="email"
              placeholder="Email"
              value={manualForm.email}
              onChange={(e) => setManualForm((p) => ({ ...p, email: e.target.value }))}
              className="col-span-1 px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            <input
              placeholder="Company"
              value={manualForm.company}
              onChange={(e) => setManualForm((p) => ({ ...p, company: e.target.value }))}
              className="col-span-1 px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            <input
              placeholder="LinkedIn URL"
              value={manualForm.linkedinUrl}
              onChange={(e) => setManualForm((p) => ({ ...p, linkedinUrl: e.target.value }))}
              className="col-span-2 px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            <div className="col-span-2 flex justify-end gap-2">
              <button type="button" onClick={() => setShowManual(false)} className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="px-3 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50">
                {saving ? 'Adding…' : 'Add lead'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mb-4 text-2xl font-bold text-white mb-5"
            style={{ backgroundColor: '#3B82F6' }}
          >
            ?
          </div>
          <p className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-1">You don&apos;t have any leads</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-5">Import leads to start your outreach</p>
          <button
            onClick={() => setShowImport(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Import new leads
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800">
                <th className="px-4 py-3 w-8">
                  <input type="checkbox" className="rounded border-gray-300 dark:border-gray-600" />
                </th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide" />
                <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">First name</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Last name</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Email</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Company</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">LinkedIn</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Status</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Phone</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {filtered.map((lead) => {
                const fullName = `${lead.firstName} ${lead.lastName ?? ''}`.trim()
                const statusStyle = LEAD_STATUS_STYLE[lead.status] ?? LEAD_STATUS_STYLE.pending
                return (
                  <tr key={lead.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <td className="px-4 py-3">
                      <input type="checkbox" className="rounded border-gray-300 dark:border-gray-600" />
                    </td>
                    <td className="px-3 py-3">
                      <LeadAvatar name={fullName} size={8} />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-gray-900 dark:text-white whitespace-nowrap">{lead.firstName}</span>
                        {lead.linkedinUrl && <LinkedInBadge />}
                      </div>
                      {lead.email && (
                        <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                          <span>✉</span>
                          <span className="truncate max-w-[160px]">{lead.email}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 mt-1">
                        <button
                          onClick={() => findPhone(lead.id)}
                          disabled={enrichingLeadId === lead.id}
                          className="text-xs text-blue-600 border border-blue-300 rounded px-1.5 py-0.5 font-medium hover:bg-blue-50 disabled:opacity-50 transition-colors"
                        >
                          {enrichingLeadId === lead.id ? '…' : 'FIND PHONE'}
                        </button>
                        {!lead.email && (
                          <span className="text-xs text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-700 rounded px-1.5 py-0.5">
                            Not verified
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">{lead.lastName ?? '—'}</td>
                    <td className="px-3 py-3 text-gray-500 dark:text-gray-400 max-w-[180px] truncate">{lead.email ?? '—'}</td>
                    <td className="px-3 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{lead.company ?? '—'}</td>
                    <td className="px-3 py-3">
                      {lead.linkedinUrl ? (
                        <a href={lead.linkedinUrl} target="_blank" rel="noopener noreferrer">
                          <LinkedInBadge />
                        </a>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
                        {lead.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <button
                        onClick={() => findPhone(lead.id)}
                        disabled={enrichingLeadId === lead.id}
                        className="text-xs text-blue-600 border border-blue-300 rounded px-1.5 py-0.5 font-medium hover:bg-blue-50 disabled:opacity-50 transition-colors"
                      >
                        {enrichingLeadId === lead.id ? '…' : 'FIND PHONE'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="px-6 py-3 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-400 dark:text-gray-500">
            1 – {filtered.length} of {filtered.length}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Launch Tab ───────────────────────────────────────────────────────────────

// ─── Settings Tab ─────────────────────────────────────────────────────────────

function CampaignSettingsTab({
  campaign,
  onRefresh,
}: {
  campaign: Campaign
  onRefresh: () => void
}) {
  const [allAccounts, setAllAccounts] = useState<Array<EmailAccount & { dailyLimit?: number; warmupActive?: boolean }>>([])
  const [selected, setSelected] = useState<string[]>(campaign.emailAccountIds ?? [])
  const [dailyLimit, setDailyLimit] = useState(String(campaign.dailyEmailLimit ?? 50))
  const [schedules, setSchedules] = useState<Array<{ id: string; name: string; timezone: string }>>([])
  const [scheduleId, setScheduleId] = useState<string>(campaign.scheduleId ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/email-accounts')
      .then((r) => (r.ok ? r.json() : { accounts: [] }))
      .then((d) => setAllAccounts(d.accounts ?? []))
      .catch(() => {})
    fetch('/api/schedules')
      .then((r) => (r.ok ? r.json() : { schedules: [] }))
      .then((d) => setSchedules(d.schedules ?? []))
      .catch(() => {})
  }, [])

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function save() {
    setSaving(true)
    setErr(null)
    const res = await fetch(`/api/campaigns/${campaign.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emailAccountIds: selected,
        dailyEmailLimit: Number(dailyLimit) || 0,
        scheduleId: scheduleId || null,
      }),
    })
    setSaving(false)
    if (res.ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
      onRefresh()
    } else {
      const j = await res.json().catch(() => ({}))
      setErr(j.error ?? 'Save failed')
    }
  }

  const eligible = allAccounts.filter((a) => !a.warmupActive)
  const dirty =
    selected.join(',') !== (campaign.emailAccountIds ?? []).join(',') ||
    Number(dailyLimit) !== (campaign.dailyEmailLimit ?? 50) ||
    scheduleId !== (campaign.scheduleId ?? '')

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
            Email senders for this campaign
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Each email step will be sent from one of the mailboxes below, chosen
            automatically to balance load and stay under per-mailbox daily limits.
            Leave empty to fall back to your default mailbox.
          </p>

          {eligible.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-gray-400 dark:text-gray-500 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
              No email accounts configured. <a href="/settings" className="text-blue-600 hover:underline">Connect one in Settings →</a>
            </div>
          ) : (
            <div className="space-y-2">
              {eligible.map((a) => (
                <label
                  key={a.id}
                  className={`flex items-center gap-3 px-3 py-2.5 border rounded-lg cursor-pointer transition-colors ${
                    selected.includes(a.id)
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(a.id)}
                    onChange={() => toggle(a.id)}
                    className="rounded border-gray-300"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {a.name} <span className="text-gray-400 font-normal">&lt;{a.email}&gt;</span>
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      Daily limit: {a.dailyLimit ?? 50}{a.isDefault ? ' · default mailbox' : ''}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
            Campaign daily email cap
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Total emails per day across all senders in this campaign. Set to 0 to disable the cap.
          </p>
          <input
            type="number"
            min={0}
            value={dailyLimit}
            onChange={(e) => setDailyLimit(e.target.value)}
            className="w-32 px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white dark:bg-gray-800 dark:text-white"
          />
        </section>

        {/* Plan 7 — Schedule picker. Backwards-compatible: empty means fall
            back to the legacy campaign.timezone + sendWindow inline pair. */}
        <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Send schedule</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Reuse a named send-window calendar across campaigns. Manage schedules in{' '}
            <a href="/settings" className="text-blue-600 hover:underline">Settings → Schedules</a>.
          </p>
          {schedules.length === 0 ? (
            <p className="text-xs text-gray-400 italic">
              No schedules defined yet — campaign keeps its legacy timezone + window. Create one in Settings.
            </p>
          ) : (
            <select
              value={scheduleId}
              onChange={(e) => setScheduleId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white dark:bg-gray-800 dark:text-white"
            >
              <option value="">— No schedule (use inline timezone+window) —</option>
              {schedules.map((s) => (
                <option key={s.id} value={s.id}>{s.name} · {s.timezone}</option>
              ))}
            </select>
          )}
        </section>

        {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}

        <button
          onClick={save}
          disabled={saving || !dirty}
          className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
            saved
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white'
          }`}
        >
          {saved ? <><Check className="w-4 h-4" />Saved</> : <><Save className="w-4 h-4" />{saving ? 'Saving…' : 'Save settings'}</>}
        </button>
      </div>
    </div>
  )
}

function LaunchTab({
  campaign,
  onRefresh,
}: {
  campaign: Campaign
  onRefresh: () => void
}) {
  const [activeSubTab, setActiveSubTab] = useState<'toLaunch' | 'launched'>('toLaunch')
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [enrichingLeadId, setEnrichingLeadId] = useState<string | null>(null)

  async function findPhone(leadId: string) {
    setEnrichingLeadId(leadId)
    await fetch(`/api/leads/${leadId}/enrich`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'apollo' }),
    })
    setEnrichingLeadId(null)
    onRefresh()
  }

  const steps: SequenceStep[] = Array.isArray(campaign.sequence?.steps)
    ? (campaign.sequence.steps as SequenceStep[])
    : []

  // Enrolled leads (CampaignLead records)
  const enrolledIds = new Set(campaign.leads.map((cl: any) => cl.lead.id))
  const launchedLeads = campaign.leads.filter((cl: any) => cl.status !== 'pending')

  // "To launch" = leads in the lead list NOT yet enrolled as CampaignLead
  const unenrolledLeads = (campaign.leadList?.leads ?? []).filter(
    (lead: any) => !enrolledIds.has(lead.id)
  )
  // Also include pending CampaignLeads (enrolled but not sent yet)
  const pendingCLs = campaign.leads.filter((cl: any) => cl.status === 'pending')
  const toLaunchCount = unenrolledLeads.length + pendingCLs.length

  // For display: show unenrolled leads as virtual CL objects in "To launch"
  const toLaunchLeads = [
    ...unenrolledLeads.map((lead: any) => ({
      id: `virtual_${lead.id}`,
      lead,
      status: 'pending',
      currentStep: 0,
      nextActionAt: null,
      attempts: 0,
      lastError: null,
      lastAttemptAt: null,
      virtual: true, // not yet a real CampaignLead
    })),
    ...pendingCLs,
  ]

  const displayedLeads = activeSubTab === 'toLaunch' ? toLaunchLeads : launchedLeads

  const filteredLeads = displayedLeads.filter((cl: any) => {
    if (!search) return true
    const q = search.toLowerCase()
    const fullName = `${cl.lead.firstName} ${cl.lead.lastName ?? ''}`.toLowerCase()
    return (
      fullName.includes(q) ||
      (cl.lead.email ?? '').toLowerCase().includes(q) ||
      (cl.lead.company ?? '').toLowerCase().includes(q)
    )
  })

  const selectedCL = [...campaign.leads, ...toLaunchLeads].find((cl: any) => cl.lead.id === selectedLeadId)

  async function launchCampaign() {
    setActionLoading(true)
    await fetch(`/api/campaigns/${campaign.id}/launch`, { method: 'POST' })
    onRefresh()
    setActionLoading(false)
  }

  async function toggleStatus() {
    setActionLoading(true)
    const newStatus = campaign.status === 'active' ? 'paused' : 'active'
    await fetch(`/api/campaigns/${campaign.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    onRefresh()
    setActionLoading(false)
  }

  return (
    <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
      {/* LEFT panel */}
      <div className="w-full lg:w-[40%] flex flex-col border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden lg:min-w-[320px] max-h-[50vh] lg:max-h-none">
        {/* Sub-tabs: "To launch N" | "Launched M" with blue underline for active */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 px-4 pt-3 gap-0">
          {(['toLaunch', 'launched'] as const).map((tab) => {
            const count = tab === 'toLaunch' ? toLaunchLeads.length : launchedLeads.length
            const label = tab === 'toLaunch' ? `To launch` : `Launched`
            return (
              <button
                key={tab}
                onClick={() => setActiveSubTab(tab)}
                className={`flex items-center gap-1.5 pb-2.5 px-3 text-sm font-medium border-b-2 transition-colors ${
                  activeSubTab === tab
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {label}{' '}
                <span className={`font-semibold ${activeSubTab === tab ? 'text-blue-700' : 'text-gray-500 dark:text-gray-400'}`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Info banner */}
        {campaign.status !== 'active' && (
          <div className="flex items-start gap-2 mx-4 mt-3 px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-lg">
            <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">
              No activities being sent right now. This time falls outside your defined schedule.
            </p>
          </div>
        )}

        {/* Lead list with checkbox + avatar + name + linkedin + ··· */}
        <div className="flex-1 overflow-y-auto">
          {/* "No leads selected" header row */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800">
            <input type="checkbox" className="rounded border-gray-300 dark:border-gray-600 flex-shrink-0" />
            <span className="text-2xl">🎓</span>
            <span className="text-sm text-gray-500 dark:text-gray-400">No leads selected</span>
          </div>

          {filteredLeads.length === 0 ? (
            <div className="py-12 text-center px-4">
              <p className="text-sm text-gray-400 dark:text-gray-500">
                {toLaunchCount === 0 && launchedLeads.length === 0 ? 'No leads added yet. Add leads in the Lead list tab.' : 'No leads in this view.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-800">
              {filteredLeads.map((cl) => {
                const fullName = `${cl.lead.firstName} ${cl.lead.lastName ?? ''}`.trim()
                const isSelected = selectedLeadId === cl.lead.id
                return (
                  <div
                    key={cl.id}
                    onClick={() => setSelectedLeadId(isSelected ? null : cl.lead.id)}
                    className={`px-4 py-3 cursor-pointer transition-colors ${
                      isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => setSelectedLeadId(isSelected ? null : cl.lead.id)}
                        className="rounded border-gray-300 dark:border-gray-600 flex-shrink-0"
                      />
                      <LeadAvatar name={fullName} size={8} />
                      <div className="flex-1 min-w-0">
                        {/* Name + LinkedIn badge */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{fullName}</span>
                          {cl.lead.linkedinUrl && <LinkedInBadge />}
                        </div>
                        {/* Email */}
                        {cl.lead.email && (
                          <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                            <span>✉</span>
                            <span className="truncate">{cl.lead.email}</span>
                          </div>
                        )}
                        {/* Chips */}
                        <div className="flex items-center gap-1.5 mt-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); findPhone(cl.lead.id) }}
                            disabled={enrichingLeadId === cl.lead.id}
                            className="text-xs text-blue-600 border border-blue-300 rounded px-1.5 py-0.5 font-medium hover:bg-blue-50 disabled:opacity-50 transition-colors"
                          >
                            {enrichingLeadId === cl.lead.id ? '…' : 'FIND PHONE'}
                          </button>
                          <span className="text-xs text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-700 rounded px-1.5 py-0.5">
                            Not verified
                          </span>
                          {/* CampaignLead status badge — only show for non-default states */}
                          {cl.status && cl.status !== 'pending' && LEAD_STATUS_STYLE[cl.status] && (
                            <span
                              className={`inline-flex items-center gap-1 text-xs ${LEAD_STATUS_STYLE[cl.status].bg} ${LEAD_STATUS_STYLE[cl.status].text} rounded px-1.5 py-0.5 font-medium`}
                              title={
                                (cl.status === 'bounced' || cl.status === 'failed') && cl.lastError
                                  ? `${LEAD_STATUS_STYLE[cl.status].label}${cl.attempts ? ` after ${cl.attempts} attempt${cl.attempts !== 1 ? 's' : ''}` : ''}: ${cl.lastError}`
                                  : LEAD_STATUS_STYLE[cl.status].label
                              }
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${LEAD_STATUS_STYLE[cl.status].dot}`} />
                              {LEAD_STATUS_STYLE[cl.status].label}
                              {(cl.status === 'bounced' || cl.status === 'failed') && cl.lastError && (
                                <span aria-hidden className="text-current">ⓘ</span>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 rounded flex-shrink-0"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Launch button — full width sticky */}
        <div className="border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
          {campaign.status === 'draft' ? (
            <div className="flex">
              <button
                onClick={launchCampaign}
                disabled={actionLoading || toLaunchCount === 0}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold py-3.5 transition-colors"
              >
                {actionLoading ? 'Launching…' : `🚀 Launch for ${toLaunchCount} lead${toLaunchCount !== 1 ? 's' : ''} →`}
              </button>
              <button className="bg-blue-700 hover:bg-blue-800 text-white px-3 border-l border-blue-500 transition-colors">
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          ) : campaign.status === 'active' ? (
            <button
              onClick={toggleStatus}
              disabled={actionLoading}
              className="w-full inline-flex items-center justify-center gap-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 text-sm font-semibold py-3 transition-colors"
            >
              <Pause className="w-4 h-4" />
              {actionLoading ? 'Pausing…' : 'Pause Campaign'}
            </button>
          ) : campaign.status === 'paused' ? (
            <button
              onClick={toggleStatus}
              disabled={actionLoading}
              className="w-full inline-flex items-center justify-center gap-2 bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 text-sm font-semibold py-3 transition-colors"
            >
              <Play className="w-4 h-4" />
              {actionLoading ? 'Resuming…' : 'Resume Campaign'}
            </button>
          ) : null}
        </div>
      </div>

      {/* RIGHT panel — message previews */}
      <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 p-6">
        {selectedCL ? (
          <div className="space-y-3 max-w-lg mx-auto">
            {/* Bounce / failure banner — only when the lead has actually hit one of those states */}
            {(selectedCL.status === 'bounced' || selectedCL.status === 'failed') && selectedCL.lastError && (
              <div
                className={`rounded-xl border p-4 text-sm ${
                  selectedCL.status === 'bounced'
                    ? 'bg-red-50 border-red-200 text-red-800'
                    : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}
              >
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">
                      {selectedCL.status === 'bounced' ? 'Bounced' : 'Failed'}
                      {selectedCL.attempts ? ` after ${selectedCL.attempts} attempt${selectedCL.attempts !== 1 ? 's' : ''}` : ''}
                    </p>
                    <p className="mt-1 text-xs opacity-90 break-words">{selectedCL.lastError}</p>
                    {selectedCL.lastAttemptAt && (
                      <p className="mt-1 text-xs opacity-70">
                        Last try: {new Date(selectedCL.lastAttemptAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
            {steps.map((step, idx) => {
              const meta = STEP_META[step.type] ?? { emoji: '📋', label: step.type, description: '' }
              const isCurrent = idx === selectedCL.currentStep

              // Wait step — show as a "Wait for N days" divider box
              if (step.type === 'wait' || step.type === 'wait_until_accepted') {
                return (
                  <div key={idx} className="flex items-center justify-center">
                    <div className="bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2 text-sm font-medium" style={{ color: '#374151' }}>
                      {step.type === 'wait_until_accepted' ? (
                        <>Wait until <strong style={{ color: '#2563EB' }}>accepted invite</strong></>
                      ) : (
                        <>Wait for{' '}
                        <strong style={{ color: '#2563EB' }}>{step.waitDays ?? 1}</strong>{' '}
                        day{(step.waitDays ?? 1) !== 1 ? 's' : ''}</>
                      )}
                    </div>
                  </div>
                )
              }

              return (
                <div
                  key={idx}
                  className={`bg-white dark:bg-gray-800 rounded-xl border p-4 transition-all ${
                    isCurrent ? 'border-blue-300 shadow-sm' : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  {/* Message block header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{meta.emoji}</span>
                      <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{meta.label}</span>
                      {isCurrent && (
                        <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium border border-blue-200">
                          Current
                        </span>
                      )}
                    </div>
                    {/* User avatar on right */}
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                      style={{ backgroundColor: '#EF4444' }}
                    >
                      MB
                    </div>
                  </div>

                  {/* Blue info box for chat_message */}
                  {step.type === 'chat_message' && (
                    <div className="flex items-start gap-2 mb-3 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg">
                      <Info className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-blue-700 flex-1">
                        Chat messages and voice notes: 0/30 in the last 24 hours
                      </p>
                      <div className="flex items-center gap-1 flex-shrink-0 ml-1">
                        <button className="text-blue-400 hover:text-blue-600"><Pencil className="w-3 h-3" /></button>
                        <button className="text-blue-400 hover:text-blue-600"><X className="w-3 h-3" /></button>
                      </div>
                    </div>
                  )}

                  {/* Message content */}
                  {step.message ? (
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed mb-3">
                      {step.message
                        .replace(/\{\{firstName\}\}/g, selectedCL.lead.firstName)
                        .replace(/\{\{company\}\}/g, selectedCL.lead.company ?? 'your company')}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 dark:text-gray-500 italic mb-3">
                      {meta.label} — no message template
                    </p>
                  )}

                  {/* Personalize button */}
                  <div className="flex justify-end">
                    <button className="inline-flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded px-2.5 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <Pencil className="w-3 h-3" />
                      Personalize
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center py-20">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
              <Search className="w-7 h-7 text-gray-300 dark:text-gray-500" />
            </div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Select a lead to preview</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Click any lead on the left to see their personalized sequence
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CampaignDetailPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('sequence')
  const [isActive, setIsActive] = useState(false)
  const [campaignName, setCampaignName] = useState('')
  const [editingName, setEditingName] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  const fetchCampaign = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/campaigns/${id}`)
    if (res.ok) {
      const data: Campaign = await res.json()
      setCampaign(data)
      setCampaignName(data.name)
      setIsActive(data.status === 'active')
    } else {
      router.replace('/campaigns')
    }
    setLoading(false)
  }, [id, router])

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login')
    if (status === 'authenticated') {
      const t = setTimeout(() => fetchCampaign(), 0)
      return () => clearTimeout(t)
    }
  }, [status, fetchCampaign, router])

  useEffect(() => {
    if (editingName) nameRef.current?.focus()
  }, [editingName])

  async function saveName() {
    if (!campaign || campaignName === campaign.name) { setEditingName(false); return }
    await fetch(`/api/campaigns/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: campaignName }),
    })
    setEditingName(false)
    fetchCampaign()
  }

  async function toggleActive() {
    if (!campaign) return
    const newStatus = campaign.status === 'active' ? 'paused' : 'active'
    setIsActive(newStatus === 'active')
    await fetch(`/api/campaigns/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    fetchCampaign()
  }

  if (status === 'loading' || loading) {
    return <div className="p-8 text-center text-gray-400 dark:text-gray-500 text-sm">Loading campaign…</div>
  }
  if (!campaign) return null

  const steps: SequenceStep[] = Array.isArray(campaign.sequence?.steps) ? (campaign.sequence.steps as SequenceStep[]) : []
  const leadCount = campaign.leadList?.leads?.length ?? 0

  const tabs: { key: Tab; label: string; num: number; done: boolean }[] = [
    { key: 'sequence', label: 'Sequence', num: 1, done: steps.length > 0 },
    { key: 'leadlist', label: 'Lead list', num: 2, done: leadCount > 0 },
    { key: 'launch',   label: 'Launch',    num: 3, done: campaign.status !== 'draft' },
    { key: 'settings', label: 'Settings',  num: 4, done: (campaign.emailAccountIds?.length ?? 0) > 0 },
  ]

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-gray-50 dark:bg-gray-900 overflow-hidden">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-2 px-3 md:px-5 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 min-w-0">
        {/* Back */}
        <Link
          href="/campaigns"
          className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>

        {/* Campaign name */}
        {editingName ? (
          <input
            ref={nameRef}
            type="text"
            value={campaignName}
            onChange={(e) => setCampaignName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => { if (e.key === 'Enter') saveName() }}
            className="text-base font-semibold text-gray-900 dark:text-white bg-white dark:bg-gray-800 border border-blue-300 dark:border-gray-700 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-600 min-w-[160px] dark:placeholder-gray-500"
          />
        ) : (
          <button
            onClick={() => setEditingName(true)}
            className="flex items-center gap-1.5 text-base font-semibold text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded px-2 py-1 transition-colors group"
          >
            {campaignName}
            <Pencil className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 group-hover:text-gray-500 dark:group-hover:text-gray-400 transition-colors" />
          </button>
        )}

        {/* Toggle */}
        <button
          onClick={toggleActive}
          title={isActive ? 'Click to pause' : 'Click to activate'}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${
            isActive ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow ${
              isActive ? 'translate-x-[18px]' : 'translate-x-[2px]'
            }`}
          />
        </button>
        <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">{isActive ? 'Active' : 'Inactive'}</span>

        {/* Icons */}
        <div className="flex items-center gap-1 ml-1">
          <button className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            <Settings className="w-4 h-4" />
          </button>
          <button className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1" />

        {/* Tab pills */}
        <div className="flex items-center gap-1 flex-shrink-0 overflow-x-auto no-scrollbar">
          {tabs.map((tab, idx) => (
            <div key={tab.key} className="flex items-center">
              <button
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <span
                  className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold flex-shrink-0 ${
                    tab.done && activeTab !== tab.key
                      ? 'bg-green-100 text-green-700'
                      : activeTab === tab.key
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
                  }`}
                >
                  {tab.done && activeTab !== tab.key ? <Check className="w-3 h-3" /> : tab.num}
                </span>
                {tab.label}
              </button>
              {idx < tabs.length - 1 && (
                <span className="text-gray-300 dark:text-gray-600 mx-0.5 text-base">›</span>
              )}
            </div>
          ))}
        </div>

        {/* Next step button */}
        {activeTab !== 'settings' && (
          <button
            onClick={() => {
              const order: Tab[] = ['sequence', 'leadlist', 'launch', 'settings']
              const currentIdx = order.indexOf(activeTab)
              if (currentIdx < order.length - 1) setActiveTab(order[currentIdx + 1])
            }}
            className="ml-2 inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors flex-shrink-0"
          >
            Next step
          </button>
        )}

        {/* Close button */}
        <Link
          href="/campaigns"
          className="ml-1 p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
          title="Close"
        >
          <X className="w-5 h-5" />
        </Link>
      </div>

      {/* Tab content */}
      <div className="flex flex-1 overflow-hidden">
        {activeTab === 'sequence' && (
          <SequenceTab campaign={campaign} onSaved={fetchCampaign} />
        )}
        {activeTab === 'leadlist' && (
          <LeadListTab campaign={campaign} onRefresh={fetchCampaign} />
        )}
        {activeTab === 'launch' && (
          <LaunchTab campaign={campaign} onRefresh={fetchCampaign} />
        )}
        {activeTab === 'settings' && (
          <CampaignSettingsTab campaign={campaign} onRefresh={fetchCampaign} />
        )}
      </div>
    </div>
  )
}
