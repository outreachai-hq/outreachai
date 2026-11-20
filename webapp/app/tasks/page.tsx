'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { HelpPanel } from '@/components/HelpPanel'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Plus, X, CheckSquare } from 'lucide-react'

interface Task {
  id: string
  type: 'call' | 'email' | 'linkedin' | 'custom'
  title: string
  notes: string | null
  dueAt: string | null
  completedAt: string | null
  leadName: string | null
  leadCompany: string | null
  campaignName: string | null
  createdAt: string
}

type TabKey = 'today' | 'upcoming' | 'completed'

const TYPE_ICONS: Record<Task['type'], string> = {
  call: '📞',
  email: '✉️',
  linkedin: '💼',
  custom: '✅',
}

const TYPE_STYLES: Record<Task['type'], string> = {
  call: 'bg-green-50 text-green-600 dark:bg-green-900 dark:text-green-400',
  email: 'bg-blue-50 text-blue-600 dark:bg-blue-900 dark:text-blue-400',
  linkedin: 'bg-blue-50 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  custom: 'bg-gray-50 text-gray-600 dark:bg-slate-700 dark:text-slate-300',
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

function isPastOrToday(dateStr: string): boolean {
  const d = new Date(dateStr)
  const now = new Date()
  now.setHours(23, 59, 59, 999)
  return d <= now
}

function isFuture(dateStr: string): boolean {
  const d = new Date(dateStr)
  const now = new Date()
  now.setHours(23, 59, 59, 999)
  return d > now
}

function filterTasks(tasks: Task[], tab: TabKey): Task[] {
  switch (tab) {
    case 'today':
      return tasks.filter((t) => !t.completedAt && t.dueAt && isPastOrToday(t.dueAt))
    case 'upcoming':
      return tasks.filter((t) => !t.completedAt && t.dueAt && isFuture(t.dueAt))
    case 'completed':
      return tasks.filter((t) => !!t.completedAt)
    default:
      return tasks
  }
}

function formatDueDate(dueAt: string): { text: string; isOverdue: boolean } {
  const d = new Date(dueAt)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const isOverdue = d < now
  const text = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return { text, isOverdue }
}

function SnoozeDropdown({ taskId, onSnoozed }: { taskId: string; onSnoozed: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function snooze(days: number) {
    const newDue = new Date()
    newDue.setDate(newDue.getDate() + days)
    await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dueAt: newDue.toISOString() }),
    })
    setOpen(false)
    onSnoozed()
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 text-xs px-3 py-1.5 rounded-md transition-colors"
      >
        Snooze
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-32 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 overflow-hidden">
          <button
            onClick={() => snooze(1)}
            className="w-full text-left text-xs px-3 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Tomorrow
          </button>
          <button
            onClick={() => snooze(7)}
            className="w-full text-left text-xs px-3 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 border-t border-gray-100 dark:border-gray-800 transition-colors"
          >
            Next week
          </button>
        </div>
      )}
    </div>
  )
}

function AddTaskModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [type, setType] = useState<Task['type']>('email')
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [leadName, setLeadName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError('Title is required'); return }
    setSaving(true)
    setError('')
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        title: title.trim(),
        notes: notes.trim() || null,
        dueAt: dueAt || null,
        leadName: leadName.trim() || null,
      }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Failed to create task')
      setSaving(false)
      return
    }
    onCreated()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Add task</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as Task['type'])}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="email">✉️ Email</option>
              <option value="call">📞 Call</option>
              <option value="linkedin">💼 LinkedIn</option>
              <option value="custom">✅ Custom</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setError('') }}
              placeholder="e.g. Follow up with decision maker"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes…"
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Due date</label>
            <input
              type="date"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Lead</label>
            <input
              type="text"
              value={leadName}
              onChange={(e) => setLeadName(e.target.value)}
              placeholder="Lead name"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="flex-1 px-4 py-2.5 text-sm font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              {saving ? 'Adding…' : 'Add task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const EMPTY_MESSAGES: Record<TabKey, { title: string; body: string }> = {
  today: {
    title: 'No tasks due today',
    body: 'Tasks that are due today or overdue will appear here. Add a task or wait for your campaigns to generate follow-up tasks.',
  },
  upcoming: {
    title: 'No upcoming tasks',
    body: 'Tasks with a future due date will appear here. Schedule your follow-ups in advance to stay on top of your outreach.',
  },
  completed: {
    title: 'No completed tasks yet',
    body: 'When you mark tasks as done they will appear here. Keep going!',
  },
}

const TABS: { key: TabKey; label: string }[] = [
  { key: 'today', label: 'Due today' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'completed', label: 'Completed' },
]

