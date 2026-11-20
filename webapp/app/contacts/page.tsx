'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { HelpPanel } from '@/components/HelpPanel'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Users, Upload, Download, Search, X } from 'lucide-react'
import { AddToPipelineButton } from '@/components/AddToPipelineButton'

interface Contact {
  id: string; name: string; email: string | null; company: string | null
  headline: string | null; status: string; sentAt: string | null
}

const STATUS_STYLES: Record<string, string> = {
  sent:     'chip chip-sent',
  followup: 'chip chip-followup',
  replied:  'chip chip-replied',
}

// Proper RFC-4180 CSV parser — handles \r\n, quoted fields, commas inside quotes
function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++ }
      else inQ = !inQ
    } else if (ch === ',' && !inQ) {
      fields.push(cur.trim()); cur = ''
    } else {
      cur += ch
    }
  }
  fields.push(cur.trim())
  return fields
}

function parseCSV(text: string): Record<string, string>[] {
  // Strip BOM + normalise all line endings before splitting
  const cleaned = text
    .replace(/^\uFEFF/, '')   // UTF-8 BOM added by Excel
    .replace(/\r\n/g, '\n') // Windows CRLF
    .replace(/\r/g, '\n')    // old Mac CR
    .trim()

  const lines = cleaned.split('\n').filter(l => l.trim())
  if (lines.length < 1) return []
  const headers = parseCSVLine(lines[0]).map(h =>
    h.toLowerCase().replace(/^[\s"']+|[\s"']+$/g, '')
  )
  if (headers.length < 1 || headers.every(h => !h)) return []
  return lines.slice(1).map(line => {
    const vals = parseCSVLine(line)
    return Object.fromEntries(headers.map((h, i) => [h, (vals[i] ?? '').trim()]))
  })
}

const SAMPLE_CSV = `name,email,company,headline,linkedinUrl
Manish Kumar Bansal,manish@groww.in,Groww,Head of Growth & Marketing,https://linkedin.com/in/manish-kumar-bansal
Priya Sharma,priya@physicswallah.com,PhysicsWallah,VP Product,https://linkedin.com/in/priya-sharma-pw`

function normalizeContact(row: Record<string, string>) {
  const name = row.name || [row.firstname || row['first name'] || '', row.lastname || row['last name'] || ''].join(' ').trim()
  return {
    name,
    email: row.email || '',
    company: row.company || row.organization || '',
    headline: row.headline || row.title || row.jobtitle || row['job title'] || '',
    linkedinUrl: row.linkedinurl || row['linkedin url'] || row.linkedin || '',
  }
}

export default function ContactsPage() {
  const { status } = useSession()
  const router = useRouter()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/contacts')
    if (res.ok) { const d = await res.json(); setContacts(d.contacts ?? []) }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') { router.replace('/login'); return }
    if (status === 'authenticated') load()
  }, [status, router, load])

  async function handleCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true); setImportResult(null); setImportError(null)

    try {
      const text = await file.text()
      const parsed = parseCSV(text)

      if (parsed.length === 0) {
        setImportError(`File could not be parsed as CSV. Download the sample CSV to see the expected format.`)
        setImporting(false)
        if (fileRef.current) fileRef.current.value = ''
        return
      }

      const rows = parsed.map(normalizeContact).filter(r => r.name.trim())

      if (rows.length === 0) {
        setImportError(`No rows with a name found. CSV needs a "name" column (or "firstName"/"lastName"). Download the sample to see the format.`)
        setImporting(false)
        if (fileRef.current) fileRef.current.value = ''
        return
      }

      const res = await fetch('/api/contacts/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts: rows }),
      })
      const data = await res.json()
      if (!res.ok) { setImportError(data.error ?? 'Import failed'); setImporting(false); return }
      setImportResult(data)
      load()
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to read file')
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function exportCSV() {
    const header = 'Name,Email,Company,Headline,Status,Sent Date'
    const rows = contacts.map(c =>
      [c.name, c.email ?? '', c.company ?? '', c.headline ?? '', c.status, c.sentAt ? new Date(c.sentAt).toLocaleDateString() : ''].map(v => `"${v}"`).join(',')
    )
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'contacts.csv'; a.click()
  }

  const filtered = contacts.filter(c => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.company ?? '').toLowerCase().includes(search.toLowerCase()) || (c.email ?? '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || c.status === filterStatus
    return matchSearch && matchStatus
  })

  if (status === 'loading' || loading) return <div className="p-8 text-center text-gray-400 text-sm">Loading contacts…</div>

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Contacts</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{contacts.length} total contacts</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              const a = document.createElement('a')
              a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(SAMPLE_CSV)
              a.download = 'outreachai_sample.csv'
              a.click()
            }}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <Download className="w-4 h-4" /> Sample CSV
          </button>
          {contacts.length > 0 && (
            <button onClick={exportCSV} className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <Download className="w-4 h-4" /> Export CSV
            </button>
          )}
          <label className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 border border-blue-200 bg-blue-50 rounded-lg px-3 py-2 hover:bg-blue-100 transition-colors cursor-pointer">
            <Upload className="w-4 h-4" /> {importing ? 'Importing…' : 'Import CSV'}
            <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleCSV} />
          </label>
        </div>
      </div>

      {importResult && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4 flex items-center justify-between">
          <span className="text-sm text-emerald-700 font-medium">✅ Imported {importResult.imported} contacts{importResult.skipped > 0 ? `, ${importResult.skipped} skipped` : ''}</span>
          <button onClick={() => setImportResult(null)}><X className="w-4 h-4 text-emerald-500" /></button>
        </div>
      )}

      {importError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 flex items-center justify-between">
          <div>
            <span className="text-sm text-red-700 font-medium block">❌ Import failed</span>
            <span className="text-xs text-red-600">{importError}</span>
          </div>
          <button onClick={() => setImportError(null)}><X className="w-4 h-4 text-red-400" /></button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[160px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search by name or company…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:bg-gray-800 dark:border-gray-700 dark:text-white">
          <option value="all">All statuses</option>
          <option value="sent">Messaged</option>
          <option value="followup">Follow-up</option>
          <option value="replied">Replied</option>
        </select>
        <div className="text-xs text-gray-400 dark:text-gray-500">{filtered.length} shown</div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">{contacts.length === 0 ? 'No contacts yet. Import a CSV or use the Chrome extension.' : 'No contacts match your filter.'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                  {['Name', 'Email', 'Company', 'Status', 'Sent date', ''].map(h => (
                    <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {filtered.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900 dark:text-white">{c.name}</p>
                      {c.headline && <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[200px]">{c.headline}</p>}
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400 text-sm break-all">{c.email ?? '—'}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{c.company ?? '—'}</td>
                    <td className="px-6 py-4">
                      <span className={STATUS_STYLES[c.status] ?? 'chip chip-pending'}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                      {c.sentAt ? new Date(c.sentAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <AddToPipelineButton contactId={c.id} contactName={c.name} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <HelpPanel
        title='Contacts'
        description='Everyone who has interacted with your outreach. Track message status, import via CSV, and manage your contact database.'
        sections={[
        { title: 'Contacts vs Leads', content: "Contacts are individuals you've connected with or messaged. Leads are contacts in a Lead List who are being worked through a campaign. Every lead can become a contact; not every contact is a lead.", example: 'You import 500 people from LinkedIn → they become leads in a Lead List. You run a campaign → those who reply become active contacts you track in the Inbox.' },
        { title: 'Importing contacts', content: 'Click Import → upload a CSV with columns: name, email, company, headline, linkedinUrl. Headers are auto-mapped (email, company, organization, headline, title, jobtitle all supported).', example: 'Download LinkedIn Sales Navigator search results as CSV → import into Contacts → assign to a Lead List → add Lead List to a campaign.', tip: 'Clean your CSV before importing: remove duplicates, fill in name at minimum. Campaigns skip leads with no name.' },
        { title: 'Message status', content: 'Sent = outreach message delivered. Follow-up = a follow-up step was sent. Replied = lead has replied to any step.', example: 'Status "Replied" means stop the sequence — this person is in conversation. Move them to Inbox and respond personally.' },
        { title: 'Enriching contacts', content: 'Click the enrich icon on a contact to auto-fill their email, phone, or company data using Apollo or Hunter (configured in Settings → Enrichment Keys).', example: "You have Anjali's LinkedIn URL but no email → Enrich → Apollo finds her work email → now she can receive email steps.", tip: 'Enrichment uses your own Apollo/Hunter API quota. Free plans have 50 enrichments/month.' },
        ]}
      />
    </div>
  )
}
