'use client'

import { useEffect, useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Zap, Loader2, Upload } from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────

const GOALS = [
  { id: 'email_campaigns', label: 'Send email campaigns', icon: '✉️' },
  { id: 'linkedin_outreach', label: 'Automate LinkedIn outreach', icon: '🔗' },
  { id: 'multi_channel', label: 'Run advanced multi-channel sequences', icon: '🔀' },
  { id: 'lead_database', label: 'Find leads in the Lead Database', icon: '🎯' },
  { id: 'enrich_leads', label: 'Enrich leads with AI', icon: '🤖' },
  { id: 'unknown', label: "I don't know yet", icon: '🤔' },
]

const SEQUENCE_TEMPLATES = [
  {
    id: 'linkedin_cold',
    name: 'LinkedIn Cold Outreach',
    icon: '🤝',
    steps: 4,
    days: 14,
    steps_data: [
      { type: 'visit_profile', waitDays: 0, name: 'Visit profile' },
      { type: 'connection_request', waitDays: 1, message: 'Hi {{firstName}}, I work on {{if company}}outreach solutions for {{company}}{{else}}AI-powered outreach tools{{end}}. Would love to connect!', name: 'Connect' },
      { type: 'wait_until_accepted', waitDays: 3, name: 'Wait for acceptance' },
      { type: 'chat_message', waitDays: 1, message: 'Thanks for connecting, {{firstName}}! I noticed you work at {{company}} — we help teams like yours cut outreach time by 60% using AI. Would a 15-min call make sense?', name: 'Follow up' },
    ],
  },
  {
    id: 'email_outreach',
    name: 'Email Outreach',
    icon: '✉️',
    steps: 3,
    days: 7,
    steps_data: [
      { type: 'email', waitDays: 0, subject: 'Quick question, {{firstName}}', message: 'Hi {{firstName}},\n\n{{if aiOpener}}{{aiOpener}}\n\n{{end}}I help {{if company}}teams like {{company}}{{else}}sales teams{{end}} close more deals with AI-powered outreach.\n\nWorth a 15-min call this week?\n\nBest,\n{{name}}', name: 'First email' },
      { type: 'email', waitDays: 3, subject: 'Re: Quick question, {{firstName}}', message: 'Hi {{firstName}},\n\nJust bumping this up — did you get a chance to look?\n\nHappy to share a quick demo if helpful.\n\nBest,\n{{name}}', name: 'Follow up' },
      { type: 'email', waitDays: 7, subject: 'Last note — {{firstName}}', message: "Hi {{firstName}},\n\nI'll leave you alone after this — but if the timing ever makes sense, just reply and we'll set something up.\n\nBest,\n{{name}}", name: 'Final bump' },
    ],
  },
  {
    id: 'multi_channel',
    name: 'Multi-channel',
    icon: '🔀',
    steps: 6,
    days: 21,
    steps_data: [
      { type: 'visit_profile', waitDays: 0, name: 'Visit profile' },
      { type: 'connection_request', waitDays: 1, message: 'Hi {{firstName}}, saw your work on LinkedIn — would love to connect!', name: 'Connect' },
      { type: 'wait_until_accepted', waitDays: 3, name: 'Wait for acceptance' },
      { type: 'chat_message', waitDays: 1, message: "Thanks for connecting, {{firstName}}! I'll also drop you a quick email.", name: 'LinkedIn message' },
      { type: 'email', waitDays: 1, subject: 'Following up, {{firstName}}', message: "Hi {{firstName}},\n\nJust connected on LinkedIn — wanted to reach out via email too.\n\n{{if aiOpener}}{{aiOpener}}\n\n{{end}}Would a quick call make sense?\n\nBest,\n{{name}}", name: 'Email follow-up' },
      { type: 'email', waitDays: 7, subject: 'Last note — {{firstName}}', message: "Hi {{firstName}},\n\nOne last try — if the timing's off, no worries. Just reply whenever it makes sense.\n\nBest,\n{{name}}", name: 'Final email' },
    ],
  },
]

const TOTAL_STEPS = 4