export default function TasksPage() {
  const { status } = useSession()
  const router = useRouter()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>('today')
  const [showModal, setShowModal] = useState(false)

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/tasks')
      if (res.ok) {
        const data = await res.json()
        setTasks(Array.isArray(data) ? data : [])
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login')
    if (status === 'authenticated') fetchTasks()
  }, [status, fetchTasks, router])

  async function markDone(taskId: string) {
    await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completedAt: new Date().toISOString() }),
    })
    fetchTasks()
  }

  const filteredTasks = filterTasks(tasks, activeTab)
  const emptyMsg = EMPTY_MESSAGES[activeTab]

  if (status === 'loading' || loading) {
    return (
      <div className="p-8 text-center text-gray-400 dark:text-gray-500 text-sm">
        Loading tasks…
      </div>
    )
  }

  return (
    <>
      {showModal && (
        <AddTaskModal
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); fetchTasks() }}
        />
      )}

      <div className="p-4 md:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tasks</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Manual outreach steps and follow-up reminders.
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add task</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-700 overflow-x-auto no-scrollbar">
          {TABS.map((tab) => {
            const count = filterTasks(tasks, tab.key).length
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  activeTab === tab.key
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {tab.label}
                {count > 0 && (
                  <span
                    className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                      activeTab === tab.key
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200'
                        : 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Empty state */}
        {filteredTasks.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 py-20 text-center">
            <CheckSquare className="w-12 h-12 text-gray-200 dark:text-gray-700 mx-auto mb-4" />
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">{emptyMsg.title}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 max-w-sm mx-auto">{emptyMsg.body}</p>
          </div>
        ) : (
          /* Task list */
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800 overflow-hidden">
            {filteredTasks.map((task) => {
              const due = task.dueAt ? formatDueDate(task.dueAt) : null
              const isOverdue = !!due?.isOverdue && !task.completedAt

              return (
                <div key={task.id} className={`flex items-start gap-4 px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors border-l-4 ${isOverdue ? 'border-l-red-400 dark:border-l-red-500' : 'border-l-transparent'}`}>
                  {/* Type icon */}
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0 mt-0.5 ${TYPE_STYLES[task.type]}`}
                  >
                    {TYPE_ICONS[task.type]}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{task.title}</p>
                    {task.notes && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{task.notes}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      {task.leadName && (
                        <span className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
                          {task.leadName}
                          {task.leadCompany && (
                            <span className="text-gray-400 dark:text-gray-500"> · {task.leadCompany}</span>
                          )}
                        </span>
                      )}
                      {task.campaignName && (
                        <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full">
                          {task.campaignName}
                        </span>
                      )}
                      {due && (
                        <span
                          className={`text-xs font-medium ${
                            due.isOverdue && !task.completedAt
                              ? 'text-red-500 dark:text-red-400'
                              : 'text-gray-400 dark:text-gray-500'
                          }`}
                        >
                          {due.isOverdue && !task.completedAt ? 'Overdue · ' : ''}
                          {due.text}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {activeTab !== 'completed' && (
                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1.5 sm:gap-2 flex-shrink-0">
                      <button
                        onClick={() => markDone(task.id)}
                        className="bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 text-green-700 dark:text-green-400 text-xs px-3 py-1.5 rounded-md transition-colors border border-green-200 dark:border-green-800 whitespace-nowrap"
                      >
                        Mark done
                      </button>
                      <SnoozeDropdown taskId={task.id} onSnoozed={fetchTasks} />
                    </div>
                  )}

                  {activeTab === 'completed' && task.completedAt && (
                    <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0 mt-1">
                      Done {new Date(task.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
      <HelpPanel
        title='Tasks'
        description='Manual to-dos created from your campaigns. When a sequence step is marked as manual, it creates a task instead of sending automatically.'
        sections={[
        { title: 'Where tasks come from', content: 'Tasks are created when a sequence step has "Mark as manual" enabled. Instead of auto-sending, OutreachAI creates a reminder for you to do it personally.', example: 'Step 3 of your sequence is marked manual: "Call lead". OutreachAI queues a task "Call Anjali Verma" with her phone number on day 7.', tip: 'Use manual tasks for high-value leads where a personal touch matters more than scale.' },
        { title: 'Completing tasks', content: 'Click a task → review the lead info and suggested message → take the action → mark Complete. Completing advances the lead to the next sequence step.', example: 'Task: "Call Anjali Verma +91 98765 43210". You call her. She\'s interested. Mark Complete → she advances to the email follow-up step automatically.' },
        { title: 'Types of tasks', content: 'Call = phone call. Email = manually written email (not auto-sent). LinkedIn = message to write yourself. Review = just a reminder with no specific channel.', tip: 'Batch similar tasks: do all "Call" tasks in one session, all "LinkedIn" tasks in another. Switching between channels breaks your flow.' },
        ]}
      />
    </>
  )
}
