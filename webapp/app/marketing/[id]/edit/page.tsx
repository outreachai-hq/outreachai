'use client'

import { useState, useEffect, use } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Send, Loader2, FlaskConical, Code2 } from 'lucide-react'
import { RichTextEditor } from '@/components/RichTextEditor'

interface MarketingCampaign {
  id: string
  name: string
  subject: string
  fromName: string
  htmlBody: string
  status: string
  abEnabled: boolean
  abSubjectB: string | null
  abSplitPercent: number
  abWinnerMetric: string
  abTestDurationHours: number
  _count: { sends: number }
  emailAccount: { id: string; name: string; email: string } | null
  leadList: { id: string; name: string } | null
}

const STATUS_STYLES: Record<string, string> = {
  draft:      'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300',
  scheduled:  'bg-yellow-50 text-yellow-700 border border-yellow-200 dark:bg-yellow-900/60 dark:text-yellow-300 dark:border-yellow-700/50',
  sending:    'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-600/50',
  sent:       'bg-green-50 text-green-700 border border-green-200 dark:bg-green-900 dark:text-green-200 dark:border-green-600/50',
  ab_testing: 'bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-900 dark:text-purple-200 dark:border-purple-600/50',
}

const STATUS_LABEL: Record<string, string> = {
  ab_testing: 'A/B Testing',
}