// ─── Progress indicator ───────────────────────────────────────────────────────

function ProgressBar({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => {
        const step = i + 1
        const isCompleted = step < current
        const isCurrent = step === current
        return (
          <div key={step} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                isCompleted
                  ? 'bg-blue-600 text-white'
                  : isCurrent
                  ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                  : 'bg-gray-200 text-gray-400'
              }`}
            >
              {isCompleted ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 12 12">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                step
              )}
            </div>
            {i < TOTAL_STEPS - 1 && (
              <div className={`w-12 h-0.5 transition-colors ${step < current ? 'bg-blue-600' : 'bg-gray-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Step 1: Goals ────────────────────────────────────────────────────────────

function Step1Goals({ onNext }: { onNext: (goals: string[]) => void }) {
  const allGoalIds = GOALS.filter((g) => g.id !== 'unknown').map((g) => g.id)
  const [selected, setSelected] = useState<string[]>(allGoalIds)

  function toggleGoal(id: string) {
    if (id === 'unknown') {
      setSelected((prev) => (prev.includes('unknown') ? prev.filter((g) => g !== 'unknown') : ['unknown']))
      return
    }
    setSelected((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev.filter((g) => g !== 'unknown'), id]))
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2 text-center">What are you looking to achieve with OutreachAI?</h1>
      <p className="text-sm text-gray-500 text-center mb-6">Select all that apply — we&apos;ll personalise your setup.</p>

      <div className="space-y-3 mb-8">
        {GOALS.map((goal) => {
          const isSelected = selected.includes(goal.id)
          return (
            <button
              key={goal.id}
              type="button"
              onClick={() => toggleGoal(goal.id)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border text-left transition-colors ${
                isSelected
                  ? 'border-blue-500 bg-blue-50 text-gray-800 dark:text-gray-100'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <span className="text-xl flex-shrink-0">{goal.icon}</span>
              <div className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ml-auto ${isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`}>
                {isSelected && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <span className="text-sm font-medium flex-1">{goal.label}</span>
            </button>
          )
        })}
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => onNext(selected)}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  )
}

// ─── Step 2: Connect email ─────────────────────────────────────────────────────

function Step2Email({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [smtpHost, setSmtpHost] = useState('')
  const [smtpPort, setSmtpPort] = useState('587')
  const [smtpUser, setSmtpUser] = useState('')
  const [smtpPass, setSmtpPass] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/email-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name || email, email, smtpHost, smtpPort: Number(smtpPort), smtpUser, smtpPass }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to connect email')
        setLoading(false)
        return
      }
      setSuccess(true)
      setTimeout(() => onNext(), 800)
    } catch {
      setError('Network error — please try again')
      setLoading(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2 text-center">Connect your email to start sending</h1>
      <p className="text-sm text-gray-500 text-center mb-6">Connect via SMTP — works with Gmail, Outlook, or any email provider.</p>

      {success ? (
        <div className="text-center py-8">
          <div className="text-4xl mb-3">✅</div>
          <p className="font-semibold text-gray-900">Email connected!</p>
          <p className="text-sm text-gray-500">Moving to next step…</p>
        </div>
      ) : (
        <form onSubmit={handleConnect} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">Display name</label>
              <input
                type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Jane from Acme"
                className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email address</label>
              <input
                type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"
                className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">SMTP host</label>
              <input
                type="text" required value={smtpHost} onChange={e => setSmtpHost(e.target.value)} placeholder="smtp.gmail.com"
                className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">Port</label>
              <input
                type="number" required value={smtpPort} onChange={e => setSmtpPort(e.target.value)} placeholder="587"
                className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">SMTP username</label>
            <input
              type="text" required value={smtpUser} onChange={e => setSmtpUser(e.target.value)} placeholder="you@example.com"
              className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">SMTP password</label>
            <input
              type="password" required value={smtpPass} onChange={e => setSmtpPass(e.target.value)} placeholder="App password or SMTP password"
              className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>
          )}

          <div className="flex items-center justify-between pt-2">
            <button type="button" onClick={onSkip} className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
              Skip for now →
            </button>
            <button
              type="submit" disabled={loading}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Connecting…' : 'Connect email'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

// ─── Step 3: Sequence template ────────────────────────────────────────────────

function Step3Template({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSelect(templateId: string) {
    setSelected(templateId)
    setError(null)
    setLoading(true)
    const template = SEQUENCE_TEMPLATES.find(t => t.id === templateId)
    if (!template) { setLoading(false); return }
    try {
      const res = await fetch('/api/sequences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: template.name, steps: template.steps_data }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to create sequence')
        setSelected(null)
        setLoading(false)
        return
      }
      setTimeout(() => { setLoading(false); onNext() }, 600)
    } catch {
      setError('Network error — please try again')
      setSelected(null)
      setLoading(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2 text-center">Choose a starting sequence template</h1>
      <p className="text-sm text-gray-500 text-center mb-6">Pick one to get started — you can edit it later.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        {SEQUENCE_TEMPLATES.map((tpl) => (
          <button
            key={tpl.id}
            type="button"
            onClick={() => handleSelect(tpl.id)}
            disabled={loading}
            className={`relative p-5 rounded-xl border-2 text-left transition-all hover:shadow-md disabled:opacity-60 ${
              selected === tpl.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-300'
            }`}
          >
            {selected === tpl.id && loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-xl">
                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
              </div>
            )}
            <div className="text-2xl mb-3">{tpl.icon}</div>
            <div className="font-semibold text-gray-900 text-sm mb-1">{tpl.name}</div>
            <div className="text-xs text-gray-500">{tpl.steps} steps · {tpl.days} days</div>
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">{error}</div>
      )}

      <div className="flex justify-end">
        <button type="button" onClick={onSkip} className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
          Skip — I&apos;ll create my own →
        </button>
      </div>
    </div>
  )
}

// ─── Step 4: Add leads ────────────────────────────────────────────────────────

function Step4Leads({ onFinish }: { onFinish: () => void }) {
  const [firstName, setFirstName] = useState('')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [addedCount, setAddedCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleAddLead(e: React.FormEvent) {
    e.preventDefault()
    if (!firstName && !email) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: firstName, email: email || undefined, company: company || undefined }),
      })
      if (res.ok) {
        setAddedCount(c => c + 1)
        setFirstName('')
        setEmail('')
        setCompany('')
      } else {
        const data = await res.json()
        setError(data.error ?? 'Failed to add lead')
      }
    } catch {
      setError('Network error')
    }
    setLoading(false)
  }

  async function handleCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportLoading(true)
    setError(null)
    try {
      const text = await file.text()
      const lines = text.split('\n').filter(Boolean)
      if (lines.length < 2) { setError('CSV appears empty'); setImportLoading(false); return }
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''))
      const get = (row: string[], col: string) => {
        const idx = headers.indexOf(col)
        return idx >= 0 ? (row[idx] ?? '').trim().replace(/['"]/g, '') : ''
      }
      let imported = 0
      for (const line of lines.slice(1)) {
        if (!line.trim()) continue
        const cols = line.split(',')
        const name = get(cols, 'firstname') || get(cols, 'first_name') || get(cols, 'name')
        const emailVal = get(cols, 'email')
        const companyVal = get(cols, 'company')
        const linkedinUrl = get(cols, 'linkedinurl') || get(cols, 'linkedin_url') || get(cols, 'linkedin')
        if (!name && !emailVal) continue
        const res = await fetch('/api/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name || emailVal, email: emailVal || undefined, company: companyVal || undefined, linkedinUrl: linkedinUrl || undefined }),
        })
        if (res.ok) imported++
      }
      setAddedCount(c => c + imported)
    } catch {
      setError('Failed to parse CSV')
    }
    setImportLoading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2 text-center">Add your first prospects</h1>
      <p className="text-sm text-gray-500 text-center mb-6">Import a CSV or add someone manually to see how it works.</p>

      {/* CSV import */}
      <div
        className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center mb-6 hover:border-blue-400 transition-colors cursor-pointer"
        onClick={() => fileRef.current?.click()}
      >
        <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleCSV} />
        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
        {importLoading ? (
          <div className="flex items-center justify-center gap-2 text-sm text-blue-600">
            <Loader2 className="w-4 h-4 animate-spin" />
            Importing…
          </div>
        ) : (
          <>
            <p className="text-sm font-medium text-gray-700 mb-1">Import CSV</p>
            <p className="text-xs text-gray-400">Click to choose file or drag &amp; drop</p>
            <p className="text-xs text-gray-400 mt-1">Columns: firstName, email, company, linkedinUrl</p>
          </>
        )}
      </div>

      <div className="flex items-center gap-3 mb-5">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs text-gray-400">or add manually</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      <form onSubmit={handleAddLead} className="space-y-3 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">First name</label>
            <input
              type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Jane"
              className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@acme.com"
              className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Company</label>
            <input
              type="text" value={company} onChange={e => setCompany(e.target.value)} placeholder="Acme Inc"
              className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
          </div>
        </div>
        <button
          type="submit" disabled={loading || (!firstName && !email)}
          className="flex items-center gap-2 bg-gray-800 hover:bg-gray-900 disabled:opacity-40 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          {loading && <Loader2 className="w-3 h-3 animate-spin" />}
          Add lead
        </button>
      </form>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">{error}</div>
      )}

      {addedCount > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-3 rounded-lg mb-4">
          {addedCount} lead{addedCount !== 1 ? 's' : ''} added successfully!
        </div>
      )}

      <div className="flex justify-between items-center pt-2">
        <p className="text-xs text-gray-400">You can always import more leads later</p>
        <button
          onClick={onFinish}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors"
        >
          Go to dashboard →
        </button>
      </div>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [step, setStep] = useState(1)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login')
    }
  }, [status, router])

  function handleGoals(goals: string[]) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('onboardingGoals', JSON.stringify(goals))
    }
    setStep(2)
  }

  function handleFinish() {
    router.push('/dashboard')
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #a8c4f0 0%, #b8b0e8 50%, #9db8e8 100%)' }}>
        <div className="text-sm text-white/70">Loading…</div>
      </div>
    )
  }

  if (!session) return null

  const stepTitles = ['Your goals', 'Connect email', 'First sequence', 'Add leads']

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8" style={{ background: 'linear-gradient(135deg, #a8c4f0 0%, #b8b0e8 50%, #9db8e8 100%)' }}>
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2 mb-6">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-9 h-9 bg-blue-600 rounded-xl">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900 tracking-tight">OutreachAI</span>
          </div>
          <span className="text-sm font-medium text-gray-700">Step {step} of {TOTAL_STEPS} — {stepTitles[step - 1]}</span>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-5 md:p-8">
          {/* Progress */}
          <div className="flex justify-center mb-6">
            <ProgressBar current={step} />
          </div>

          {step === 1 && <Step1Goals onNext={handleGoals} />}
          {step === 2 && (
            <Step2Email
              onNext={() => setStep(3)}
              onSkip={() => setStep(3)}
            />
          )}
          {step === 3 && (
            <Step3Template
              onNext={() => setStep(4)}
              onSkip={() => setStep(4)}
            />
          )}
          {step === 4 && <Step4Leads onFinish={handleFinish} />}
        </div>

        {/* Scrolling company logos */}
        <div className="mt-8 overflow-hidden">
          <div className="flex animate-[marquee_20s_linear_infinite] whitespace-nowrap gap-12 items-center">
            {[
              'Amazon', 'Uber', 'Salesforce', 'HubSpot', 'Shopify',
              'Zendesk', 'Intercom', 'Notion', 'Stripe', 'Slack',
              'Amazon', 'Uber', 'Salesforce', 'HubSpot', 'Shopify',
              'Zendesk', 'Intercom', 'Notion', 'Stripe', 'Slack',
            ].map((name, i) => (
              <span key={i} className="text-sm font-bold text-white/70 tracking-wide uppercase flex-shrink-0">
                {name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
