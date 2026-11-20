'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Plus, Pencil, Trash2, FileText, X, Check, Mail } from 'lucide-react'
import { RichTemplateEditor } from '@/components/RichTemplateEditor'

// Strip HTML tags to plain text (for card preview)
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()
}

// Extract {{vars}} from HTML
function extractVars(html: string): string[] {
  const matches = html.match(/\{\{([^}]+)\}\}/g) ?? []
  return [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, '').trim()))]
}

interface Template {
  id: string
  name: string
  subject: string | null
  message: string
  createdAt: string
}

export default function TemplatesPage() {
  const { data: session } = useSession()
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formSubject, setFormSubject] = useState('')
  const [formMessage, setFormMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    if (session) fetchTemplates()
  }, [session])

  async function fetchTemplates() {
    setLoading(true)
    const res = await fetch('/api/templates')
    if (res.ok) setTemplates(await res.json())
    setLoading(false)
  }

  function startNew() {
    setEditingId(null)
    setFormName('')
    setFormSubject('')
    setFormMessage('')
    setShowForm(true)
  }

  function startEdit(t: Template) {
    setEditingId(t.id)
    setFormName(t.name)
    setFormSubject(t.subject ?? '')
    setFormMessage(t.message)
    setShowForm(true)
  }

  function cancelForm() {
    setShowForm(false)
    setEditingId(null)
    setFormName('')
    setFormSubject('')
    setFormMessage('')
  }

  async function saveTemplate(e: React.FormEvent) {
    e.preventDefault()
    if (!formMessage || formMessage === '<p></p>') return
    setSaving(true)
    const payload = {
      name: formName,
      subject: formSubject.trim() || null,
      message: formMessage,
    }
    if (editingId) {
      await fetch('/api/templates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, ...payload }),
      })
    } else {
      await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    }
    setSaving(false)
    cancelForm()
    fetchTemplates()
  }

  async function deleteTemplate(id: string) {
    setDeletingId(id)
    await fetch(`/api/templates?id=${id}`, { method: 'DELETE' })
    setDeletingId(null)
    setTemplates((prev) => prev.filter((t) => t.id !== id))
  }

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Templates</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Reusable message templates for your outreach.</p>
        </div>
        <button
          onClick={startNew}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Template
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-blue-200 dark:border-blue-900 shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              {editingId ? 'Edit Template' : 'New Template'}
            </h2>
            <button onClick={cancelForm} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={saveTemplate} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Template name</label>
              <input
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Initial outreach"
                className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
            </div>

            {/* Subject (optional — for email) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-gray-400" />
                  Subject <span className="font-normal text-gray-400">(optional — for email steps)</span>
                </span>
              </label>
              <input
                type="text"
                value={formSubject}
                onChange={(e) => setFormSubject(e.target.value)}
                placeholder="e.g. Quick question about {{company}}"
                className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
            </div>

            {/* Rich message editor */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Message</label>
              <RichTemplateEditor
                value={formMessage}
                onChange={setFormMessage}
              />
            </div>

            <div className="flex gap-3 justify-end pt-1">
              <button
                type="button"
                onClick={cancelForm}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !formMessage || formMessage === '<p></p>'}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                <Check className="w-4 h-4" />
                {saving ? 'Saving…' : 'Save Template'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Loading templates…</div>
      ) : templates.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 py-16 text-center">
          <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">No templates yet.</p>
          <p className="text-xs text-gray-400 mt-1">Create your first template to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {templates.map((t) => {
            const vars = extractVars(t.message)
            const plain = stripHtml(t.message)
            return (
              <div
                key={t.id}
                className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-sm transition-shadow flex flex-col gap-3"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{t.name}</h3>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => startEdit(t)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 rounded-lg transition-colors" title="Edit">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => deleteTemplate(t.id)} disabled={deletingId === t.id} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition-colors disabled:opacity-50" title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Subject pill */}
                {t.subject && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                    <Mail className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{t.subject}</span>
                  </div>
                )}

                {/* Message preview */}
                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-3 leading-relaxed flex-1">{plain}</p>

                {/* Variable chips */}
                {vars.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {vars.map((v) => (
                      <span key={v} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-violet-50 dark:bg-violet-900 text-violet-700 dark:text-violet-200 border border-violet-200 dark:border-violet-600">
                        {`{{${v}}}`}
                      </span>
                    ))}
                  </div>
                )}

                <p className="text-xs text-gray-300 dark:text-gray-600">
                  {new Date(t.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
