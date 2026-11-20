'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Send, Plus, Mail, CheckCircle2, Clock, AlertCircle, X } from 'lucide-react'

interface EmailAccount { id: string; name: string; email: string; smtpHost: string | null; isDefault: boolean }
interface EmailMessage { id: string; to: string; subject: string; status: string; sentAt: string }

const STATUS_STYLE: Record<string, string> = {
  sent:    'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-600/50',
  opened:  'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900 dark:text-emerald-200 dark:border-emerald-600/50',
  replied: 'bg-violet-50 text-violet-700 border border-violet-200 dark:bg-violet-900 dark:text-violet-200 dark:border-violet-600/50',
  bounced: 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900 dark:text-red-200 dark:border-red-600/50',
}

export default function EmailPage() {
  const { status } = useSession()
  const router = useRouter()
  const [accounts, setAccounts] = useState<EmailAccount[]>([])
  const [messages, setMessages] = useState<EmailMessage[]>([])
  const [showCompose, setShowCompose] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [form, setForm] = useState({ emailAccountId: '', to: '', subject: '', bodyText: '', firstName: '', company: '' })

  const load = useCallback(async () => {
    const [accRes, msgRes] = await Promise.all([
      fetch('/api/email-accounts'),
      fetch('/api/email/messages'),
    ])
    if (accRes.ok) { const d = await accRes.json(); setAccounts(d.accounts ?? []); setForm(f => ({ ...f, emailAccountId: d.accounts?.[0]?.id ?? '' })) }
    if (msgRes.ok) { const d = await msgRes.json(); setMessages(d.messages ?? []) }
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') { router.replace('/login'); return }
    const t = setTimeout(() => load(), 0)
    return () => clearTimeout(t)
  }, [status, load, router])

  async function send() {
    setSending(true); setSendError(null)
    const res = await fetch('/api/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, vars: { firstName: form.firstName, company: form.company } }),
    })
    const data = await res.json()
    if (!res.ok) { setSendError(data.error ?? 'Failed to send'); setSending(false); return }
    setShowCompose(false)
    setForm(f => ({ ...f, to: '', subject: '', bodyText: '', firstName: '', company: '' }))
    load()
    setSending(false)
  }

  const stats = {
    sent:    messages.length,
    opened:  messages.filter(m => m.status === 'opened').length,
    replied: messages.filter(m => m.status === 'replied').length,
    bounced: messages.filter(m => m.status === 'bounced').length,
  }

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Email Outreach</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Send personalised emails via your SMTP account</p>
        </div>
        <button
          onClick={() => setShowCompose(true)}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Compose Email
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Sent', value: stats.sent, icon: Send, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Opened', value: stats.opened, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Replied', value: stats.replied, icon: Mail, color: 'text-violet-600', bg: 'bg-violet-50' },
          { label: 'Bounced', value: stats.bounced, icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5 flex items-center gap-4">
            <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* No account warning */}
      {accounts.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6">
          <p className="text-sm font-semibold text-amber-800 mb-1">No email account connected</p>
          <p className="text-sm text-amber-700">Go to <a href="/settings" className="underline font-medium">Settings → Email Accounts</a> to add your SMTP credentials first.</p>
        </div>
      )}

      {/* Compose modal */}
      {showCompose && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Compose Email</h2>
              <button onClick={() => setShowCompose(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X className="w-5 h-5" /></button>
            </div>

            {sendError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">{sendError}</div>}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">From account</label>
                <select value={form.emailAccountId} onChange={e => setForm(f => ({ ...f, emailAccountId: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600">
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name} &lt;{a.email}&gt;</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">To</label>
                <input type="email" placeholder="recipient@example.com" value={form.to} onChange={e => setForm(f => ({ ...f, to: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">First name (for {'{{firstName}}'})</label>
                  <input type="text" placeholder="Manish" value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Company (for {'{{company}}'})</label>
                  <input type="text" placeholder="Meesho" value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Subject</label>
                <input type="text" placeholder="Hi {{firstName}}, quick intro" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Message</label>
                <textarea rows={6} placeholder={"Hi {{firstName}},\n\nI noticed you work at {{company}}..."}
                  value={form.bodyText} onChange={e => setForm(f => ({ ...f, bodyText: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none" />
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={send} disabled={sending || !form.emailAccountId || !form.to || !form.subject || !form.bodyText}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-sm py-2.5 rounded-lg transition-colors">
                <Send className="w-4 h-4" />{sending ? 'Sending…' : 'Send Email'}
              </button>
              <button onClick={() => setShowCompose(false)} className="px-4 py-2.5 text-sm text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Sent messages */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Sent emails</h2>
        </div>
        {messages.length === 0 ? (
          <div className="p-12 text-center">
            <Mail className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400 text-sm">No emails sent yet. Click Compose to send your first.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {messages.map(m => (
              <div key={m.id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{m.subject}</p>
                  <p className="text-xs text-gray-400 mt-0.5">To: {m.to}</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[m.status] ?? 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                  {m.status}
                </span>
                <span className="text-xs text-gray-400 whitespace-nowrap flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(m.sentAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
