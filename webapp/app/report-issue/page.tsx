'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Bug, Sparkles, MessageSquare, Send, CheckCircle2, ArrowLeft, AlertCircle } from 'lucide-react'

const TYPES = [
  { value: 'bug',     label: 'Bug report',     icon: Bug,           desc: 'Something is broken or not working as expected' },
  { value: 'feature', label: 'Feature request', icon: Sparkles,      desc: 'Suggest a new feature or improvement' },
  { value: 'other',   label: 'Other',           icon: MessageSquare, desc: 'General feedback or questions' },
]

export default function ReportIssuePage() {
  const [type,        setType]        = useState('bug')
  const [title,       setTitle]       = useState('')
  const [description, setDescription] = useState('')
  const [email,       setEmail]       = useState('')
  const [submitting,  setSubmitting]  = useState(false)
  const [submitted,   setSubmitted]   = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !description.trim()) return
    setSubmitting(true); setError(null)
    const url = typeof window !== 'undefined' ? window.location.href : ''
    const res = await fetch('/api/issues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, title, description, email, url }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Failed to submit — please try again'); setSubmitting(false); return }
    setSubmitted(true); setSubmitting(false)
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/20">
            <CheckCircle2 className="w-8 h-8 text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Report submitted</h1>
          <p className="text-gray-400 mb-8">
            Thanks for taking the time. As a solo developer I read every report and respond to most within 24–48 hours.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/dashboard" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-colors">
              Back to app
            </Link>
            <button onClick={() => { setSubmitted(false); setTitle(''); setDescription(''); setEmail('') }}
              className="px-5 py-2.5 bg-white/10 hover:bg-white/15 text-white font-semibold rounded-xl text-sm transition-colors border border-white/10">
              Submit another
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 px-6 py-12">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors mb-6">
            <ArrowLeft className="w-4 h-4" /> Back to app
          </Link>
          <h1 className="text-3xl font-extrabold text-white mb-2">Report an issue</h1>
          <p className="text-gray-400">
            OutReachAI is built by a solo developer. Your report goes directly to me — no ticket queue, no support bot.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-3">Type</label>
            <div className="grid grid-cols-3 gap-3">
              {TYPES.map(t => (
                <button key={t.value} type="button" onClick={() => setType(t.value)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border text-center transition-all ${
                    type === t.value
                      ? 'bg-blue-600/10 border-blue-500 text-blue-400'
                      : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20 hover:text-white'
                  }`}>
                  <t.icon className="w-5 h-5" />
                  <span className="text-xs font-semibold">{t.label}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">{TYPES.find(t => t.value === type)?.desc}</p>
          </div>

          <div>
            <label htmlFor="title" className="block text-sm font-semibold text-gray-300 mb-2">
              Title <span className="text-red-400">*</span>
            </label>
            <input id="title" type="text" required maxLength={200} value={title} onChange={e => setTitle(e.target.value)}
              placeholder={type === 'bug' ? 'e.g. Campaign stats page shows 0 for all campaigns' : type === 'feature' ? 'e.g. Add CSV export for campaign stats' : 'e.g. Question about warmup pool'}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-all text-sm" />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-semibold text-gray-300 mb-2">
              Description <span className="text-red-400">*</span>
            </label>
            <textarea id="description" required rows={6} value={description} onChange={e => setDescription(e.target.value)}
              placeholder={type === 'bug' ? 'Steps to reproduce:\n1. Go to...\n2. Click...\n\nExpected: ...\nActual: ...' : 'Describe what you need and why it would help...'}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-all text-sm resize-none" />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-gray-300 mb-2">
              Your email <span className="text-gray-500 font-normal">(optional — for follow-up)</span>
            </label>
            <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-all text-sm" />
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
            </div>
          )}

          <button type="submit" disabled={submitting || !title.trim() || !description.trim()}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-colors">
            {submitting ? <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> : <Send className="w-4 h-4" />}
            {submitting ? 'Submitting…' : 'Submit report'}
          </button>

          <p className="text-xs text-gray-600 text-center">
            GitHub is private to prevent abuse — this form goes directly to the developer.
          </p>
        </form>
      </div>
    </div>
  )
}
