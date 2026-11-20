'use client'

import { useState, useEffect, useLayoutEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { Copy, Check, User, Puzzle, Plus, Trash2, Mail, Bot, Eye, EyeOff, Webhook, Loader2, Terminal, Lock, Search, CheckCircle2, CalendarDays, Globe } from 'lucide-react'
import { cn } from '@/lib/cn'
import { WEBHOOK_EVENTS, type WebhookEvent } from '@/lib/webhooks'
import { SnippetsSection } from '@/components/SnippetsSection'
import { SchedulesSection } from '@/components/SchedulesSection'
import { ConversationLabelsSection } from '@/components/ConversationLabelsSection'
import { CustomFieldsSection } from '@/components/CustomFieldsSection'
import { AutoDraftSection } from '@/components/AutoDraftSection'

interface LinkedInAccount {
  id: string
  name: string
  email: string | null
  avatarColor: string
  isDefault: boolean
}

interface LinkedInStatus {
  configured: boolean
  connected: boolean
  account: { name: string; email: string | null; scope: string | null; tokenExpiry: string | null } | null
}

interface EmailAccount {
  id: string
  provider: string
  name: string
  email: string
  smtpHost: string | null
  smtpPort: number | null
  smtpUser: string | null
  isDefault: boolean
  dailyLimit?: number
  signature?: string | null
  warmupActive?: boolean
}

const AVATAR_COLORS = ['#ef4444','#3b82f6','#8b5cf6','#10b981','#f59e0b','#ec4899','#6366f1','#f97316']

const WA_QR_TTL = 20
function WaQrCountdown({ onExpired }: { onExpired: () => void }) {
  const [seconds, setSeconds] = useState(WA_QR_TTL)
  useEffect(() => {
    setSeconds(WA_QR_TTL)
    const t = setInterval(() => setSeconds(s => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [])
  useEffect(() => { if (seconds === 0) onExpired() }, [seconds, onExpired])
  if (seconds === 0) return null
  return (
    <p className="text-xs text-gray-400">
      Expires in <span className={`font-medium tabular-nums ${seconds <= 5 ? 'text-red-500' : ''}`}>{seconds}s</span>
    </p>
  )
}

export default function SettingsPage() {
  const { data: session } = useSession()
  // Email accounts
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([])
  const [addingEmail, setAddingEmail] = useState(false)
  const [emailForm, setEmailForm] = useState({ name: '', email: '', smtpHost: '', smtpPort: '587', smtpUser: '', smtpPass: '' })
  const [emailSaving, setEmailSaving] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  // SES
  const [addingSES, setAddingSES] = useState(false)
  const [sesForm, setSesForm] = useState({ name: '', email: '', awsRegion: 'us-east-1', awsAccessKeyId: '', awsSecretAccessKey: '' })
  const [sesSaving, setSesSaving] = useState(false)
  const [sesError, setSesError] = useState<string | null>(null)
  const [sesShowSecret, setSesShowSecret] = useState(false)
  // Guide toggles
  const [smtpShowGuide, setSmtpShowGuide] = useState(false)
  const [sesShowGuide, setSesShowGuide] = useState(false)
  const [liShowGuide, setLiShowGuide] = useState(false)
  const [waShowGuide, setWaShowGuide] = useState(false)
  // Email account testing
  const [testingAccountId, setTestingAccountId] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, { status: 'success' | 'error'; message: string } | undefined>>({})
  // SendGrid
  const [addingSendGrid, setAddingSendGrid] = useState(false)
  const [sgForm, setSgForm] = useState({ name: '', email: '', sendgridApiKey: '' })
  const [sgSaving, setSgSaving] = useState(false)
  const [sgError, setSgError] = useState<string | null>(null)
  const [sgShowKey, setSgShowKey] = useState(false)
  const [sgShowGuide, setSgShowGuide] = useState(false)

  const userId = session?.user?.id ?? ''
  const userEmail = session?.user?.email ?? ''

  // LinkedIn OAuth status
  const [linkedInStatus, setLinkedInStatus] = useState<LinkedInStatus | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)

  // LinkedIn BYOK app credentials
  const [linkedInAppSaved, setLinkedInAppSaved] = useState<{ clientId: string | null; clientSecret: string | null } | null>(null)
  const [linkedInAppForm, setLinkedInAppForm] = useState({ clientId: '', clientSecret: '' })
  const [linkedInAppSaving, setLinkedInAppSaving] = useState(false)
  const [linkedInAppError, setLinkedInAppError] = useState<string | null>(null)
  const [showLinkedInSetup, setShowLinkedInSetup] = useState(false)

  useEffect(() => {
    fetch('/api/auth/linkedin/status')
      .then(r => r.json())
      .then(d => setLinkedInStatus(d))
      .catch(() => {})
    fetch('/api/settings/linkedin-app')
      .then(r => r.json())
      .then(d => setLinkedInAppSaved({ clientId: d.clientId, clientSecret: d.clientSecret }))
      .catch(() => {})
  }, [])

  async function saveLinkedInApp() {
    setLinkedInAppSaving(true)
    setLinkedInAppError(null)
    try {
      const res = await fetch('/api/settings/linkedin-app', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(linkedInAppForm),
      })
      if (!res.ok) {
        const d = await res.json()
        setLinkedInAppError(d.error ?? 'Failed to save')
      } else {
        setLinkedInAppSaved({ clientId: linkedInAppForm.clientId.slice(-4).padStart(8, '*'), clientSecret: '****' })
        setLinkedInAppForm({ clientId: '', clientSecret: '' })
        setShowLinkedInSetup(false)
        // Refresh status so Connect button appears
        const d = await fetch('/api/auth/linkedin/status').then(r => r.json())
        setLinkedInStatus(d)
      }
    } finally {
      setLinkedInAppSaving(false)
    }
  }

  async function removeLinkedInApp() {
    await fetch('/api/settings/linkedin-app', { method: 'DELETE' })
    setLinkedInAppSaved(null)
    setLinkedInStatus(prev => prev ? { ...prev, configured: false, connected: false, account: null } : prev)
  }

  async function disconnectLinkedIn() {
    setDisconnecting(true)
    await fetch('/api/auth/linkedin/disconnect', { method: 'POST' })
    setLinkedInStatus(prev => prev ? { ...prev, connected: false, account: null } : prev)
    setDisconnecting(false)
  }

  // MCP
  const [mcpToken, setMcpToken] = useState<string | null>(null)
  const [mcpCopied, setMcpCopied] = useState<'desktop' | 'code' | null>(null)

  useEffect(() => {
    if (userId) {
      fetch('/api/mcp/token').then(r => r.json()).then(d => { if (d.token) setMcpToken(d.token) })
    }
  }, [userId])

  function getMcpDesktopConfig() {
    return JSON.stringify({
      mcpServers: {
        outreachai: {
          type: 'http',
          url: 'https://outreachai.in/api/mcp',
          headers: {
            Authorization: `Bearer ${mcpToken}`,
            'X-User-Id': userId,
          },
        },
      },
    }, null, 2)
  }

  function getMcpCodeConfig() {
    return JSON.stringify({
      outreachai: {
        type: 'http',
        url: 'https://outreachai.in/api/mcp',
        headers: {
          Authorization: `Bearer ${mcpToken}`,
          'X-User-Id': userId,
        },
      },
    }, null, 2)
  }

  async function copyMcp(type: 'desktop' | 'code') {
    await navigator.clipboard.writeText(type === 'desktop' ? getMcpDesktopConfig() : getMcpCodeConfig())
    setMcpCopied(type)
    setTimeout(() => setMcpCopied(null), 2000)
  }

  // ── Meeting link ──────────────────────────────────────────────────────────────
  const [meetingPage, setMeetingPage] = useState<{
    slug: string; title: string; description: string; duration: number
    timezone: string; weeklyHours: Record<string, number[][]>; bufferMins: number; active: boolean
  } | null>(null)
  const [meetingForm, setMeetingForm] = useState({
    slug: '', title: 'Book a meeting', description: '', duration: 30,
    timezone: 'Asia/Kolkata', bufferMins: 15,
  })
  const [meetingHours, setMeetingHours] = useState<Record<string, { enabled: boolean; start: number; end: number }>>({
    mon: { enabled: true, start: 9, end: 17 },
    tue: { enabled: true, start: 9, end: 17 },
    wed: { enabled: true, start: 9, end: 17 },
    thu: { enabled: true, start: 9, end: 17 },
    fri: { enabled: true, start: 9, end: 17 },
    sat: { enabled: false, start: 9, end: 17 },
    sun: { enabled: false, start: 9, end: 17 },
  })
  const [meetingSaving, setMeetingSaving] = useState(false)
  const [meetingSaved, setMeetingSaved] = useState(false)
  const [meetingError, setMeetingError] = useState<string | null>(null)
  const [meetingLinkCopied, setMeetingLinkCopied] = useState(false)

  useEffect(() => {
    fetch('/api/meetings/page')
      .then(r => r.json())
      .then(d => {
        if (d.page) {
          setMeetingPage(d.page)
          setMeetingForm({
            slug: d.page.slug,
            title: d.page.title,
            description: d.page.description ?? '',
            duration: d.page.duration,
            timezone: d.page.timezone,
            bufferMins: d.page.bufferMins,
          })
          // Restore weeklyHours
          const wh = d.page.weeklyHours as Record<string, number[][]>
          const days = ['mon','tue','wed','thu','fri','sat','sun'] as const
          const newHours = { ...meetingHours }
          for (const day of days) {
            if (wh[day] && wh[day].length > 0) {
              newHours[day] = { enabled: true, start: wh[day][0][0], end: wh[day][0][1] }
            } else {
              newHours[day] = { ...newHours[day], enabled: false }
            }
          }
          setMeetingHours(newHours)
        }
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function saveMeetingPage() {
    setMeetingSaving(true)
    setMeetingError(null)
    try {
      // Build weeklyHours from the form state
      const weeklyHours: Record<string, number[][]> = {}
      for (const [day, val] of Object.entries(meetingHours)) {
        if (val.enabled) weeklyHours[day] = [[val.start, val.end]]
      }
      const res = await fetch('/api/meetings/page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...meetingForm, weeklyHours }),
      })
      const data = await res.json()
      if (!res.ok) { setMeetingError(data.error ?? 'Failed to save'); return }
      setMeetingPage(data.page)
      setMeetingSaved(true)
      setTimeout(() => setMeetingSaved(false), 4000)
    } finally {
      setMeetingSaving(false)
    }
  }

  function copyMeetingLink() {
    if (!meetingPage) return
    navigator.clipboard.writeText(`https://outreachai.in/meet/${meetingPage.slug}`).then(() => {
      setMeetingLinkCopied(true)
      setTimeout(() => setMeetingLinkCopied(false), 2000)
    })
  }

  // ── Billing ───────────────────────────────────────────────────────────────────
  const [billingLoading, setBillingLoading] = useState(false)

  async function handleManageBilling() {
    setBillingLoading(true)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch { /* ignore */ }
    setBillingLoading(false)
  }

  // ── Password state ────────────────────────────────────────────────────────────
  const [hasPassword, setHasPassword] = useState<boolean | null>(null)
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [pwSaving, setPwSaving] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwSaved, setPwSaved] = useState(false)

  useEffect(() => {
    fetch('/api/auth/has-password').then(r => r.json()).then(d => setHasPassword(d.hasPassword))
  }, [])

  async function savePassword() {
    if (pwForm.next !== pwForm.confirm) { setPwError('Passwords do not match'); return }
    if (pwForm.next.length < 8) { setPwError('Password must be at least 8 characters'); return }
    setPwSaving(true); setPwError(null)
    const res = await fetch('/api/auth/set-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: pwForm.current || undefined, newPassword: pwForm.next }),
    })
    const data = await res.json()
    if (!res.ok) { setPwError(data.error ?? 'Failed to save'); setPwSaving(false); return }
    setPwForm({ current: '', next: '', confirm: '' })
    setPwSaving(false)
    setPwSaved(true)
    setHasPassword(true)
    setTimeout(() => setPwSaved(false), 6000)
  }

  useEffect(() => {
    fetch('/api/email-accounts')
      .then(r => r.json())
      .then(d => { if (d.accounts) setEmailAccounts(d.accounts) })
  }, [])

  async function addEmailAccount() {
    setEmailSaving(true)
    setEmailError(null)
    const res = await fetch('/api/email-accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...emailForm, smtpPort: Number(emailForm.smtpPort) }),
    })
    const data = await res.json()
    if (!res.ok) { setEmailError(data.error ?? 'Failed to save'); setEmailSaving(false); return }
    setEmailAccounts(prev => [...prev, data.account])
    setEmailForm({ name: '', email: '', smtpHost: '', smtpPort: '587', smtpUser: '', smtpPass: '' })
    setAddingEmail(false)
    setEmailSaving(false)
  }

  async function addSendGridAccount() {
    setSgSaving(true)
    setSgError(null)
    const res = await fetch('/api/email-accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...sgForm, provider: 'sendgrid' }),
    })
    const data = await res.json()
    if (!res.ok) { setSgError(data.error ?? 'Failed to save'); setSgSaving(false); return }
    setEmailAccounts(prev => [...prev, data.account])
    setSgForm({ name: '', email: '', sendgridApiKey: '' })
    setAddingSendGrid(false)
    setSgSaving(false)
  }

  async function addSESAccount() {
    setSesSaving(true)
    setSesError(null)
    const res = await fetch('/api/email-accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...sesForm, provider: 'ses' }),
    })
    const data = await res.json()
    if (!res.ok) { setSesError(data.error ?? 'Failed to save'); setSesSaving(false); return }
    setEmailAccounts(prev => [...prev, data.account])
    setSesForm({ name: '', email: '', awsRegion: 'us-east-1', awsAccessKeyId: '', awsSecretAccessKey: '' })
    setAddingSES(false)
    setSesSaving(false)
  }

  async function removeEmailAccount(id: string) {
    const acc = emailAccounts.find(a => a.id === id)
    if (!acc) return
    if (!confirm(`Delete "${acc.name}" (${acc.email})? This cannot be undone.`)) return

    const res = await fetch('/api/email-accounts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    })

    if (res.ok) {
      setEmailAccounts(prev => prev.filter(a => a.id !== id))
      setExpandedEmailId(null)
    } else {
      const data = await res.json()
      alert('Failed to delete: ' + (data.error || 'Unknown error'))
    }
  }

  async function patchEmailAccount(id: string, patch: Partial<EmailAccount>) {
    const res = await fetch('/api/email-accounts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...patch }),
    })
    if (res.ok) {
      const { account } = await res.json()
      setEmailAccounts(prev => prev.map(a => (a.id === id ? { ...a, ...account } : patch.isDefault ? { ...a, isDefault: false } : a)))
    }
  }

  async function testEmailAccount(id: string) {
    setTestingAccountId(id)
    setTestResults(prev => ({ ...prev, [id]: { status: 'success', message: 'Testing...' } }))
    const res = await fetch('/api/email-accounts/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    const data = await res.json()
    setTestResults(prev => ({
      ...prev,
      [id]: {
        status: res.ok ? 'success' : 'error',
        message: data.message || (res.ok ? 'Connection successful!' : 'Connection failed'),
      },
    }))
    setTestingAccountId(null)
    setTimeout(() => setTestResults(prev => ({ ...prev, [id]: undefined })), 5000)
  }

  // Track which email account row is expanded for advanced settings
  const [expandedEmailId, setExpandedEmailId] = useState<string | null>(null)

  // ── AI Provider state ────────────────────────────────────────────────────────
  const AI_PROVIDERS = [
    { id: 'anthropic', label: 'Anthropic (Claude)', envKey: 'ANTHROPIC_API_KEY', placeholder: 'sk-ant-...', docsUrl: 'https://console.anthropic.com/keys',
      hint: 'Powers AI-generated openers, reply suggestions, and the OutReach Agent. Pay-as-you-go — ~$0.003 per 1K tokens. Free trial credits on sign-up.' },
    { id: 'openai', label: 'OpenAI (GPT)', envKey: 'OPENAI_API_KEY', placeholder: 'sk-...', docsUrl: 'https://platform.openai.com/api-keys',
      hint: 'Alternative to Anthropic. GPT-4o is faster for bulk AI enrichment. Pay-as-you-go — ~$0.005 per 1K tokens.' },
    { id: 'gemini', label: 'Google Gemini', envKey: 'GEMINI_API_KEY', placeholder: 'AIza...', docsUrl: 'https://aistudio.google.com/apikey',
      hint: 'Google\'s model. Free tier available (60 requests/min). Good for testing before committing to a paid plan.' },
  ]
  const [aiKeys, setAiKeys] = useState<Record<string, string>>({ anthropic: '', openai: '', gemini: '' })
  const [aiShow, setAiShow] = useState<Record<string, boolean>>({ anthropic: false, openai: false, gemini: false })
  const [aiSaving, setAiSaving] = useState<string | null>(null)
  const [aiSaved, setAiSaved]   = useState<string | null>(null)
  const [aiConfigured, setAiConfigured] = useState<Record<string, boolean>>({ anthropic: false, openai: false, gemini: false })
  const [aiClearing, setAiClearing] = useState<string | null>(null)
  const [aiEyeTooltip, setAiEyeTooltip] = useState<Record<string, boolean>>({ anthropic: false, openai: false, gemini: false })

  useEffect(() => {
    fetch('/api/settings/ai-keys')
      .then(r => r.json())
      .then(d => { if (d.configured) setAiConfigured(d.configured) })
  }, [])

  async function saveAiKey(providerId: string, envKey: string) {
    const key = aiKeys[providerId]?.trim()
    if (!key) return
    setAiSaving(providerId)
    const res = await fetch('/api/settings/ai-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: providerId, envKey, apiKey: key }),
    })
    setAiSaving(null)
    if (res.ok) {
      setAiConfigured(prev => ({ ...prev, [providerId]: true }))
      setAiKeys(prev => ({ ...prev, [providerId]: '' }))
      setAiSaved(providerId)
      setTimeout(() => setAiSaved(null), 2500)
    }
  }

  async function clearAiKey(providerId: string) {
    setAiClearing(providerId)
    await fetch('/api/settings/ai-keys', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: providerId }),
    })
    setAiClearing(null)
    setAiConfigured(prev => ({ ...prev, [providerId]: false }))
    setAiKeys(prev => ({ ...prev, [providerId]: '' }))
  }

  // ── Enrichment API Keys state ────────────────────────────────────────────────
  const ENRICHMENT_PROVIDERS = [
    { id: 'apolloApiKey', label: 'Apollo.io', placeholder: 'Apollo API key', docsUrl: 'https://developer.apollo.io/keys/',
      hint: 'Finds email addresses and phone numbers for leads. Free plan: 50 enrichments/month. Paid starts at $49/month for 1,200/month.' },
    { id: 'hunterApiKey', label: 'Hunter.io', placeholder: 'Hunter API key', docsUrl: 'https://hunter.io/api-keys',
      hint: 'Verifies email addresses to reduce bounces before sending. Free plan: 25 searches/month. Use alongside Apollo for better deliverability.' },
  ]
  const [enrichKeys, setEnrichKeys] = useState<Record<string, string>>({ apolloApiKey: '', hunterApiKey: '' })
  const [enrichShow, setEnrichShow] = useState<Record<string, boolean>>({ apolloApiKey: false, hunterApiKey: false })
  const [enrichSaving, setEnrichSaving] = useState<string | null>(null)
  const [enrichSaved, setEnrichSaved] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/settings/enrichment-keys')
      .then(r => r.json())
      .then(d => {
        setEnrichKeys({ apolloApiKey: d.apolloApiKey ?? '', hunterApiKey: d.hunterApiKey ?? '' })
      })
  }, [])

  async function saveEnrichKey(id: string) {
    const val = enrichKeys[id]?.trim()
    if (!val) return
    setEnrichSaving(id)
    await fetch('/api/settings/enrichment-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [id]: val }),
    })
    setEnrichSaving(null)
    setEnrichSaved(id)
    setTimeout(() => setEnrichSaved(null), 2000)
  }

  // ── Webhook state ────────────────────────────────────────────────────────────
  interface WebhookEndpoint { id: string; url: string; active: boolean; events: string[]; hasSecret: boolean; deliveryCount: number }
  const [webhooks, setWebhooks]         = useState<WebhookEndpoint[]>([])
  const [addingWebhook, setAddingWebhook] = useState(false)
  const [whForm, setWhForm]             = useState({ url: '', secret: '', events: [] as string[] })
  const [whSaving, setWhSaving]         = useState(false)
  const [whError, setWhError]           = useState<string | null>(null)
  const [whTesting, setWhTesting]       = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/webhooks').then(r => r.json()).then(d => { if (Array.isArray(d)) setWebhooks(d) })
  }, [])

  async function addWebhook() {
    if (!whForm.url || whForm.events.length === 0) { setWhError('URL and at least one event required'); return }
    setWhSaving(true); setWhError(null)
    const res = await fetch('/api/webhooks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(whForm),
    })
    const data = await res.json()
    if (!res.ok) { setWhError(data.error ?? 'Failed to save'); setWhSaving(false); return }
    setWebhooks(prev => [data, ...prev])
    setWhForm({ url: '', secret: '', events: [] })
    setAddingWebhook(false)
    setWhSaving(false)
  }

  async function deleteWebhook(id: string) {
    await fetch('/api/webhooks', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setWebhooks(prev => prev.filter(w => w.id !== id))
  }

  async function testWebhook(id: string) {
    setWhTesting(id)
    await fetch(`/api/webhooks/${id}/test`, { method: 'POST' })
    setTimeout(() => setWhTesting(null), 2000)
  }

  function toggleEvent(event: string) {
    setWhForm(prev => ({
      ...prev,
      events: prev.events.includes(event) ? prev.events.filter(e => e !== event) : [...prev.events, event],
    }))
  }

  // ── WhatsApp (mfapis) ──────────────────────────────────────────────────────
  const WA_DEFAULT_BASE_URL = 'https://app2.mfapis.club'
  type WaPhone = { phone_id: string; org_phone: string | null; wa_state: string; is_ready: boolean; qr_code: string | null }
  const [waForm, setWaForm]       = useState({ waApiKey: '', waBaseUrl: WA_DEFAULT_BASE_URL, waWebhookSecret: '' })
  const [waSaved, setWaSaved]     = useState<Record<string, string>>({ waApiKey: '', waPhone: '', waBaseUrl: '', waWebhookSecret: '' })
  const [waSaving, setWaSaving]   = useState(false)
  const [waError, setWaError]     = useState<string | null>(null)
  const [waOk, setWaOk]           = useState(false)
  const [waShowKey, setWaShowKey] = useState(false)
  const [waShowSecret, setWaShowSecret] = useState(false)
  // Phone connection
  const [waPhones, setWaPhones]   = useState<WaPhone[]>([])
  const [waPhoneLoading, setWaPhoneLoading] = useState(false)
  const [waPhoneAdding, setWaPhoneAdding]   = useState(false)
  const [waQrOpen, setWaQrOpen]   = useState(false)
  const [waQrPhone, setWaQrPhone] = useState<WaPhone | null>(null)
  const [waQrDataUrl, setWaQrDataUrl]   = useState<string | null>(null)
  const [waQrLoading, setWaQrLoading]   = useState(false)
  const [waQrExpired, setWaQrExpired]   = useState(false)
  const [waPairOpen, setWaPairOpen]     = useState(false)
  const [waPairPhone, setWaPairPhone]   = useState<WaPhone | null>(null)
  const [waPairNumber, setWaPairNumber] = useState('')
  const [waPairCode, setWaPairCode]     = useState<string | null>(null)
  const [waPairLoading, setWaPairLoading]   = useState(false)
  const [waPairConnected, setWaPairConnected] = useState(false)

  const waCredentialsSet = !!(waSaved.waApiKey && waSaved.waBaseUrl)

  useEffect(() => {
    fetch('/api/settings/whatsapp')
      .then(r => r.json())
      .then(d => {
        const baseUrl = d.waBaseUrl ?? ''
        setWaSaved({ waApiKey: d.waApiKey ?? '', waPhone: d.waPhone ?? '', waBaseUrl: baseUrl, waWebhookSecret: d.waWebhookSecret ?? '' })
        // Pre-fill form with saved base URL (or keep the default)
        if (baseUrl) setWaForm(prev => ({ ...prev, waBaseUrl: baseUrl }))
      })
      .catch(() => {})
  }, [])

  const loadWaPhones = (showSpinner = false) => {
    if (!waCredentialsSet) return
    if (showSpinner) setWaPhoneLoading(true)
    fetch('/api/settings/whatsapp/phone')
      .then(r => r.json())
      .then((phones: WaPhone[]) => {
        if (!Array.isArray(phones)) return
        setWaPhones(phones)
        // Auto-save org_phone when a phone connects
        const connected = phones.find(p => p.wa_state === 'CONNECTED' && p.org_phone)
        if (connected?.org_phone && connected.org_phone !== waSaved.waPhone) {
          fetch('/api/settings/whatsapp/phone', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'save_phone', phone: connected.org_phone }),
          }).then(() => setWaSaved(prev => ({ ...prev, waPhone: connected.org_phone! }))).catch(() => {})
        }
      })
      .catch(() => {})
      .finally(() => setWaPhoneLoading(false))
  }

  useEffect(() => {
    if (waCredentialsSet) loadWaPhones(true)
  }, [waCredentialsSet]) // eslint-disable-line react-hooks/exhaustive-deps

  // Poll every 5s while any phone is not connected
  useEffect(() => {
    if (!waCredentialsSet) return
    const t = setInterval(() => {
      if (!waPhones.every(p => p.wa_state === 'CONNECTED')) loadWaPhones()
    }, 5000)
    return () => clearInterval(t)
  }, [waCredentialsSet, waPhones]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-close QR/pair dialogs when phone connects
  useEffect(() => {
    if (waQrOpen && waQrPhone) {
      const updated = waPhones.find(p => p.phone_id === waQrPhone.phone_id)
      if (updated?.wa_state === 'CONNECTED') { setWaQrOpen(false); setWaQrDataUrl(null) }
    }
    if (waPairOpen && waPairPhone) {
      const updated = waPhones.find(p => p.phone_id === waPairPhone.phone_id)
      if (updated?.wa_state === 'CONNECTED') {
        setWaPairConnected(true)
        setTimeout(() => { setWaPairOpen(false); setWaPairCode(null); setWaPairConnected(false) }, 1500)
      }
    }
  }, [waPhones]) // eslint-disable-line react-hooks/exhaustive-deps

  async function saveWaSettings() {
    setWaSaving(true); setWaError(null)
    const payload: Record<string, string> = {}
    if (waForm.waApiKey.trim())        payload.waApiKey        = waForm.waApiKey.trim()
    if (waForm.waBaseUrl.trim())       payload.waBaseUrl       = waForm.waBaseUrl.trim()
    if (waForm.waWebhookSecret.trim()) payload.waWebhookSecret = waForm.waWebhookSecret.trim()
    if (Object.keys(payload).length === 0) { setWaError('Fill in at least one field'); setWaSaving(false); return }
    const res = await fetch('/api/settings/whatsapp', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    if (!res.ok) { const d = await res.json(); setWaError(d.error ?? 'Failed'); setWaSaving(false); return }
    setWaSaved(prev => ({ ...prev, ...payload }))
    setWaForm({ waApiKey: '', waBaseUrl: '', waWebhookSecret: '' })
    setWaOk(true); setTimeout(() => setWaOk(false), 2500)
    setWaSaving(false)
    loadWaPhones(true)
  }

  async function disconnectWa() {
    await fetch('/api/settings/whatsapp', { method: 'DELETE' })
    setWaSaved({ waApiKey: '', waPhone: '', waBaseUrl: '', waWebhookSecret: '' })
    setWaPhones([])
  }

  async function addWaPhone() {
    setWaPhoneAdding(true)
    const res = await fetch('/api/settings/whatsapp/phone', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create' }),
    })
    setWaPhoneAdding(false)
    if (res.ok) loadWaPhones()
  }

  async function showWaQr(phone: WaPhone) {
    const phoneKey = phone.org_phone ?? phone.phone_id
    setWaQrPhone(phone); setWaQrOpen(true); setWaQrLoading(true); setWaQrDataUrl(null); setWaQrExpired(false)
    const res = await fetch(`/api/settings/whatsapp/phone/qr?phone=${encodeURIComponent(phoneKey)}`)
    const d = await res.json().catch(() => ({}))
    if (res.ok && d.dataUrl) setWaQrDataUrl(d.dataUrl)
    setWaQrLoading(false)
  }

  async function requestWaPairCode() {
    if (!waPairPhone) return
    const phoneKey = waPairPhone.org_phone ?? waPairPhone.phone_id
    setWaPairLoading(true); setWaPairCode(null)
    const res = await fetch('/api/settings/whatsapp/phone/pairing', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phoneKey, phoneNumber: waPairNumber }),
    })
    const d = await res.json().catch(() => ({}))
    if (res.ok && d.code) setWaPairCode(d.code)
    setWaPairLoading(false)
  }

  async function deleteWaPhone(phone: WaPhone) {
    const label = phone.org_phone ? `+${phone.org_phone}` : 'this phone'
    if (!confirm(`Delete ${label}? This will disconnect WhatsApp.`)) return
    await fetch('/api/settings/whatsapp/phone', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', phone: phone.org_phone ?? phone.phone_id }),
    })
    loadWaPhones()
  }

  // ── Website tracking ──────────────────────────────────────────────────────────
  const [trackingSnippet, setTrackingSnippet] = useState<string | null>(null)
  const [trackingId, setTrackingId] = useState<string | null>(null)
  const [snippetCopied, setSnippetCopied] = useState(false)
  const [activeSection, setActiveSection] = useState('email-accounts')

  const NAV_GROUPS = [
    {
      label: 'Channels',
      items: [
        { id: 'email-accounts', label: 'Email' },
        { id: 'linkedin', label: 'LinkedIn' },
        { id: 'whatsapp', label: 'WhatsApp' },
      ],
    },
    {
      label: 'AI & Data',
      items: [
        { id: 'ai-providers', label: 'AI Providers' },
        { id: 'enrichment-keys', label: 'Enrichment Keys' },
        { id: 'auto-draft', label: 'Auto-draft' },
      ],
    },
    {
      label: 'Productivity',
      items: [
        { id: 'snippets', label: 'Snippets' },
        { id: 'schedules', label: 'Schedules' },
        { id: 'labels', label: 'Labels' },
        { id: 'custom-fields', label: 'Custom Fields' },
      ],
    },
    {
      label: 'Integrations',
      items: [
        { id: 'chrome-extension', label: 'Chrome Extension' },
        { id: 'website-tracking', label: 'Website Tracking' },
        { id: 'webhooks', label: 'Webhooks' },
        { id: 'mcp-server', label: 'MCP Server' },
        { id: 'meeting', label: 'Meeting Link' },
      ],
    },
    {
      label: 'Account',
      items: [
        { id: 'billing', label: 'Billing' },
        { id: 'password', label: 'Password' },
        { id: 'account', label: 'Profile' },
      ],
    },
  ]

  useEffect(() => {
    fetch('/api/track/setup')
      .then(r => r.json())
      .then(d => {
        if (d.snippet) setTrackingSnippet(d.snippet)
        if (d.trackingId) setTrackingId(d.trackingId)
      })
      .catch(() => {})
  }, [])

  async function copyTrackingSnippet() {
    if (!trackingSnippet) return
    await navigator.clipboard.writeText(trackingSnippet)
    setSnippetCopied(true)
    setTimeout(() => setSnippetCopied(false), 2000)
  }

  // Fix 5: useLayoutEffect + rAF waits for paint before scrolling, more reliable than setTimeout
  useLayoutEffect(() => {
    const hash = window.location.hash.slice(1)
    if (!hash) return
    requestAnimationFrame(() => {
      const el = document.getElementById(hash)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        setActiveSection(hash)
      }
    })
  }, [])

  useEffect(() => {
    const sectionIds = NAV_GROUPS.flatMap(g => g.items.map(i => i.id))
    const scrollRoot = document.querySelector('main') as HTMLElement | null
    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.id
            setActiveSection(id)
            history.replaceState(null, '', `#${id}`)
          }
        }
      },
      { root: scrollRoot, rootMargin: '-10% 0px -75% 0px' }
    )
    for (const id of sectionIds) {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage your account, extension, and connected services.</p>
      </div>

      <div className="flex gap-8 items-start">
        {/* Sticky sidebar nav */}
        <aside className="hidden lg:block w-48 flex-shrink-0">
          <nav className="sticky top-4 space-y-5">
            {NAV_GROUPS.map(group => (
              <div key={group.label}>
                <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5 px-2">{group.label}</p>
                <div className="space-y-0.5">
                  {group.items.map(item => (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      onClick={e => {
                        e.preventDefault()
                        const el = document.getElementById(item.id)
                        if (el) {
                          el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                          setActiveSection(item.id)
                          history.replaceState(null, '', `#${item.id}`)
                        }
                      }}
                      className={`block px-2 py-1.5 text-sm rounded-lg transition-colors ${
                        activeSection === item.id
                          ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-200 font-medium'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'
                      }`}
                    >
                      {item.label}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0 max-w-2xl space-y-6">
        {/* Connect Extension */}
        <div id="chrome-extension" className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-9 h-9 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <Puzzle className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Connect Chrome Extension</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Sign in to the extension with your OutreachAI account to sync contacts and templates.
              </p>
            </div>
          </div>

          <ol className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 text-xs font-bold flex items-center justify-center mt-0.5">1</span>
              <span>Click the OutreachAI extension icon in your Chrome toolbar.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 text-xs font-bold flex items-center justify-center mt-0.5">2</span>
              <span>Under <strong className="text-gray-800 dark:text-gray-200">Dashboard Sync</strong>, enter your OutreachAI email and password, then click <strong className="text-gray-800 dark:text-gray-200">Connect to Dashboard</strong>.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 text-xs font-bold flex items-center justify-center mt-0.5">3</span>
              <span>Done — contacts, templates, and AI personalization will sync automatically.</span>
            </li>
          </ol>
        </div>

        {/* LinkedIn Account — OAuth */}
        <div id="linkedin" className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <span className="text-sm font-bold text-blue-600">in</span>
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">LinkedIn Account</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">Connect LinkedIn to enable auto-posting of your scheduled content.</p>
              </div>
            </div>
            {linkedInStatus?.connected && (
              <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                <CheckCircle2 className="w-3.5 h-3.5" /> Active
              </span>
            )}
          </div>

          {/* 2-step flow guide — shown when not yet connected */}
          {linkedInStatus !== null && !linkedInStatus.connected && (
            <div className="mb-4 flex items-center gap-0 text-xs font-medium">
              <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-l-lg border ${linkedInStatus.configured ? 'bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-200' : 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-200'}`}>
                <span className={`w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center flex-shrink-0 ${linkedInStatus.configured ? 'bg-emerald-500 text-white' : 'bg-blue-500 text-white'}`}>1</span>
                Save Client ID &amp; Secret
              </span>
              <span className="text-gray-300 dark:text-gray-600 px-1">→</span>
              <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-r-lg border ${linkedInStatus.configured ? 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-200' : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500'}`}>
                <span className={`w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center flex-shrink-0 ${linkedInStatus.configured ? 'bg-blue-500 text-white' : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-400'}`}>2</span>
                Authorize with LinkedIn
              </span>
            </div>
          )}

          {linkedInStatus === null ? (
            <div className="text-sm text-gray-400">Loading…</div>
          ) : linkedInStatus.connected && linkedInStatus.account ? (
            <div className="space-y-3">
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  Connected as: {linkedInStatus.account.name}
                </p>
                {linkedInStatus.account.email && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">{linkedInStatus.account.email}</p>
                )}
                {linkedInStatus.account.scope && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Scope: {linkedInStatus.account.scope.includes('w_member_social') ? 'w_member_social (can post)' : linkedInStatus.account.scope}
                  </p>
                )}
                {linkedInStatus.account.tokenExpiry && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Expires: {new Date(linkedInStatus.account.tokenExpiry).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                )}
              </div>
              <button
                onClick={disconnectLinkedIn}
                disabled={disconnecting}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-60"
              >
                {disconnecting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Disconnect
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Step 1 — Add your LinkedIn Developer App credentials */}
              {!linkedInStatus.configured && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Step 1 — Add your LinkedIn Developer App
                    </p>
                    <button onClick={() => setLiShowGuide(g => !g)} className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium">
                      {liShowGuide ? 'Hide guide ↑' : 'How to create one ↓'}
                    </button>
                    {linkedInAppSaved?.clientId && (
                      <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Saved
                      </span>
                    )}
                  </div>

                  {linkedInAppSaved?.clientId && !showLinkedInSetup ? (
                    <div className="flex items-center gap-3">
                      <div className="text-xs text-gray-500 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 flex-1">
                        Client ID: <span className="font-mono">{linkedInAppSaved.clientId}</span>
                      </div>
                      <button
                        onClick={() => setShowLinkedInSetup(true)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Update
                      </button>
                      <button
                        onClick={removeLinkedInApp}
                        className="text-xs text-red-500 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Developer Console Instructions — collapsible */}
                      {liShowGuide && (
                      <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 rounded-lg p-4 space-y-2 text-xs text-blue-800 dark:text-blue-200">
                        <p className="font-semibold text-sm">How to create a LinkedIn Developer App:</p>
                        <ol className="list-decimal list-inside space-y-1.5">
                          <li>Go to <a href="https://www.linkedin.com/developers/apps/new" target="_blank" rel="noopener noreferrer" className="underline font-medium">linkedin.com/developers/apps/new</a></li>
                          <li>Fill in App name (e.g. &quot;My OutreachAI&quot;), choose a LinkedIn Page, upload any logo</li>
                          <li>Under <strong>Products</strong>, request access to <strong>&quot;Sign In with LinkedIn using OpenID Connect&quot;</strong> and <strong>&quot;Share on LinkedIn&quot;</strong></li>
                          <li>Go to <strong>Auth</strong> tab → Authorized redirect URLs → add exactly:<br/>
                            <code className="bg-blue-100 dark:bg-blue-900 px-1.5 py-0.5 rounded font-mono text-xs break-all">
                              {process.env.NEXT_PUBLIC_APP_URL ?? 'https://outreachai.in'}/api/auth/linkedin/callback
                            </code>
                          </li>
                          <li>Copy <strong>Client ID</strong> and <strong>Client Secret</strong> from the Auth tab</li>
                        </ol>
                      </div>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Client ID</label>
                          <input
                            type="text"
                            value={linkedInAppForm.clientId}
                            onChange={e => setLinkedInAppForm(f => ({ ...f, clientId: e.target.value }))}
                            placeholder="e.g. 77abcd1234efgh"
                            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Client Secret</label>
                          <input
                            type="password"
                            value={linkedInAppForm.clientSecret}
                            onChange={e => setLinkedInAppForm(f => ({ ...f, clientSecret: e.target.value }))}
                            placeholder="Your LinkedIn app secret"
                            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                          />
                        </div>
                      </div>

                      {linkedInAppError && (
                        <p className="text-xs text-red-600">{linkedInAppError}</p>
                      )}

                      <div className="flex items-center gap-2">
                        <button
                          onClick={saveLinkedInApp}
                          disabled={linkedInAppSaving || !linkedInAppForm.clientId.trim() || !linkedInAppForm.clientSecret.trim()}
                          className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-60"
                        >
                          {linkedInAppSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          Save App Credentials
                        </button>
                        {showLinkedInSetup && (
                          <button onClick={() => setShowLinkedInSetup(false)} className="text-sm text-gray-500 hover:underline">
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 2 — Connect */}
              {linkedInStatus.configured && (
                <div className="space-y-2">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    App credentials saved. Authorize OutreachAI to post on your behalf.
                  </p>
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- OAuth redirect needs a full page load */}
                    <a
                      href="/api/auth/linkedin"
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                    >
                      Connect LinkedIn →
                    </a>
                    <button onClick={removeLinkedInApp} className="text-xs text-gray-400 hover:text-red-500 hover:underline">
                      Remove app credentials
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Email Accounts */}
        <div id="email-accounts" className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 bg-emerald-50 dark:bg-emerald-950 rounded-lg">
                <Mail className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">Email Accounts</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">SMTP accounts and Amazon SES for email outreach campaigns.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setAddingEmail(true); setAddingSES(false) }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-emerald-600 border border-emerald-200 rounded-lg hover:bg-emerald-50 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> SMTP
              </button>
              <button
                onClick={() => { setAddingSES(true); setAddingEmail(false); setAddingSendGrid(false) }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-orange-600 border border-orange-200 rounded-lg hover:bg-orange-50 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Amazon SES
              </button>
              <button
                onClick={() => { setAddingSendGrid(true); setAddingEmail(false); setAddingSES(false) }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> SendGrid
              </button>
            </div>
          </div>

          {addingSendGrid && (
            <div className="mt-3 border border-blue-200 dark:border-blue-900 rounded-xl bg-blue-50 dark:bg-gray-800 overflow-hidden">

              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-blue-100 dark:border-blue-900/50">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Connect SendGrid</p>
                <button
                  onClick={() => setSgShowGuide(g => !g)}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                >
                  {sgShowGuide ? 'Hide guide ↑' : 'How to set this up ↓'}
                </button>
              </div>

              {/* Step-by-step guide — collapsible */}
              {sgShowGuide && (
                <div className="px-4 py-3 bg-white dark:bg-gray-900 border-b border-blue-100 dark:border-blue-900/50 space-y-3">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">3 steps · takes ~5 minutes</p>

                  {/* Step 1 */}
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</div>
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Create a free SendGrid account</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Free tier gives you 100 emails/day. Paid plans start at $20/month for 50,000 emails.</p>
                      <a href="https://signup.sendgrid.com" target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
                        signup.sendgrid.com →
                      </a>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</div>
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Verify your from address</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">SendGrid will reject sends from unverified addresses. You can verify a single email (quick) or your whole domain (better deliverability).</p>
                      <div className="flex gap-3 mt-1.5">
                        <a href="https://app.sendgrid.com/settings/sender_auth/senders/new" target="_blank" rel="noopener noreferrer"
                          className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
                          Verify single sender →
                        </a>
                        <a href="https://app.sendgrid.com/settings/sender_auth" target="_blank" rel="noopener noreferrer"
                          className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
                          Authenticate domain →
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">3</div>
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Create an API key</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Go to <strong>Settings → API Keys → Create API Key</strong>. Choose <strong>Restricted Access</strong> and turn on <strong>Mail Send → Full Access</strong> only. Copy the key — it&apos;s shown once.
                      </p>
                      <a href="https://app.sendgrid.com/settings/api_keys" target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
                        Open API Keys page →
                      </a>
                    </div>
                  </div>

                  {/* Why BYOK note */}
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-100 dark:border-blue-900/50 mt-1">
                    <p className="text-xs text-blue-700 dark:text-blue-200">
                      <strong>Why your own account?</strong> Your sending reputation stays yours. If one sender on a shared platform gets flagged for spam, everyone else&apos;s email breaks too. Your own SendGrid keeps you isolated.
                    </p>
                  </div>
                </div>
              )}

              {/* Form */}
              <div className="px-4 py-3 space-y-2">
                {sgError && <p className="text-xs text-red-500">{sgError}</p>}
                <input type="text" placeholder="Sender name  (e.g.  Acme Marketing)" value={sgForm.name}
                  onChange={e => setSgForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400 dark:placeholder-gray-500" />
                <input type="email" placeholder="Verified from address  (e.g.  hello@yourdomain.com)" value={sgForm.email}
                  onChange={e => setSgForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400 dark:placeholder-gray-500" />
                <div className="relative">
                  <input type={sgShowKey ? 'text' : 'password'} placeholder="SendGrid API key  (SG.xxxxxxxxxx)" value={sgForm.sendgridApiKey}
                    onChange={e => setSgForm(f => ({ ...f, sendgridApiKey: e.target.value }))}
                    className="w-full pr-9 pl-3 py-2 text-sm font-mono text-gray-900 dark:text-white bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400 dark:placeholder-gray-500" />
                  <button type="button" onClick={() => setSgShowKey(p => !p)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {sgShowKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={addSendGridAccount} disabled={sgSaving || !sgForm.name || !sgForm.email || !sgForm.sendgridApiKey}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 transition-colors">
                    {sgSaving ? 'Saving…' : 'Save SendGrid account'}
                  </button>
                  <button onClick={() => { setAddingSendGrid(false); setSgError(null); setSgShowGuide(false) }}
                    className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
                </div>
              </div>
            </div>
          )}

          {emailAccounts.length === 0 && !addingEmail ? (
            <div className="text-center py-6 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">No email accounts connected yet.</p>
              <button onClick={() => setAddingEmail(true)} className="text-sm text-emerald-600 hover:underline">+ Connect SMTP account</button>
            </div>
          ) : (
            <div className="space-y-2">
              {emailAccounts.map(acc => {
                const expanded = expandedEmailId === acc.id
                return (
                  <div key={acc.id} className="bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden">
                    <div className="flex items-center gap-3 px-3 py-2.5">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center flex-shrink-0">
                        <Mail className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{acc.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {acc.provider === 'ses'
                            ? <>{acc.email} · AWS SES · {(acc as any).awsRegion}</>
                            : acc.provider === 'sendgrid'
                            ? <>{acc.email} · SendGrid</>
                            : <>{acc.email} · {acc.smtpHost}:{acc.smtpPort}</>
                          }
                          {acc.dailyLimit !== undefined && <> · {acc.dailyLimit}/day</>}
                          {acc.warmupActive && <> · <span className="text-amber-600">warming</span></>}
                        </p>
                      </div>
                      {acc.isDefault && <span className="text-xs bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full font-medium">Default</span>}
                      {testResults[acc.id] && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          testResults[acc.id]?.status === 'success'
                            ? 'bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400'
                            : 'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400'
                        }`}>
                          {testResults[acc.id]?.message}
                        </span>
                      )}
                      <button
                        onClick={() => testEmailAccount(acc.id)}
                        disabled={testingAccountId === acc.id}
                        className="text-xs text-blue-600 hover:underline font-medium px-2 disabled:opacity-60"
                      >
                        {testingAccountId === acc.id ? 'Testing…' : 'Test'}
                      </button>
                      <button
                        onClick={() => setExpandedEmailId(expanded ? null : acc.id)}
                        className="text-xs text-emerald-600 hover:underline font-medium px-2"
                      >
                        {expanded ? 'Hide' : 'Edit'}
                      </button>
                      <button onClick={() => removeEmailAccount(acc.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {expanded && (
                      <div className="px-3 pb-3 pt-1 border-t border-gray-200 dark:border-gray-700 space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Daily send limit
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={10000}
                            value={acc.dailyLimit ?? 50}
                            onChange={(e) => {
                              const v = Number(e.target.value)
                              setEmailAccounts(prev => prev.map(a => a.id === acc.id ? { ...a, dailyLimit: v } : a))
                            }}
                            onBlur={(e) => patchEmailAccount(acc.id, { dailyLimit: Number(e.target.value) })}
                            className="w-24 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-gray-900 dark:text-white"
                          />
                          <span className="ml-2 text-xs text-gray-400">emails / day</span>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Signature (appended to every send)
                          </label>
                          <textarea
                            rows={4}
                            value={acc.signature ?? ''}
                            onChange={(e) => setEmailAccounts(prev => prev.map(a => a.id === acc.id ? { ...a, signature: e.target.value } : a))}
                            onBlur={(e) => patchEmailAccount(acc.id, { signature: e.target.value })}
                            placeholder={"-- \nJane Doe\nCEO, Acme\nhttps://acme.com"}
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-gray-900 dark:text-white resize-none"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                            <input
                              type="checkbox"
                              checked={acc.warmupActive ?? false}
                              onChange={(e) => patchEmailAccount(acc.id, { warmupActive: e.target.checked })}
                              className="rounded border-gray-300"
                            />
                            Currently warming up (excluded from campaign sends)
                          </label>
                          {!acc.isDefault && (
                            <button
                              onClick={() => patchEmailAccount(acc.id, { isDefault: true })}
                              className="text-xs text-emerald-600 hover:underline font-medium"
                            >
                              Set as default
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {addingEmail && (
            <div className="mt-3 border border-emerald-200 dark:border-emerald-900 rounded-xl bg-emerald-50 dark:bg-gray-800 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-emerald-100 dark:border-emerald-900/50">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Connect SMTP account</p>
                <button onClick={() => setSmtpShowGuide(g => !g)} className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium">
                  {smtpShowGuide ? 'Hide guide ↑' : 'How to set this up ↓'}
                </button>
              </div>
              {smtpShowGuide && (
                <div className="px-4 py-3 bg-white dark:bg-gray-900 border-b border-emerald-100 dark:border-emerald-900/50 space-y-3">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Gmail app password · 3 steps</p>
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</div>
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Enable 2-Step Verification on your Google account</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Google blocks regular passwords for third-party apps. 2FA must be on before you can generate an app password.</p>
                      <a href="https://myaccount.google.com/security" target="_blank" rel="noopener noreferrer" className="inline-block mt-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline">myaccount.google.com/security →</a>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</div>
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Generate an App Password</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Go to <strong>Security → App passwords</strong> (you may need to search for it). Select app: <strong>Mail</strong>, device: <strong>Other</strong>, name it &quot;OutreachAI&quot;. Copy the 16-character password.</p>
                      <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="inline-block mt-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline">myaccount.google.com/apppasswords →</a>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">3</div>
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Fill in the form below</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">SMTP host: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">smtp.gmail.com</code> · Port: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">587</code> · Username: your Gmail address · Password: the 16-char app password.</p>
                    </div>
                  </div>
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-100 dark:border-amber-900/50">
                    <p className="text-xs text-amber-700 dark:text-amber-300"><strong>Limit:</strong> Gmail allows ~500 emails/day (free) or ~2,000/day (Google Workspace). For higher volume, use a dedicated sending service like SendGrid.</p>
                  </div>
                </div>
              )}
              <div className="px-4 py-3 space-y-2">
              {emailError && <p className="text-xs text-red-500">{emailError}</p>}
              {[
                { key: 'name', placeholder: 'Sender name (e.g. Your Name)', type: 'text' },
                { key: 'email', placeholder: 'From address (e.g. you@yourdomain.com)', type: 'email' },
                { key: 'smtpHost', placeholder: 'SMTP host (e.g. smtp.gmail.com)', type: 'text' },
                { key: 'smtpPort', placeholder: 'SMTP port (587 or 465)', type: 'number' },
                { key: 'smtpUser', placeholder: 'SMTP username (usually your email)', type: 'text' },
                { key: 'smtpPass', placeholder: 'SMTP password / app password', type: 'password' },
              ].map(({ key, placeholder, type }) => (
                <input
                  key={key}
                  type={type}
                  placeholder={placeholder}
                  value={emailForm[key as keyof typeof emailForm]}
                  onChange={e => setEmailForm(f => ({ ...f, [key]: e.target.value }))}
                  className="w-full px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400 dark:placeholder-gray-500"
                />
              ))}
              <div className="flex gap-2 pt-1">
                <button onClick={addEmailAccount} disabled={emailSaving} className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium disabled:opacity-60">
                  {emailSaving ? 'Saving…' : 'Save'}
                </button>
                <button onClick={() => { setAddingEmail(false); setEmailError(null); setSmtpShowGuide(false) }} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
              </div>
              </div>
            </div>
          )}

          {addingSES && (
            <div className="mt-3 border border-orange-200 dark:border-orange-900 rounded-xl bg-orange-50 dark:bg-gray-800 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-orange-100 dark:border-orange-900/50">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Connect Amazon SES</p>
                <button onClick={() => setSesShowGuide(g => !g)} className="text-xs text-orange-600 dark:text-orange-400 hover:underline font-medium">
                  {sesShowGuide ? 'Hide guide ↑' : 'How to set this up ↓'}
                </button>
              </div>
              {sesShowGuide && (
                <div className="px-4 py-3 bg-white dark:bg-gray-900 border-b border-orange-100 dark:border-orange-900/50 space-y-3">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">4 steps · takes ~15 minutes</p>
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-orange-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</div>
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Verify your sending domain or email</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">SES will only send from verified identities. Verifying a domain (better deliverability) requires adding DNS records. A single email address is simpler.</p>
                      <a href="https://console.aws.amazon.com/ses/home#/verified-identities" target="_blank" rel="noopener noreferrer" className="inline-block mt-1.5 text-xs font-medium text-orange-600 dark:text-orange-400 hover:underline">SES Verified Identities →</a>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-orange-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</div>
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Request production access <span className="text-red-500 font-semibold">(critical step)</span></p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">New SES accounts are in <strong>sandbox mode</strong> — you can only send to verified addresses. You must request production access to send to anyone. Takes 24–48 hours.</p>
                      <a href="https://console.aws.amazon.com/ses/home#/account" target="_blank" rel="noopener noreferrer" className="inline-block mt-1.5 text-xs font-medium text-orange-600 dark:text-orange-400 hover:underline">SES Account → Request Production Access →</a>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-orange-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">3</div>
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Create an IAM user with SES permission</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">IAM → Users → Create user → Attach policy: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded text-[11px]">AmazonSESFullAccess</code> (or a custom policy with just <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded text-[11px]">ses:SendEmail</code>).</p>
                      <a href="https://console.aws.amazon.com/iam/home#/users/create" target="_blank" rel="noopener noreferrer" className="inline-block mt-1.5 text-xs font-medium text-orange-600 dark:text-orange-400 hover:underline">IAM → Create User →</a>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-orange-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">4</div>
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Create an access key for the IAM user</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">In the IAM user → Security credentials → Create access key → Use case: Application code. Copy both the Access Key ID and Secret Access Key — secret shown once.</p>
                    </div>
                  </div>
                  <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-100 dark:border-red-900/50">
                    <p className="text-xs text-red-700 dark:text-red-200"><strong>⚠ Don&apos;t skip step 2.</strong> If your account is still in sandbox mode, every email to an unverified address will fail silently. Check your SES account dashboard before going live.</p>
                  </div>
                </div>
              )}
              <div className="px-4 py-3 space-y-2">
              {sesError && <p className="text-xs text-red-500">{sesError}</p>}
              <input type="text" placeholder="Sender name (e.g. Acme Marketing)" value={sesForm.name}
                onChange={e => setSesForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder-gray-400 dark:placeholder-gray-500" />
              <input type="email" placeholder="Verified from address (e.g. hello@yourdomain.com)" value={sesForm.email}
                onChange={e => setSesForm(f => ({ ...f, email: e.target.value }))}
                className="w-full px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder-gray-400 dark:placeholder-gray-500" />
              <select value={sesForm.awsRegion} onChange={e => setSesForm(f => ({ ...f, awsRegion: e.target.value }))}
                className="w-full px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500">
                {['us-east-1','us-west-2','eu-west-1','eu-central-1','ap-south-1','ap-southeast-1','ap-southeast-2','ap-northeast-1','ca-central-1','sa-east-1'].map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <input type="text" placeholder="AWS Access Key ID (AKIAIOSFODNN7EXAMPLE)" value={sesForm.awsAccessKeyId}
                onChange={e => setSesForm(f => ({ ...f, awsAccessKeyId: e.target.value }))}
                className="w-full px-3 py-2 text-sm font-mono text-gray-900 dark:text-white bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder-gray-400 dark:placeholder-gray-500" />
              <div className="relative">
                <input type={sesShowSecret ? 'text' : 'password'} placeholder="AWS Secret Access Key" value={sesForm.awsSecretAccessKey}
                  onChange={e => setSesForm(f => ({ ...f, awsSecretAccessKey: e.target.value }))}
                  className="w-full pr-9 pl-3 py-2 text-sm font-mono text-gray-900 dark:text-white bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder-gray-400 dark:placeholder-gray-500" />
                <button type="button" onClick={() => setSesShowSecret(p => !p)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {sesShowSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={addSESAccount} disabled={sesSaving} className="px-4 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium disabled:opacity-60">
                  {sesSaving ? 'Saving…' : 'Save SES account'}
                </button>
                <button onClick={() => { setAddingSES(false); setSesError(null); setSesShowGuide(false) }} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
              </div>
              </div>
            </div>
          )}
        </div>

        {/* Billing */}
        <section id="billing" className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Billing</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-700 dark:text-gray-300">Current plan</p>
              <p className="text-xs text-gray-400 mt-0.5">Free plan — upgrade to unlock unlimited campaigns</p>
            </div>
            <button
              onClick={handleManageBilling}
              disabled={billingLoading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {billingLoading ? 'Loading…' : 'Manage billing'}
            </button>
          </div>
        </section>

        {/* Account */}
        {/* AI Providers */}
        <div id="ai-providers" className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex items-center justify-center w-9 h-9 bg-purple-50 dark:bg-purple-950 rounded-lg">
              <Bot className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">AI Providers</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Add API keys to enable AI features. Keys are stored encrypted.</p>
            </div>
          </div>

          <div className="space-y-4">
            {AI_PROVIDERS.map(p => {
              const isSaved = aiConfigured[p.id]
              const hasNewInput = !!aiKeys[p.id]?.trim()
              const isShowingMask = isSaved && !hasNewInput
              const canSave = hasNewInput

              return (
                <div key={p.id} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{p.label}</span>
                      {isSaved ? (
                        <span className="flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                          Connected
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs font-medium text-gray-400 dark:text-gray-500">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block" />
                          Not Configured
                        </span>
                      )}
                    </div>
                    <a href={p.docsUrl} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline">Get API key →</a>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{p.hint}</p>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type={isShowingMask ? 'text' : (aiShow[p.id] ? 'text' : 'password')}
                        placeholder={isShowingMask ? undefined : p.placeholder}
                        value={isShowingMask ? '••••••••••••••••' : (aiKeys[p.id] ?? '')}
                        onChange={e => {
                          const raw = e.target.value.replace(/[•]/g, '')
                          setAiKeys(prev => ({ ...prev, [p.id]: raw }))
                        }}
                        className={cn(
                          'w-full pr-9 pl-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-400 dark:placeholder-gray-500',
                          isShowingMask ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'
                        )}
                      />
                      <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => {
                              if (isShowingMask) {
                                setAiEyeTooltip(prev => ({ ...prev, [p.id]: true }))
                                setTimeout(() => setAiEyeTooltip(prev => ({ ...prev, [p.id]: false })), 3000)
                              } else {
                                setAiShow(prev => ({ ...prev, [p.id]: !prev[p.id] }))
                              }
                            }}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                          >
                            {aiShow[p.id] && !isShowingMask ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                          {aiEyeTooltip[p.id] && (
                            <div className="absolute right-0 bottom-7 w-60 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg px-3 py-2 shadow-lg z-10 leading-snug">
                              For security, saved keys cannot be viewed. Paste a new key to replace it.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => saveAiKey(p.id, p.envKey)}
                      disabled={!canSave || aiSaving === p.id}
                      className="px-3 py-2 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
                    >
                      {aiSaved === p.id ? '✓ Saved' : aiSaving === p.id ? 'Saving…' : isSaved ? 'Update' : 'Save'}
                    </button>
                    {isSaved && (
                      <button
                        onClick={() => clearAiKey(p.id)}
                        disabled={aiClearing === p.id}
                        className="px-3 py-2 text-sm font-medium text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50 whitespace-nowrap transition-colors"
                      >
                        {aiClearing === p.id ? 'Removing…' : 'Disconnect'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
            After saving, set <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">AI_PROVIDER=anthropic</code> (or <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">openai</code> / <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">gemini</code>) in your Vercel env vars to switch the active model.
          </p>
        </div>

        {/* Enrichment API Keys */}
        <div id="enrichment-keys" className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex items-center justify-center w-9 h-9 bg-teal-50 dark:bg-teal-950 rounded-lg">
              <Search className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Enrichment API Keys</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Auto-fill contact data like email, phone, and company info.</p>
            </div>
          </div>

          <div className="space-y-4">
            {ENRICHMENT_PROVIDERS.map(p => (
              <div key={p.id} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{p.label}</span>
                  <a href={p.docsUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">Get API key →</a>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{p.hint}</p>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={enrichShow[p.id] ? 'text' : 'password'}
                      placeholder={p.placeholder}
                      value={enrichKeys[p.id] ?? ''}
                      onChange={e => setEnrichKeys(prev => ({ ...prev, [p.id]: e.target.value }))}
                      className="w-full pr-9 pl-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    <button type="button"
                      onClick={() => setEnrichShow(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {enrichShow[p.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <button
                    onClick={() => saveEnrichKey(p.id)}
                    disabled={!enrichKeys[p.id]?.trim() || enrichSaving === p.id}
                    className="px-3 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
                  >
                    {enrichSaved === p.id ? '✓ Saved' : enrichSaving === p.id ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* WhatsApp */}
        <div id="whatsapp" className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg" style={{ backgroundColor: '#dcfce7' }}>
                <span className="text-lg leading-none">📱</span>
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">WhatsApp</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">Connect your mfapis instance to send and receive WhatsApp messages in sequences.</p>
              </div>
            </div>
            {(waSaved.waApiKey || waSaved.waBaseUrl) && (
              <button onClick={disconnectWa} className="text-xs text-red-500 hover:text-red-700 font-medium">Disconnect</button>
            )}
          </div>

          {/* WhatsApp setup guide */}
          {waShowGuide && (
            <div className="mb-5 border border-green-200 dark:border-green-900 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-green-50 dark:bg-green-950/30 border-b border-green-100 dark:border-green-900/50 space-y-3">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">3 steps · takes ~10 minutes</p>
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-white text-xs font-bold" style={{ backgroundColor: '#25D366' }}>1</div>
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Get a hosted mfapis account</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">mfapis is the backend service that bridges WhatsApp Web and OutreachAI. You need a Base URL and an Org API Key from your mfapis instance.</p>
                    <a href="https://app2.mfapis.club" target="_blank" rel="noopener noreferrer" className="inline-block mt-1.5 text-xs font-medium hover:underline" style={{ color: '#25D366' }}>app2.mfapis.club →</a>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-white text-xs font-bold" style={{ backgroundColor: '#25D366' }}>2</div>
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Copy your Base URL and Org API Key</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">In your mfapis dashboard, find the Base URL (e.g. <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded text-[11px]">https://app2.mfapis.club</code>) and your organisation&apos;s API key. Paste both below.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-white text-xs font-bold" style={{ backgroundColor: '#25D366' }}>3</div>
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Register the inbound webhook URL</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">In mfapis, add this webhook URL so incoming WhatsApp replies reach OutreachAI:</p>
                    <code className="block mt-1 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-[11px] font-mono break-all text-gray-700 dark:text-gray-300">
                      {typeof window !== 'undefined' ? window.location.origin : 'https://outreachai.in'}/api/webhooks/whatsapp
                    </code>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 1 — credentials */}
          <div className="space-y-3 mb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Step 1 — mfapis credentials</p>
              <button onClick={() => setWaShowGuide(g => !g)} className="text-xs text-gray-500 dark:text-gray-400 hover:underline">
                {waShowGuide ? 'Hide setup guide ↑' : 'Setup guide ↓'}
              </button>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Base URL</label>
              <input type="url" placeholder={WA_DEFAULT_BASE_URL}
                value={waForm.waBaseUrl}
                onChange={e => setWaForm(p => ({ ...p, waBaseUrl: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#25D366]"
              />
              {waSaved.waBaseUrl && <p className="text-xs text-gray-400 mt-1">Saved: {waSaved.waBaseUrl}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Org API Key</label>
              <div className="relative">
                <input type={waShowKey ? 'text' : 'password'} placeholder="mfapis org API key"
                  value={waForm.waApiKey}
                  onChange={e => setWaForm(p => ({ ...p, waApiKey: e.target.value }))}
                  className="w-full pr-9 pl-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                />
                <button type="button" onClick={() => setWaShowKey(p => !p)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {waShowKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {waSaved.waApiKey && <p className="text-xs text-gray-400 mt-1">Saved: {waSaved.waApiKey}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Webhook Secret <span className="font-normal text-gray-400">(optional)</span></label>
              <div className="relative">
                <input type={waShowSecret ? 'text' : 'password'} placeholder="HMAC secret for verifying inbound webhooks"
                  value={waForm.waWebhookSecret}
                  onChange={e => setWaForm(p => ({ ...p, waWebhookSecret: e.target.value }))}
                  className="w-full pr-9 pl-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                />
                <button type="button" onClick={() => setWaShowSecret(p => !p)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {waShowSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-xs text-gray-500 dark:text-gray-400 font-mono">
              Inbound webhook URL (register this in mfapis):<br />
              <span className="text-gray-700 dark:text-gray-300 break-all select-all">
                {typeof window !== 'undefined' ? window.location.origin : 'https://outreachai.in'}/api/webhooks/whatsapp
              </span>
            </div>
            {waError && <p className="text-xs text-red-500">{waError}</p>}
            <button onClick={saveWaSettings} disabled={waSaving}
              className="px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors disabled:opacity-50"
              style={{ backgroundColor: '#25D366' }}>
              {waOk ? '✓ Saved' : waSaving ? 'Saving…' : 'Save credentials'}
            </button>
          </div>

          {/* Step 2 — phone connection (only shown once credentials saved) */}
          {waCredentialsSet && (
            <div className="border-t border-gray-100 dark:border-gray-800 pt-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Step 2 — connect a phone</p>
                <button onClick={addWaPhone} disabled={waPhoneAdding}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-white px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors"
                  style={{ backgroundColor: '#25D366' }}>
                  {waPhoneAdding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                  Add phone
                </button>
              </div>

              {waPhoneLoading ? (
                <p className="text-xs text-gray-400">Loading phones…</p>
              ) : waPhones.length === 0 ? (
                <p className="text-xs text-gray-400">No phones yet. Click &ldquo;Add phone&rdquo; to create a session, then scan the QR code.</p>
              ) : (
                <div className="space-y-2">
                  {waPhones.map(phone => {
                    const connected = phone.wa_state === 'CONNECTED'
                    return (
                      <div key={phone.phone_id} className={`flex items-center gap-3 p-3 rounded-lg border text-sm transition-colors ${connected ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm ${connected ? 'bg-green-100 dark:bg-green-900' : 'bg-gray-200 dark:bg-gray-700'}`}>
                          {connected ? '✅' : '📵'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 dark:text-white text-xs">
                            {phone.org_phone ? `+${phone.org_phone}` : 'Linking…'}
                          </p>
                          <p className={`text-xs mt-0.5 ${connected ? 'text-green-600' : 'text-gray-400'}`}>
                            {connected ? 'Connected' : phone.qr_code ? 'Waiting for scan' : 'Disconnected'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {!connected && (
                            <>
                              <button onClick={() => showWaQr(phone)}
                                className="text-xs px-2 py-1 rounded-md border border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-700 transition-colors">
                                QR
                              </button>
                              <button onClick={() => { setWaPairPhone(phone); setWaPairCode(null); setWaPairNumber(''); setWaPairOpen(true) }}
                                className="text-xs px-2 py-1 rounded-md border border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-700 transition-colors">
                                Link
                              </button>
                            </>
                          )}
                          <button onClick={() => deleteWaPhone(phone)} className="text-xs px-2 py-1 rounded-md text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition-colors">
                            ✕
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* QR code modal */}
        {waQrOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => { setWaQrOpen(false); setWaQrDataUrl(null) }}>
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-72 text-center shadow-xl" onClick={e => e.stopPropagation()}>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">Scan to connect</h3>
              {waQrLoading ? (
                <div className="w-60 h-60 mx-auto flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-xl">
                  <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                </div>
              ) : waQrDataUrl && !waQrExpired ? (
                <div className="flex flex-col items-center gap-2">
                  <img src={waQrDataUrl} alt="QR Code" className="w-60 h-60 rounded-xl" />
                  <WaQrCountdown key={waQrDataUrl} onExpired={() => setWaQrExpired(true)} />
                </div>
              ) : (
                <div className="w-60 h-60 mx-auto flex flex-col items-center justify-center gap-3 bg-gray-100 dark:bg-gray-800 rounded-xl">
                  <p className="text-xs text-gray-500">{waQrExpired ? 'QR code expired' : 'QR not available'}</p>
                  <button onClick={() => waQrPhone && showWaQr(waQrPhone)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-700">
                    Refresh QR
                  </button>
                </div>
              )}
              <div className="mt-4 space-y-1 text-xs text-gray-500 dark:text-gray-400">
                <p className="font-medium text-gray-700 dark:text-gray-300">Open WhatsApp on your phone:</p>
                <p>Android: ⋯ → Linked Devices → Link a Device</p>
                <p>iPhone: Settings → Linked Devices → Link a Device</p>
              </div>
              <button onClick={() => { setWaQrOpen(false); setWaQrDataUrl(null) }}
                className="mt-4 text-xs text-gray-400 hover:text-gray-600">Close</button>
            </div>
          </div>
        )}

        {/* Pairing code modal */}
        {waPairOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => { setWaPairOpen(false); setWaPairCode(null); setWaPairConnected(false) }}>
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-72 shadow-xl" onClick={e => e.stopPropagation()}>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 text-center">Link with phone number</h3>
              {waPairConnected ? (
                <div className="flex flex-col items-center gap-3 py-6">
                  <span className="text-4xl">✅</span>
                  <p className="text-sm font-medium text-green-600">Phone connected!</p>
                </div>
              ) : !waPairCode ? (
                <div className="space-y-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Enter your WhatsApp number (with country code) to get a pairing code.</p>
                  <input type="tel" placeholder="+91 98765 43210" value={waPairNumber}
                    onChange={e => setWaPairNumber(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                  />
                  <button onClick={requestWaPairCode} disabled={waPairLoading || !waPairNumber.trim()}
                    className="w-full py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50"
                    style={{ backgroundColor: '#25D366' }}>
                    {waPairLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Get Pairing Code'}
                  </button>
                </div>
              ) : (
                <div className="space-y-3 text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Enter this code in WhatsApp → Settings → Linked Devices → Link with phone number instead</p>
                  <div className="bg-gray-100 dark:bg-gray-800 rounded-xl py-5">
                    <p className="text-2xl font-bold tracking-[0.3em] font-mono text-gray-900 dark:text-white">{waPairCode}</p>
                  </div>
                  <p className="text-xs text-gray-400">Expires in ~2 minutes</p>
                  <button onClick={requestWaPairCode} disabled={waPairLoading}
                    className="w-full py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                    {waPairLoading ? 'Loading…' : 'Get New Code'}
                  </button>
                </div>
              )}
              <button onClick={() => { setWaPairOpen(false); setWaPairCode(null); setWaPairConnected(false) }}
                className="mt-4 w-full text-xs text-gray-400 hover:text-gray-600 text-center">Close</button>
            </div>
          </div>
        )}

        {/* Snippets (Plan 7) */}
        <div id="snippets"><SnippetsSection /></div>

        {/* Schedules (Plan 7) */}
        <div id="schedules"><SchedulesSection /></div>

        {/* Conversation Labels (Plan 7) */}
        <div id="labels"><ConversationLabelsSection /></div>

        {/* Custom fields (Plan 5) */}
        <div id="custom-fields"><CustomFieldsSection /></div>

        {/* Auto-draft AI replies (Plan 8) */}
        <div id="auto-draft"><AutoDraftSection /></div>

        {/* Webhooks */}
        <div id="webhooks" className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 bg-orange-50 dark:bg-orange-950 rounded-lg">
                <Webhook className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">Webhooks</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">Get notified when events happen in your account.</p>
              </div>
            </div>
            <button onClick={() => setAddingWebhook(true)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700">
              <Plus className="w-4 h-4" /> Add endpoint
            </button>
          </div>

          {whError && <p className="text-xs text-red-500 mb-3">{whError}</p>}

          {addingWebhook && (
            <div className="mb-4 p-4 border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-gray-800 rounded-lg space-y-3">
              <input type="url" placeholder="https://your-server.com/webhook"
                value={whForm.url} onChange={e => setWhForm(p => ({ ...p, url: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500" />
              <input type="password" placeholder="Secret (optional — for HMAC signature)"
                value={whForm.secret} onChange={e => setWhForm(p => ({ ...p, secret: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500" />
              <div>
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Events to subscribe:</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {WEBHOOK_EVENTS.map(ev => (
                    <label key={ev} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
                      <input type="checkbox" checked={whForm.events.includes(ev)} onChange={() => toggleEvent(ev)}
                        className="rounded border-gray-300 text-orange-600" />
                      {ev}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={addWebhook} disabled={whSaving}
                  className="flex items-center gap-1.5 px-3 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors">
                  {whSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save endpoint
                </button>
                <button onClick={() => { setAddingWebhook(false); setWhError(null) }}
                  className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {webhooks.length === 0 && !addingWebhook ? (
            <div className="text-center py-6 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">No webhooks configured yet.</p>
              <button onClick={() => setAddingWebhook(true)} className="text-sm text-orange-600 hover:underline">+ Add your first endpoint</button>
            </div>
          ) : (
            <div className="space-y-2">
              {webhooks.map(wh => (
                <div key={wh.id} className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{wh.url}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {wh.events.map(ev => (
                        <span key={ev} className="text-[10px] px-1.5 py-0.5 bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300 rounded font-medium">{ev}</span>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{wh.deliveryCount} deliveries{wh.hasSecret ? ' · signed' : ''}</p>
                  </div>
                  <button onClick={() => testWebhook(wh.id)} disabled={whTesting === wh.id}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium disabled:opacity-60 flex-shrink-0">
                    {whTesting === wh.id ? '✓ Sent' : 'Test'}
                  </button>
                  <button onClick={() => deleteWebhook(wh.id)} className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* MCP Server */}
        <div id="mcp-server" className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex items-center justify-center w-9 h-9 bg-violet-50 dark:bg-violet-950 rounded-lg">
              <Terminal className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">MCP Server</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Connect OutreachAI to Claude Desktop or Claude Code as an AI agent.</p>
            </div>
          </div>

          {mcpToken && userId ? (
            <div className="space-y-4">
              {/* Claude Desktop */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Claude Desktop</p>
                  <p className="text-[10px] text-gray-400">Add to <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">claude_desktop_config.json</code> → mcpServers</p>
                </div>
                <div className="relative">
                  <pre className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-xs text-gray-600 dark:text-gray-400 overflow-x-auto whitespace-pre font-mono leading-relaxed">{getMcpDesktopConfig()}</pre>
                  <button
                    onClick={() => copyMcp('desktop')}
                    className={`absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors border ${
                      mcpCopied === 'desktop'
                        ? 'border-green-200 bg-green-50 text-green-700'
                        : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {mcpCopied === 'desktop' ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                  </button>
                </div>
              </div>

              {/* Claude Code */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Claude Code</p>
                  <p className="text-[10px] text-gray-400">Add to <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">.mcp.json</code> → mcpServers</p>
                </div>
                <div className="relative">
                  <pre className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-xs text-gray-600 dark:text-gray-400 overflow-x-auto whitespace-pre font-mono leading-relaxed">{getMcpCodeConfig()}</pre>
                  <button
                    onClick={() => copyMcp('code')}
                    className={`absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors border ${
                      mcpCopied === 'code'
                        ? 'border-green-200 bg-green-50 text-green-700'
                        : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {mcpCopied === 'code' ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                  </button>
                </div>
              </div>

              <p className="text-xs text-gray-400 dark:text-gray-500">
                After adding the config, reload your Claude client. The <span className="font-medium text-gray-600 dark:text-gray-300">outreachai</span> server will appear with {13} tools for managing leads, campaigns, sequences, and inbox.
              </p>
            </div>
          ) : (
            <div className="text-sm text-gray-400">Loading…</div>
          )}
        </div>

        {/* Meeting link */}
        <div id="meeting" className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex items-center justify-center w-9 h-9 bg-indigo-50 dark:bg-indigo-950 rounded-lg">
              <CalendarDays className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Meeting link</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Create a public booking page so prospects can schedule time with you.</p>
            </div>
          </div>

          {meetingPage && (
            <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl px-3 py-2 mb-5">
              <span className="text-xs text-indigo-600 dark:text-indigo-400 font-mono flex-1 truncate">
                outreachai.in/meet/{meetingPage.slug}
              </span>
              <button
                onClick={copyMeetingLink}
                className="flex-shrink-0 text-indigo-600 hover:text-indigo-800 transition-colors"
                title="Copy link"
              >
                {meetingLinkCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
              <a
                href={`/meet/${meetingPage.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-indigo-600 hover:text-indigo-800 transition-colors font-medium"
              >
                Preview
              </a>
            </div>
          )}

          {meetingSaved && (
            <div className="flex items-center gap-2 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-200 text-sm px-3 py-2 rounded-lg mb-4">
              <Check className="w-4 h-4" /> Meeting page saved.
            </div>
          )}
          {meetingError && (
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 text-sm px-3 py-2 rounded-lg mb-4">{meetingError}</div>
          )}

          <div className="space-y-4">
            {/* Slug */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Your booking URL
              </label>
              <div className="flex items-center rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <span className="bg-gray-50 dark:bg-gray-800 text-gray-500 text-xs px-3 py-2.5 border-r border-gray-200 dark:border-gray-700 whitespace-nowrap">
                  outreachai.in/meet/
                </span>
                <input
                  type="text"
                  placeholder="your-name"
                  value={meetingForm.slug}
                  onChange={e => setMeetingForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                  className="flex-1 px-3 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <p className="text-[11px] text-gray-400 mt-1">3–40 characters: lowercase letters, numbers, hyphens</p>
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Page title</label>
              <input
                type="text"
                placeholder="Book a meeting"
                value={meetingForm.title}
                onChange={e => setMeetingForm(f => ({ ...f, title: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Description (optional)</label>
              <textarea
                rows={2}
                placeholder="Book a call to discuss your outreach strategy"
                value={meetingForm.description}
                onChange={e => setMeetingForm(f => ({ ...f, description: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>

            {/* Duration + Buffer row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Duration</label>
                <select
                  value={meetingForm.duration}
                  onChange={e => setMeetingForm(f => ({ ...f, duration: Number(e.target.value) }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {[15, 30, 45, 60].map(d => (
                    <option key={d} value={d}>{d} minutes</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Buffer between bookings</label>
                <select
                  value={meetingForm.bufferMins}
                  onChange={e => setMeetingForm(f => ({ ...f, bufferMins: Number(e.target.value) }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {[0, 5, 10, 15, 30, 60].map(b => (
                    <option key={b} value={b}>{b === 0 ? 'No buffer' : `${b} minutes`}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Timezone */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Timezone</label>
              <select
                value={meetingForm.timezone}
                onChange={e => setMeetingForm(f => ({ ...f, timezone: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {[
                  'Asia/Kolkata', 'UTC', 'America/New_York', 'America/Chicago',
                  'America/Los_Angeles', 'Europe/London', 'Europe/Berlin',
                  'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney',
                ].map(tz => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>

            {/* Availability */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Availability</label>
              <div className="space-y-2">
                {(['mon','tue','wed','thu','fri','sat','sun'] as const).map(day => {
                  const labels: Record<string, string> = { mon:'Monday',tue:'Tuesday',wed:'Wednesday',thu:'Thursday',fri:'Friday',sat:'Saturday',sun:'Sunday' }
                  const val = meetingHours[day]
                  const hours = Array.from({ length: 17 }, (_, i) => i + 6) // 6am–10pm
                  return (
                    <div key={day} className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id={`day-${day}`}
                        checked={val.enabled}
                        onChange={e => setMeetingHours(h => ({ ...h, [day]: { ...h[day], enabled: e.target.checked } }))}
                        className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                      />
                      <label htmlFor={`day-${day}`} className="text-xs font-medium text-gray-700 dark:text-gray-300 w-20">{labels[day]}</label>
                      {val.enabled && (
                        <>
                          <select
                            value={val.start}
                            onChange={e => setMeetingHours(h => ({ ...h, [day]: { ...h[day], start: Number(e.target.value) } }))}
                            className="text-xs px-2 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                          >
                            {hours.map(h => <option key={h} value={h}>{h === 12 ? '12:00 PM' : h < 12 ? `${h}:00 AM` : `${h-12}:00 PM`}</option>)}
                          </select>
                          <span className="text-xs text-gray-400">to</span>
                          <select
                            value={val.end}
                            onChange={e => setMeetingHours(h => ({ ...h, [day]: { ...h[day], end: Number(e.target.value) } }))}
                            className="text-xs px-2 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                          >
                            {hours.map(h => <option key={h} value={h}>{h === 12 ? '12:00 PM' : h < 12 ? `${h}:00 AM` : `${h-12}:00 PM`}</option>)}
                          </select>
                        </>
                      )}
                      {!val.enabled && (
                        <span className="text-xs text-gray-400">Unavailable</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <button
              onClick={saveMeetingPage}
              disabled={meetingSaving || !meetingForm.slug}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {meetingSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {meetingPage ? 'Save changes' : 'Create booking page'}
            </button>
          </div>
        </div>

        {/* Password */}
        <div id="password" className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex items-center justify-center w-9 h-9 bg-rose-50 dark:bg-rose-950 rounded-lg">
              <Lock className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                {hasPassword === false ? 'Set a password' : 'Change password'}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {hasPassword === false
                  ? 'Add email + password login to your Google account.'
                  : 'Update your current password.'}
              </p>
            </div>
          </div>

          {pwSaved && (
            <div className="flex items-center gap-2 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-200 text-sm px-4 py-3 rounded-lg mb-4">
              <Check className="w-4 h-4" /> Password saved successfully.
            </div>
          )}
          {pwError && (
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 text-sm px-4 py-3 rounded-lg mb-4">{pwError}</div>
          )}

          <div className="space-y-3">
            {hasPassword && (
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Current password</label>
                <input
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter current password"
                  value={pwForm.current}
                  onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">New password</label>
              <input
                type="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={pwForm.next}
                onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Confirm new password</label>
              <input
                type="password"
                autoComplete="new-password"
                placeholder="Repeat new password"
                value={pwForm.confirm}
                onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
            <button
              onClick={savePassword}
              disabled={pwSaving || !pwForm.next || !pwForm.confirm}
              className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {pwSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {hasPassword === false ? 'Set password' : 'Update password'}
            </button>
          </div>
        </div>

        {/* Website tracking */}
        <div id="website-tracking" className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 bg-emerald-50 dark:bg-emerald-950 rounded-lg">
                <Globe className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">Website tracking</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">Identify companies visiting your website with one script tag</p>
              </div>
            </div>
            {trackingId && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 rounded-full border border-emerald-100 dark:border-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Active
              </span>
            )}
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            Paste this snippet in the <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-[11px]">&lt;head&gt;</code> of your website to start tracking visitors.
          </p>

          <div className="relative">
            <pre className="bg-gray-900 text-emerald-400 text-xs rounded-lg p-4 overflow-x-auto font-mono leading-relaxed">
              {trackingSnippet ?? 'Loading…'}
            </pre>
            <button
              onClick={copyTrackingSnippet}
              disabled={!trackingSnippet}
              className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-300 text-xs font-medium transition-colors"
            >
              {snippetCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {snippetCopied ? 'Copied!' : 'Copy snippet'}
            </button>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Tracking ID: <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded font-mono text-[11px] text-gray-600 dark:text-gray-300">{trackingId ?? '—'}</code>
            </p>
            <a
              href="/signals/website"
              className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
            >
              View visitor analytics →
            </a>
          </div>
        </div>

        {/* Account */}
        <div id="account" className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-9 h-9 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <User className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Account</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Your profile details.</p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Email address</label>
              <div suppressHydrationWarning className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300">
                {userEmail || '—'}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="text-sm text-red-600 hover:text-red-700 font-medium transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}
