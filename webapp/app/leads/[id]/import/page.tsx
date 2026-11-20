'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
  X, Upload, Download, Check, ChevronLeft, ChevronRight,
  Sparkles, FileText, Database, Users, MousePointer, Loader2
} from 'lucide-react'

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  )
}

type ImportMethod = 'csv' | 'database' | 'contacts' | 'linkedin' | 'manual'
type WizardStep = 1 | 2 | 3 | 4

interface CSVRow {
  [key: string]: string
}

type FieldKey = 'firstName' | 'lastName' | 'email' | 'company' | 'linkedinUrl' | 'headline'

const FIELD_LABELS: Record<FieldKey, string> = {
  firstName: 'First Name',
  lastName: 'Last Name',
  email: 'Email',
  company: 'Company',
  linkedinUrl: 'LinkedIn URL',
  headline: 'Headline',
}

const SAMPLE_CSV = `firstName,lastName,email,company,linkedinUrl,headline
John,Doe,john@example.com,Acme Inc,https://linkedin.com/in/johndoe,Head of Sales
Jane,Smith,jane@startup.io,Startup Co,https://linkedin.com/in/janesmith,CTO & Co-founder
Bob,Johnson,bob@bigcorp.com,BigCorp,,VP Marketing`

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      style={{ minHeight: '1.25rem' }}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${
        on ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow ${
          on ? 'translate-x-[18px]' : 'translate-x-[2px]'
        }`}
      />
    </button>
  )
}

function downloadSampleCSV() {
  const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'sample_leads.csv'
  a.click()
  URL.revokeObjectURL(url)
}

function parseCSV(text: string): CSVRow[] {
  const lines = text.trim().split('\n').filter(Boolean)
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''))
  return lines.slice(1).map((line) => {
    const cols: string[] = []
    let inQuotes = false
    let col = ''
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes }
      else if (ch === ',' && !inQuotes) { cols.push(col.trim()); col = '' }
      else { col += ch }
    }
    cols.push(col.trim())
    const row: CSVRow = {}
    headers.forEach((h, i) => { row[h] = cols[i] ?? '' })
    return row
  })
}

export default function LeadImportPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const listId = params.id as string

  const [step, setStep] = useState<WizardStep>(1)
  const [importMethod, setImportMethod] = useState<ImportMethod>('csv')

  // Extension connection status
  const [extConnected, setExtConnected] = useState(false)
  const [extUserName, setExtUserName] = useState('')
  const [extLoading, setExtLoading] = useState(false)

  const checkExtensionStatus = async () => {
    setExtLoading(true)
    try {
      const res = await fetch('/api/extension/status')
      const data = await res.json()
      setExtConnected(data.connected)
      setExtUserName(data.userName)
    } catch { /* silent */ }
    setExtLoading(false)
  }

  const disconnectExtension = async () => {
    await fetch('/api/extension/status', { method: 'DELETE' })
    setExtConnected(false)
  }

  // Auto-check when switching to LinkedIn tab (deferred to avoid setState-in-effect lint error)
  useEffect(() => {
    if (importMethod !== 'linkedin') return
    const t = setTimeout(() => checkExtensionStatus(), 0)
    return () => clearTimeout(t)
  }, [importMethod])
  const [csvRows, setCSVRows] = useState<CSVRow[]>([])
  const [csvHeaders, setCSVHeaders] = useState<string[]>([])
  const [columnMapping, setColumnMapping] = useState<Record<FieldKey, string>>({
    firstName: '',
    lastName: '',
    email: '',
    company: '',
    linkedinUrl: '',
    headline: '',
  })
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Step 3: AI columns
  type AITab = 'recommended' | 'copywrite' | 'research'
  const [aiTab, setAITab] = useState<AITab>('recommended')
  const [aiToggles, setAIToggles] = useState({
    aiOpener: true,
    companyNews: false,
    leadChallenges: false,
  })

  // Step 4: Enrich
  const [enrichToggles, setEnrichToggles] = useState({
    verifiedEmails: false,
    phoneNumbers: false,
    linkedinProfiles: false,
    verifyEmails: false,
  })

  const [importing, setImporting] = useState(false)
  const [importDone, setImportDone] = useState(false)
  const [importCount, setImportCount] = useState(0)
  const [importProgress, setImportProgress] = useState(0) // 0-100

  function handleFileChange(file: File) {
    file.text().then((text) => {
      const rows = parseCSV(text)
      if (rows.length === 0) return
      const headers = Object.keys(rows[0])
      setCSVHeaders(headers)
      setCSVRows(rows)

      // Auto-map columns
      const autoMap: Record<FieldKey, string> = {
        firstName: '',
        lastName: '',
        email: '',
        company: '',
        linkedinUrl: '',
        headline: '',
      }
      headers.forEach((h) => {
        const lower = h.toLowerCase().replace(/[_\s]/g, '')
        if (lower.includes('firstname') || lower === 'first' || lower === 'name' || lower === 'fullname') autoMap.firstName = h
        else if (lower.includes('lastname') || lower === 'last') autoMap.lastName = h
        else if (lower.includes('email')) autoMap.email = h
        else if (lower.includes('company') || lower.includes('organization')) autoMap.company = h
        else if (lower.includes('linkedin')) autoMap.linkedinUrl = h
        else if (lower.includes('headline') || lower.includes('title')) autoMap.headline = h
      })
      setColumnMapping(autoMap)
    })
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && (file.name.endsWith('.csv') || file.type === 'text/csv')) {
      handleFileChange(file)
    }
  }, [])

  async function handleImport() {
    setImporting(true)
    setImportProgress(0)

    const mappedRows = csvRows.map((row) => {
      const mapped: Partial<Record<FieldKey, string>> = {}
      ;(Object.keys(columnMapping) as FieldKey[]).forEach((field) => {
        const col = columnMapping[field]
        if (col && row[col] !== undefined) mapped[field] = row[col]
      })
      return mapped
    }).filter((r) => r.firstName)

    // Send in batches of 500 for fast responses and real progress
    const BATCH_SIZE = 500
    let totalImported = 0
    let failed = false

    for (let i = 0; i < mappedRows.length; i += BATCH_SIZE) {
      const batch = mappedRows.slice(i, i + BATCH_SIZE)
      try {
        const res = await fetch(`/api/lead-lists/${listId}/import`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(batch),
        })
        if (res.ok) {
          const data = await res.json()
          totalImported += data.imported
        } else {
          failed = true
          break
        }
      } catch {
        failed = true
        break
      }
      setImportProgress(Math.round(((i + batch.length) / mappedRows.length) * 100))
    }

    if (!failed) {
      setImportCount(totalImported)
      setImportProgress(100)

      // Enrich if any toggles on
      if (enrichToggles.verifiedEmails || enrichToggles.phoneNumbers || enrichToggles.linkedinProfiles || enrichToggles.verifyEmails || aiToggles.aiOpener) {
        await fetch(`/api/lead-lists/${listId}/enrich`, { method: 'POST' })
      }

      setImportDone(true)
    }
    setImporting(false)
  }

  const stepLabels: { num: WizardStep; label: string }[] = [
    { num: 1, label: 'Import method' },
    { num: 2, label: 'Map columns' },
    { num: 3, label: 'AI columns' },
    { num: 4, label: 'Enrich leads' },
  ]

  const importMethods: { key: ImportMethod; label: string; icon: React.ReactNode; desc: string }[] = [
    { key: 'database', label: 'People database', icon: <Database className="w-5 h-5" />, desc: 'Search our database' },
    { key: 'contacts', label: 'Contacts lists', icon: <Users className="w-5 h-5" />, desc: 'From your CRM' },
    { key: 'csv', label: 'CSV import', icon: <FileText className="w-5 h-5" />, desc: 'Upload a CSV file' },
    { key: 'linkedin', label: 'LinkedIn import', icon: <LinkedInIcon className="w-5 h-5" />, desc: 'From LinkedIn' },
    { key: 'manual', label: 'Manual import', icon: <MousePointer className="w-5 h-5" />, desc: 'Add leads one by one' },
  ]

  const previewRows = csvRows.slice(0, 3)

  if (status === 'loading') {
    return <div className="p-8 text-center text-gray-400 dark:text-gray-500 text-sm">Loading…</div>
  }

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex-shrink-0">
        {/* Close */}
        <Link
          href={`/leads/${listId}`}
          className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </Link>

        <h1 className="text-base font-semibold text-gray-900 dark:text-white">Import Leads</h1>

        {/* Step tabs */}
        <div className="flex items-center gap-1">
          {stepLabels.map(({ num, label }, idx) => {
            const isCompleted = num < step
            const isCurrent = num === step
            return (
              <div key={num} className="flex items-center">
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium ${
                    isCurrent
                      ? 'bg-blue-50 text-blue-700'
                      : isCompleted
                      ? 'text-gray-500 dark:text-gray-400'
                      : 'text-gray-400 dark:text-gray-500'
                  }`}
                >
                  <span
                    className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-xs font-bold ${
                      isCompleted
                        ? 'bg-green-100 text-green-700'
                        : isCurrent
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
                    }`}
                  >
                    {isCompleted ? <Check className="w-2.5 h-2.5" /> : num}
                  </span>
                  {label}
                </div>
                {idx < stepLabels.length - 1 && (
                  <ChevronRight className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 mx-0.5" />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900">
        {/* STEP 1 */}
        {step === 1 && (
          <div className="max-w-3xl mx-auto px-6 py-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">How do you want to import leads?</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Choose your import method below.</p>

            {/* Method tabs */}
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-xl p-1 mb-8 overflow-x-auto">
              {importMethods.map((m) => (
                <button
                  key={m.key}
                  onClick={() => setImportMethod(m.key)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    importMethod === m.key
                      ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  {m.icon}
                  {m.label}
                </button>
              ))}
            </div>

            {/* CSV import content */}
            {importMethod === 'csv' && (
              <div>
                {/* Drag and drop zone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
                    isDragging
                      ? 'border-blue-400 bg-blue-50'
                      : csvRows.length > 0
                      ? 'border-green-400 bg-green-50'
                      : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {csvRows.length > 0 ? (
                    <>
                      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Check className="w-6 h-6 text-green-600" />
                      </div>
                      <p className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                        {csvRows.length} rows loaded
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Click or drop to replace the file</p>
                    </>
                  ) : (
                    <>
                      <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Upload className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                      </div>
                      <p className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                        Drop your CSV here or click to browse
                      </p>
                      <p className="text-sm text-gray-400 dark:text-gray-500">Supports .csv files up to 10MB</p>
                    </>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleFileChange(file)
                    }}
                  />
                </div>

                {/* Download sample */}
                <div className="mt-4 flex items-center justify-center">
                  <button
                    onClick={downloadSampleCSV}
                    className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium hover:underline"
                  >
                    <Download className="w-4 h-4" />
                    Download sample CSV
                  </button>
                </div>
              </div>
            )}

            {importMethod === 'linkedin' && (
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Import from LinkedIn</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                  Save time importing your leads — find relevant profiles with the OutreachAI Chrome extension for LinkedIn.
                </p>

                {/* Connection card */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
                  {extLoading ? (
                    <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">Checking connection…</p>
                  ) : extConnected ? (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 bg-green-500 rounded-full inline-block" />
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">Connected</span>
                        </div>
                        <a href="https://linkedin.com" target="_blank" rel="noreferrer"
                          className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                          Discover how to ↗
                        </a>
                      </div>
                      <p className="text-lg font-bold text-gray-900 dark:text-white mb-1">You are all set!</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                        Import your leads and refresh this page.<br />
                        Do a LinkedIn search and import your leads.
                      </p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-red-500 flex items-center justify-center text-white text-xs font-bold">
                            {extUserName.slice(0, 2).toUpperCase()}
                          </div>
                          <span className="text-sm text-gray-600 dark:text-gray-400">Only you use this integration</span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={disconnectExtension}
                            className="px-4 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                          >
                            Disconnect
                          </button>
                          <a
                            href="https://linkedin.com"
                            target="_blank"
                            rel="noreferrer"
                            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1"
                          >
                            Go to LinkedIn ↗
                          </a>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="w-2.5 h-2.5 bg-gray-300 dark:bg-gray-600 rounded-full inline-block" />
                        <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">Not connected</span>
                      </div>
                      <p className="text-base font-semibold text-gray-900 dark:text-white mb-2">Connect your Chrome extension</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                        Install the OutreachAI Chrome extension, then sign in from the extension popup to connect it to your account.
                      </p>
                      <div className="flex gap-3">
                        <button
                          onClick={checkExtensionStatus}
                          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                          Check connection
                        </button>
                        <a
                          href="https://linkedin.com"
                          target="_blank"
                          rel="noreferrer"
                          className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                        >
                          Go to LinkedIn
                        </a>
                      </div>
                    </>
                  )}
                </div>

                {/* Recommended workflow */}
                {extConnected && (
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Follow this recommended workflow</h3>
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { icon: '🔍', title: 'Do a lead search', desc: 'Search for relevant LinkedIn profiles to import into your campaign' },
                        { icon: '✨', title: 'Enrich your leads', desc: 'Select an enrichment option to find the information about your leads', badge: 'New' },
                        { icon: '🚀', title: 'Start campaign and get meetings', desc: 'Launch your outreach sequence to get meetings booked' },
                      ].map((step) => (
                        <div key={step.title} className="bg-blue-600 rounded-xl p-4 text-white">
                          <div className="text-2xl mb-2">{step.icon}</div>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-semibold">{step.title}</p>
                            {step.badge && (
                              <span className="text-xs bg-green-400 text-white px-1.5 py-0.5 rounded font-medium">{step.badge}</span>
                            )}
                          </div>
                          <p className="text-xs text-blue-200">{step.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {importMethod !== 'csv' && importMethod !== 'linkedin' && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
                <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-3">
                  {importMethods.find((m) => m.key === importMethod)?.icon}
                </div>
                <p className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  {importMethods.find((m) => m.key === importMethod)?.label} coming soon
                </p>
                <p className="text-sm text-gray-400 dark:text-gray-500">Use CSV import for now.</p>
              </div>
            )}
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div className="max-w-4xl mx-auto px-6 py-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Map your columns</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Match your CSV headers to the correct fields.
            </p>

            {/* Preview table */}
            {previewRows.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-auto mb-6">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-4 pt-3 pb-2">
                  Preview (first 3 rows)
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-700">
                        {csvHeaders.map((h) => (
                          <th key={h} className="px-4 py-2 text-left font-semibold text-gray-600 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800 whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, ri) => (
                        <tr key={ri} className="border-b border-gray-50 dark:border-gray-800">
                          {csvHeaders.map((h) => (
                            <td key={h} className="px-4 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap truncate max-w-[160px]">
                              {row[h] ?? ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Column mapping */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Column mapping</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(Object.keys(FIELD_LABELS) as FieldKey[]).map((field) => (
                  <div key={field} className="flex items-center gap-3">
                    <div className="w-32 flex-shrink-0">
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-400">{FIELD_LABELS[field]}</p>
                      {field === 'firstName' && (
                        <p className="text-xs text-red-500">required</p>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0" />
                    <select
                      value={columnMapping[field]}
                      onChange={(e) =>
                        setColumnMapping((prev) => ({ ...prev, [field]: e.target.value }))
                      }
                      className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-gray-50 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
                    >
                      <option value="">— skip —</option>
                      {csvHeaders.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <div className="max-w-2xl mx-auto px-6 py-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Pick AI columns</h2>
            <div className="flex items-center gap-2 mb-6 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5">
              <Sparkles className="w-4 h-4 text-blue-500 flex-shrink-0" />
              <p className="text-sm text-blue-700">
                {`We'll generate a preview on the first 3 rows for free`}
              </p>
            </div>

            {/* AI sub-tabs */}
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1 mb-6 w-fit">
              {(['recommended', 'copywrite', 'research'] as AITab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setAITab(t)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
                    aiTab === t ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {aiTab === 'recommended' && (
              <div className="space-y-3">
                {[
                  { key: 'aiOpener' as const, label: 'Find AI opener', desc: 'Personalized opening line for each lead', defaultOn: true },
                  { key: 'companyNews' as const, label: 'Find company news', desc: 'Recent news about their company', defaultOn: false },
                  { key: 'leadChallenges' as const, label: 'Find lead challenges', desc: 'Common challenges for their role', defaultOn: false },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-purple-50 dark:bg-purple-900 rounded-lg flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{item.label}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">{item.desc}</p>
                      </div>
                    </div>
                    <Toggle
                      on={aiToggles[item.key]}
                      onToggle={() => setAIToggles((p) => ({ ...p, [item.key]: !p[item.key] }))}
                    />
                  </div>
                ))}
              </div>
            )}

            {aiTab === 'copywrite' && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-center text-gray-400 dark:text-gray-500 text-sm">
                Copywrite AI columns coming soon.
              </div>
            )}

            {aiTab === 'research' && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-center text-gray-400 dark:text-gray-500 text-sm">
                Research AI columns coming soon.
              </div>
            )}
          </div>
        )}

        {/* STEP 4 */}
        {step === 4 && (
          <div className="max-w-2xl mx-auto px-6 py-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Enrich your leads data</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Automatically fill in missing information for your leads.
            </p>

            {importDone ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
                <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-7 h-7 text-green-600" />
                </div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                  {importCount} leads imported!
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                  Your leads have been added to the list and enrichment is running in the background.
                </p>
                <Link
                  href={`/leads/${listId}`}
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
                >
                  View Lead List
                </Link>
              </div>
            ) : (
              <>
                <div className="space-y-3 mb-8">
                  {[
                    { key: 'verifiedEmails' as const, label: 'Find verified emails', desc: 'Verify and find professional email addresses' },
                    { key: 'phoneNumbers' as const, label: 'Find phone numbers', desc: 'Find direct phone numbers for leads' },
                    { key: 'linkedinProfiles' as const, label: 'Find LinkedIn profiles', desc: 'Match leads to their LinkedIn profiles' },
                    { key: 'verifyEmails' as const, label: 'Verify emails', desc: 'Check deliverability of existing emails' },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{item.label}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">{item.desc}</p>
                      </div>
                      <Toggle
                        on={enrichToggles[item.key]}
                        onToggle={() => setEnrichToggles((p) => ({ ...p, [item.key]: !p[item.key] }))}
                      />
                    </div>
                  ))}
                </div>

                {importing ? (
                  <div className="w-full flex flex-col items-center gap-4 py-8">
                    <div className="relative">
                      <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                    </div>
                    <div className="text-center">
                      <p className="text-base font-semibold text-gray-900 dark:text-white">Importing {csvRows.length} leads… {importProgress}%</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Please don&apos;t close this page.</p>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full max-w-sm bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${importProgress}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={handleImport}
                    disabled={csvRows.length === 0 || !columnMapping.firstName}
                    className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-base font-semibold px-6 py-4 rounded-xl transition-colors shadow-sm"
                  >
                    <Upload className="w-5 h-5" />
                    Import {csvRows.length} leads
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Bottom nav */}
      {!importDone && (
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex-shrink-0">
          <button
            onClick={() => step > 1 ? setStep((s) => (s - 1) as WizardStep) : router.push(`/leads/${listId}`)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            {step === 1 ? 'Cancel' : 'Back'}
          </button>

          {step < 4 ? (
            <button
              onClick={() => setStep((s) => (s + 1) as WizardStep)}
              disabled={(step === 1 && importMethod === 'csv' && csvRows.length === 0) || (step === 2 && importMethod === 'csv' && !columnMapping.firstName)}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          ) : null}
        </div>
      )}
    </div>
  )
}