export default function MarketingEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { status } = useSession()
  const router = useRouter()

  const [campaign, setCampaign] = useState<MarketingCampaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [subject, setSubject] = useState('')
  const [fromName, setFromName] = useState('')
  const [htmlBody, setHtmlBody] = useState('')

  // A/B state
  const [abEnabled, setAbEnabled] = useState(false)
  const [abSubjectB, setAbSubjectB] = useState('')
  const [abSplitPercent, setAbSplitPercent] = useState(20)
  const [abWinnerMetric, setAbWinnerMetric] = useState<'open' | 'click'>('open')
  const [abTestDurationHours, setAbTestDurationHours] = useState(4)

  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [sendMsg, setSendMsg] = useState('')
  const [sendError, setSendError] = useState('')
  const [testing, setTesting] = useState(false)
  const [testMsg, setTestMsg] = useState('')
  const [testError, setTestError] = useState('')
  const [htmlMode, setHtmlMode] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login')
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return

    fetch(`/api/marketing/campaigns/${id}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); return null }
        return r.ok ? r.json() : null
      })
      .then((data) => {
        if (data) {
          setCampaign(data)
          setSubject(data.subject)
          setFromName(data.fromName)
          setHtmlBody(data.htmlBody)
          setAbEnabled(data.abEnabled ?? false)
          setAbSubjectB(data.abSubjectB ?? '')
          setAbSplitPercent(data.abSplitPercent ?? 20)
          setAbWinnerMetric(data.abWinnerMetric ?? 'open')
          setAbTestDurationHours(data.abTestDurationHours ?? 4)
        }
      })
      .finally(() => setLoading(false))
  }, [status, id])

  async function handleSave() {
    setSaving(true)
    setSaveMsg('')
    const res = await fetch(`/api/marketing/campaigns/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject, fromName, htmlBody,
        abEnabled, abSubjectB: abSubjectB || null,
        abSplitPercent, abWinnerMetric, abTestDurationHours,
      }),
    })
    setSaving(false)
    if (res.ok) {
      setSaveMsg('Draft saved.')
      setTimeout(() => setSaveMsg(''), 3000)
    } else {
      const d = await res.json().catch(() => ({}))
      setSaveMsg(d.error ?? 'Failed to save.')
    }
  }

  async function handleSend() {
    const leadListName = campaign?.leadList?.name ?? 'your list'
    const isAb = abEnabled && abSubjectB.trim()
    const confirmMsg = isAb
      ? `This will start an A/B test with ~${Math.floor((campaign?._count?.sends ?? 0) * abSplitPercent / 100 / 2)} recipients per variant from "${leadListName}". Continue?`
      : `This will send to all leads in "${leadListName}". Are you sure?`

    if (!window.confirm(confirmMsg)) return

    setSending(true)
    setSendMsg('')
    setSendError('')

    const res = await fetch(`/api/marketing/campaigns/${id}/send`, { method: 'POST' })
    setSending(false)

    if (res.ok) {
      const data = await res.json()
      if (data.mode === 'ab_testing') {
        setSendMsg(`A/B test started: ${data.sentA} to variant A, ${data.sentB} to variant B. ${data.held} held for winner.`)
      } else {
        setSendMsg(`Sent to ${data.sent} recipient${data.sent !== 1 ? 's' : ''}${data.skipped > 0 ? ` (${data.skipped} skipped)` : ''}.`)
      }
      const updated = await fetch(`/api/marketing/campaigns/${id}`).then((r) => (r.ok ? r.json() : null))
      if (updated) setCampaign(updated)
    } else {
      const data = await res.json().catch(() => ({}))
      setSendError(data.error ?? 'Failed to send. Please try again.')
    }
  }

  async function handleTest() {
    setSending(true)
    setTestMsg('')
    setTestError('')

    const res = await fetch(`/api/marketing/campaigns/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignId: id }),
    })
    setSending(false)

    if (res.ok) {
      const data = await res.json()
      setTestMsg(`✅ Test email sent to ${data.recipient}`)
      setTimeout(() => setTestMsg(''), 5000)
    } else {
      const data = await res.json().catch(() => ({}))
      setTestError(data.error ?? 'Failed to send test email.')
    }
  }


  if (status === 'loading' || loading) {
    return <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
  }

  if (notFound || !campaign) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500 dark:text-gray-400">Campaign not found.</p>
        <Link href="/marketing" className="mt-3 inline-block text-sm text-blue-600 hover:underline">
          Back to Marketing
        </Link>
      </div>
    )
  }

  const inputClass =
    'w-full px-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent'

  const isImmutable = ['sending', 'sent', 'ab_testing'].includes(campaign.status)
  const statusLabel = STATUS_LABEL[campaign.status] ?? campaign.status

  return (
    <div className="flex flex-col h-full min-h-screen">
      {/* Top bar */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 flex items-center gap-4 flex-shrink-0">
        <Link
          href="/marketing"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Marketing
        </Link>
        <div className="flex-1 flex items-center gap-3 min-w-0">
          <h1 className="text-base font-semibold text-gray-900 dark:text-white truncate">{campaign.name}</h1>
          <span className={`flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[campaign.status] ?? 'bg-gray-100 text-gray-600'}`}>
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Two-pane editor */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left pane */}
        <div className="w-1/2 flex flex-col p-6 overflow-y-auto border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
          <div className="space-y-4 flex-1">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {abEnabled ? 'Subject A (original)' : 'Email subject'}
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={isImmutable}
                className={inputClass}
              />
            </div>

            {/* A/B Test Section */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={abEnabled}
                  onChange={(e) => setAbEnabled(e.target.checked)}
                  disabled={isImmutable}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600"
                />
                <FlaskConical className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Enable A/B subject line test
                </span>
              </label>

              {abEnabled && (
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Subject B</label>
                    <input
                      type="text"
                      value={abSubjectB}
                      onChange={(e) => setAbSubjectB(e.target.value)}
                      disabled={isImmutable}
                      placeholder="Alternative subject line…"
                      className={inputClass}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Test size (% of list)
                      </label>
                      <input
                        type="number"
                        min={4}
                        max={80}
                        value={abSplitPercent}
                        onChange={(e) => setAbSplitPercent(Number(e.target.value))}
                        disabled={isImmutable}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Test duration (hours)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={72}
                        value={abTestDurationHours}
                        onChange={(e) => setAbTestDurationHours(Number(e.target.value))}
                        disabled={isImmutable}
                        className={inputClass}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Pick winner by</label>
                    <div className="flex gap-2">
                      {(['open', 'click'] as const).map((metric) => (
                        <button
                          key={metric}
                          type="button"
                          onClick={() => setAbWinnerMetric(metric)}
                          disabled={isImmutable}
                          className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                            abWinnerMetric === metric
                              ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                              : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                          }`}
                        >
                          {metric === 'open' ? 'Open Rate' : 'Click Rate'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">From name</label>
              <input
                type="text"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                disabled={isImmutable}
                className={inputClass}
              />
            </div>

            <div className="flex-1">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Email body</label>
                {!isImmutable && (
                  <button
                    type="button"
                    onClick={() => setHtmlMode((v) => !v)}
                    className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                    title={htmlMode ? 'Switch to visual editor' : 'Switch to HTML mode'}
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    {htmlMode ? 'Visual editor' : 'HTML mode'}
                  </button>
                )}
              </div>

              {htmlMode ? (
                <textarea
                  value={htmlBody}
                  onChange={(e) => setHtmlBody(e.target.value)}
                  disabled={isImmutable}
                  rows={20}
                  spellCheck={false}
                  className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent font-mono resize-none"
                  style={{ minHeight: '400px' }}
                />
              ) : (
                <RichTextEditor
                  value={htmlBody}
                  onChange={setHtmlBody}
                  disabled={isImmutable}
                  placeholder="Write your email here… Use the toolbar to format text, add links, and insert personalisation variables."
                />
              )}
            </div>
          </div>
        </div>

        {/* Right pane — preview */}
        <div className="w-1/2 flex flex-col p-6 bg-gray-50 dark:bg-gray-900 overflow-y-auto">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Preview</p>
          <iframe
            srcDoc={htmlBody}
            title="Email preview"
            className="w-full flex-1 border border-gray-200 dark:border-gray-700 rounded-xl bg-white"
            style={{ minHeight: '500px' }}
            sandbox="allow-same-origin"
          />
        </div>
      </div>

      {/* Bottom bar */}
      <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 flex items-center justify-between gap-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving || isImmutable}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving…' : 'Save Draft'}
          </button>
          {saveMsg && <span className="text-sm text-gray-500 dark:text-gray-400">{saveMsg}</span>}
        </div>

        <div className="flex items-center gap-3">
          {sendMsg && <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">{sendMsg}</span>}
          {sendError && <span className="text-sm text-red-600 dark:text-red-400">{sendError}</span>}
          {testMsg && <span className="text-sm text-green-600 dark:text-green-400">{testMsg}</span>}
          {testError && <span className="text-sm text-red-600 dark:text-red-400">{testError}</span>}
          {(campaign.status === 'sent' || campaign.status === 'ab_testing') ? (
            <Link
              href={`/marketing/${id}/stats`}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              View Stats →
            </Link>
          ) : (
            <>
              <button
                onClick={handleTest}
                disabled={testing}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900 font-medium transition-colors disabled:opacity-60"
              >
                <FlaskConical className="w-4 h-4" />
                {testing ? 'Testing…' : 'Test Email'}
              </button>
              <button
                onClick={handleSend}
              disabled={sending || isImmutable}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {abEnabled ? 'Starting A/B Test…' : 'Sending…'}
                </>
              ) : (
                <>
                  {abEnabled ? <FlaskConical className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                  {abEnabled ? 'Start A/B Test' : 'Send Now'}
                </>
              )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
