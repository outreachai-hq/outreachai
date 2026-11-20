'use client'

import { useState, useEffect, useCallback } from 'react'
import { HelpPanel } from '@/components/HelpPanel'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Shield, AlertTriangle, CheckCircle2, XCircle, Zap, Mail, Bell, Trash2, Plus } from 'lucide-react'

interface DomainRecord {
  domain: string
  email: string
  spf: boolean
  dkim: boolean
  dmarc: boolean
  score: number
  warmupDay?: number
  dailyLimit?: number
}

interface DeliverabilityAlert {
  type: 'warning' | 'error' | 'success'
  message: string
}

interface AlertRule {
  id: string
  metric: string
  condition: string
  threshold: number
  active: boolean
  createdAt: string
}

const METRICS = [
  { value: 'bounce_rate',  label: 'Bounce rate',  unit: '%',    defaultThreshold: 5,  defaultCondition: 'above' },
  { value: 'open_rate',    label: 'Open rate',    unit: '%',    defaultThreshold: 20, defaultCondition: 'below' },
  { value: 'reply_rate',   label: 'Reply rate',   unit: '%',    defaultThreshold: 5,  defaultCondition: 'below' },
  { value: 'score',        label: 'Domain score', unit: '/100', defaultThreshold: 60, defaultCondition: 'below' },
]

function metricLabel(value: string) {
  return METRICS.find((m) => m.value === value)?.label ?? value
}
function metricUnit(value: string) {
  return METRICS.find((m) => m.value === value)?.unit ?? ''
}

interface DeliverabilityData {
  domains: DomainRecord[]
  alerts: DeliverabilityAlert[]
  overallScore: number
}

const TIPS = [
  'Add a custom tracking domain to avoid Gmail spam filters',
  'Keep daily sending volume under 100 emails per inbox',
  'Use email warmup for new domains (30 day warmup recommended)',
  'Ensure SPF, DKIM, and DMARC are all configured',
]

function scoreColor(score: number): string {
  if (score >= 80) return 'text-green-600 dark:text-green-400'
  if (score >= 60) return 'text-yellow-500 dark:text-yellow-400'
  return 'text-red-500 dark:text-red-400'
}

function scoreBorderColor(score: number): string {
  if (score >= 80) return 'border-green-500 dark:border-green-400'
  if (score >= 60) return 'border-yellow-500 dark:border-yellow-400'
  return 'border-red-500 dark:border-red-400'
}

function scoreLabel(score: number): string {
  if (score >= 80) return 'Excellent'
  if (score >= 60) return 'Needs attention'
  return 'At risk'
}

function AlertIcon({ type }: { type: DeliverabilityAlert['type'] }) {
  if (type === 'error') return <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
  if (type === 'warning') return <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
  return <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
}

function AlertBg(type: DeliverabilityAlert['type']): string {
  if (type === 'error') return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
  if (type === 'warning') return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
  return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
}

function CheckMark({ value }: { value: boolean }) {
  return value
    ? <CheckCircle2 className="w-4 h-4 text-green-500" />
    : <XCircle className="w-4 h-4 text-red-400" />
}

