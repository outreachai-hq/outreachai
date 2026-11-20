'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

interface EmailAccount {
  id: string
  name: string
  email: string
}

interface LeadList {
  id: string
  name: string
  leadCount: number
}

export default function NewMarketingCampaignPage() {
  const { status } = useSession()
  const router = useRouter()

  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [fromName, setFromName] = useState('')
  const [emailAccountId, setEmailAccountId] = useState('')
  const [recipientListId, setRecipientListId] = useState('')

  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([])
  const [leadLists, setLeadLists] = useState<LeadList[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(true)
  const [loadingLists, setLoadingLists] = useState(true)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login')
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return

    fetch('/api/email-accounts')
      .then((r) => (r.ok ? r.json() : { accounts: [] }))
      .then((d) => {
        setEmailAccounts(d.accounts ?? [])
        if (d.accounts?.length > 0) setEmailAccountId(d.accounts[0].id)
      })
      .finally(() => setLoadingAccounts(false))

    fetch('/api/lead-lists')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => {
        const lists: LeadList[] = Array.isArray(d) ? d : []
        setLeadLists(lists)
        if (lists.length > 0) setRecipientListId(lists[0].id)
      })
      .finally(() => setLoadingLists(false))
  }, [status])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Campaign name is required'); return }
    if (!subject.trim()) { setError('Email subject is required'); return }
    if (!fromName.trim()) { setError('From name is required'); return }
    if (!emailAccountId) { setError('Please select an email account'); return }
    if (!recipientListId) { setError('Please select a recipient list'); return }

    setSaving(true)
    setError('')

    const res = await fetch('/api/marketing/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        subject: subject.trim(),
        fromName: fromName.trim(),
        htmlBody: '<p>Write your email body here.</p>',
        emailAccountId,
        recipientListId,
      }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Failed to create campaign')
      setSaving(false)
      return
    }

    const campaign = await res.json()
    router.push(`/marketing/${campaign.id}/edit`)
  }

  if (status === 'loading') {
    return <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
  }

  const inputClass =
    'w-full px-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent'
  const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5'

  return (
    <div className="p-8 max-w-2xl">
      {/* Back link */}
      <Link
        href="/marketing"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Marketing
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">New Marketing Campaign</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Set up your campaign details. You can write the email body on the next page.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className={labelClass}>Campaign name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError('') }}
              placeholder="e.g. Q3 Product Announcement"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Email subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => { setSubject(e.target.value); setError('') }}
              placeholder="e.g. Exciting news from our team"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>From name</label>
            <input
              type="text"
              value={fromName}
              onChange={(e) => { setFromName(e.target.value); setError('') }}
              placeholder="e.g. Priya from My Taxes Filings"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Email account</label>
            {loadingAccounts ? (
              <p className="text-sm text-gray-400">Loading accounts…</p>
            ) : emailAccounts.length === 0 ? (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                No email accounts found.{' '}
                <Link href="/settings" className="underline">
                  Add one in Settings.
                </Link>
              </p>
            ) : (
              <select
                value={emailAccountId}
                onChange={(e) => setEmailAccountId(e.target.value)}
                className={inputClass}
              >
                {emailAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.email})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className={labelClass}>Recipient list</label>
            {loadingLists ? (
              <p className="text-sm text-gray-400">Loading lists…</p>
            ) : leadLists.length === 0 ? (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                No lead lists found.{' '}
                <Link href="/leads" className="underline">
                  Create one in Leads.
                </Link>
              </p>
            ) : (
              <select
                value={recipientListId}
                onChange={(e) => setRecipientListId(e.target.value)}
                className={inputClass}
              >
                {leadLists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.leadCount} lead{l.leadCount !== 1 ? 's' : ''})
                  </option>
                ))}
              </select>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <Link
              href="/marketing"
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-center"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving || loadingAccounts || loadingLists}
              className="flex-1 px-4 py-2.5 text-sm font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              {saving ? 'Creating…' : 'Create & Write Email →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