export default function DeliverabilityPage() {
  const { status } = useSession()
  const router = useRouter()
  const [data, setData] = useState<DeliverabilityData | null>(null)
  const [loading, setLoading] = useState(true)

  // Alert rules state
  const [alertRules, setAlertRules] = useState<AlertRule[]>([])
  const [showAddAlert, setShowAddAlert] = useState(false)
  const [newAlert, setNewAlert] = useState({ metric: 'bounce_rate', condition: 'above', threshold: '5' })
  const [alertSaving, setAlertSaving] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [delivRes, alertsRes] = await Promise.all([
        fetch('/api/deliverability'),
        fetch('/api/deliverability/alerts'),
      ])
      if (delivRes.ok) {
        const json = await delivRes.json()
        setData(json)
      }
      if (alertsRes.ok) {
        const json = await alertsRes.json()
        setAlertRules(json.alerts ?? [])
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login')
    if (status === 'authenticated') fetchData()
  }, [status, fetchData, router])

  async function handleAddAlert() {
    setAlertSaving(true)
    try {
      const res = await fetch('/api/deliverability/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metric: newAlert.metric, condition: newAlert.condition, threshold: Number(newAlert.threshold) }),
      })
      if (res.ok) {
        const json = await res.json()
        setAlertRules((prev) => [...prev, json.alert])
        setShowAddAlert(false)
        setNewAlert({ metric: 'bounce_rate', condition: 'above', threshold: '5' })
      }
    } catch { /* ignore */ }
    setAlertSaving(false)
  }

  async function handleToggleAlert(id: string, active: boolean) {
    setAlertRules((prev) => prev.map((a) => a.id === id ? { ...a, active } : a))
    await fetch(`/api/deliverability/alerts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    }).catch(() => {})
  }

  async function handleDeleteAlert(id: string) {
    setAlertRules((prev) => prev.filter((a) => a.id !== id))
    await fetch(`/api/deliverability/alerts/${id}`, { method: 'DELETE' }).catch(() => {})
  }

  if (status === 'loading' || loading) {
    return (
      <div className="p-8 text-center text-gray-400 dark:text-gray-500 text-sm">
        Loading deliverability data…
      </div>
    )
  }

  // If no data yet, show a placeholder score of 0
  const overallScore = data?.overallScore ?? 0
  const domains = data?.domains ?? []
  const alerts = data?.alerts ?? []

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            Deliverability
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Monitor your sending health and inbox placement.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Overall health score */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 flex flex-col items-center justify-center gap-3">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Overall health</p>
          {domains.length === 0 ? (
            <div className="text-center py-2">
              <Shield className="w-10 h-10 text-gray-200 dark:text-gray-700 mx-auto mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400">No domains configured yet.</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Add an email account in Settings to check deliverability.
              </p>
            </div>
          ) : (
            <>
              <div
                className={`w-28 h-28 rounded-full border-8 flex flex-col items-center justify-center ${scoreBorderColor(overallScore)}`}
              >
                <span className={`text-3xl font-extrabold leading-none ${scoreColor(overallScore)}`}>
                  {overallScore}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">/ 100</span>
              </div>
              <span className={`text-sm font-semibold ${scoreColor(overallScore)}`}>
                {scoreLabel(overallScore)}
              </span>
            </>
          )}
        </div>

        {/* Alerts */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-500" />
            Alerts
          </h2>
          {alerts.length === 0 ? (
            <div className="text-center py-6">
              <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">No alerts — everything looks good!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.map((alert, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-3 px-4 py-3 rounded-lg border text-sm ${AlertBg(alert.type)}`}
                >
                  <AlertIcon type={alert.type} />
                  <span className="text-gray-700 dark:text-gray-300">{alert.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sending domains table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
          <Mail className="w-4 h-4 text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Sending domains</h2>
        </div>

        {domains.length === 0 ? (
          <div className="py-16 text-center">
            <Shield className="w-10 h-10 text-gray-200 dark:text-gray-700 mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No sending domains configured yet.</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Add a sending email account to start monitoring deliverability.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                  <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 px-6 py-3">Domain</th>
                  <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 px-4 py-3">Email</th>
                  <th className="text-center text-xs font-semibold text-gray-500 dark:text-gray-400 px-4 py-3">SPF</th>
                  <th className="text-center text-xs font-semibold text-gray-500 dark:text-gray-400 px-4 py-3">DKIM</th>
                  <th className="text-center text-xs font-semibold text-gray-500 dark:text-gray-400 px-4 py-3">DMARC</th>
                  <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 px-4 py-3">Score</th>
                  <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 px-4 py-3">Warmup</th>
                  <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 px-4 py-3">Daily limit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {domains.map((d) => (
                  <tr key={d.domain} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-6 py-3 font-medium text-gray-900 dark:text-white">{d.domain}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{d.email}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center"><CheckMark value={d.spf} /></div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center"><CheckMark value={d.dkim} /></div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center"><CheckMark value={d.dmarc} /></div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-semibold text-sm ${scoreColor(d.score)}`}>{d.score}</span>
                    </td>
                    <td className="px-4 py-3">
                      {d.warmupDay !== undefined ? (
                        <div className="flex items-center gap-2 min-w-[120px]">
                          <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-blue-500 h-1.5 rounded-full transition-all"
                              style={{ width: `${Math.min(100, (d.warmupDay / 30) * 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                            Day {d.warmupDay}/30
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {d.dailyLimit !== undefined ? `${d.dailyLimit}/day` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Alert rules */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Bell className="w-4 h-4 text-blue-500" />
            Alert rules
          </h2>
          <button
            onClick={() => setShowAddAlert((v) => !v)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 border border-blue-200 hover:border-blue-300 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-400 rounded-lg px-3 py-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add alert rule
          </button>
        </div>

        {showAddAlert && (
          <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">New alert rule</p>
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Metric</label>
                <select
                  value={newAlert.metric}
                  onChange={(e) => {
                    const m = METRICS.find((x) => x.value === e.target.value)
                    setNewAlert({ metric: e.target.value, condition: m?.defaultCondition ?? 'above', threshold: String(m?.defaultThreshold ?? 5) })
                  }}
                  className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  {METRICS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Condition</label>
                <select
                  value={newAlert.condition}
                  onChange={(e) => setNewAlert((prev) => ({ ...prev, condition: e.target.value }))}
                  className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="above">Above</option>
                  <option value="below">Below</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Threshold ({metricUnit(newAlert.metric)})</label>
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  value={newAlert.threshold}
                  onChange={(e) => setNewAlert((prev) => ({ ...prev, threshold: e.target.value }))}
                  className="w-24 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAddAlert}
                  disabled={alertSaving}
                  className="px-4 py-1.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg transition-colors"
                >
                  {alertSaving ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={() => setShowAddAlert(false)}
                  className="px-4 py-1.5 text-sm text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {alertRules.length === 0 ? (
          <div className="text-center py-8">
            <Bell className="w-8 h-8 text-gray-200 dark:text-gray-700 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No alert rules yet. Get notified when your email health metrics change.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {alertRules.map((rule) => (
              <div key={rule.id} className="flex items-center justify-between gap-4 px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {metricLabel(rule.metric)}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                    {rule.condition} {rule.threshold}{metricUnit(rule.metric)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {/* Active toggle */}
                  <button
                    type="button"
                    onClick={() => handleToggleAlert(rule.id, !rule.active)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${rule.active ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${rule.active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                  <button
                    onClick={() => handleDeleteAlert(rule.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tips */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          Deliverability tips
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {TIPS.map((tip, i) => (
            <div
              key={i}
              className="flex items-start gap-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg px-4 py-3"
            >
              <span className="text-blue-500 dark:text-blue-400 font-bold text-sm flex-shrink-0 mt-0.5">
                {i + 1}.
              </span>
              <p className="text-sm text-gray-700 dark:text-gray-300">{tip}</p>
            </div>
          ))}
        </div>
      </div>
      <HelpPanel
        title='Email Deliverability'
        description='Monitor the health of your sending domains and mailboxes. Poor deliverability means your emails land in spam even when sent.'
        sections={[
        { title: 'What is deliverability?', content: 'Deliverability measures whether your emails actually reach the inbox. A score of 80+ is healthy. Below 60 means a significant portion is going to spam.', example: 'You send 100 emails. 82 reach inbox. 18 go to spam. Your deliverability is 82%.', tip: 'The #1 cause of low deliverability is sending too fast to too many people before your domain is "warmed up".' },
        { title: 'Domain authentication (SPF / DKIM / DMARC)', content: 'These are DNS records that prove you own your domain and are authorised to send from it. Without them, your emails are much more likely to be marked as spam.', example: 'Add a DKIM record to your DNS → Gmail now shows a padlock on your emails → open rates improve by ~15%.', tip: 'Set up all three: SPF, DKIM, and DMARC. Your sending service (SendGrid, SES) has step-by-step DNS instructions.' },
        { title: 'Email warmup', content: 'Warmup gradually increases your sending volume from a new domain by auto-sending and auto-replying between real mailboxes. This builds your reputation before you send campaigns.', example: 'New domain "outreach.yourcompany.com". Week 1: send 10/day auto-warmup. Week 4: send 50/day auto-warmup. Week 6: start real campaigns at 50/day.', tip: 'Never start campaigns on a brand new domain without 4-6 weeks of warmup. Google will flag it as suspicious.' },
        { title: 'Bounce rate alerts', content: 'Set an alert: "Notify me if bounce rate exceeds 3%". A bounce rate above 3% will damage your domain reputation rapidly.', example: 'You import a bad CSV with 200 stale email addresses → bounce rate hits 8% → Gmail starts routing all your emails to spam → alert fires → you pause the campaign.', tip: 'Remove bounced addresses from your list immediately. OutreachAI auto-suppresses them now.' },
        ]}
      />
    </div>
  )
}
