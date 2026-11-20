'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, Loader2, Check, User, Clock, Calendar } from 'lucide-react'

interface MeetingPageData {
  id: string
  slug: string
  title: string
  description: string | null
  duration: number
  timezone: string
  weeklyHours: Record<string, number[][]>
  bufferMins: number
  active: boolean
  ownerName: string | null
}

interface Slot {
  startAt: string
  endAt: string
  label: string
}

type Step = 'pick' | 'form' | 'confirmed'

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function formatDateTime(isoStr: string): string {
  const d = new Date(isoStr)
  return d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function formatDateShort(isoStr: string): string {
  const d = new Date(isoStr)
  return d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function toDateString(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export default function MeetSlugPage() {
  const params = useParams()
  const slug = params.slug as string

  const [pageData, setPageData] = useState<MeetingPageData | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(true)

  // Calendar state
  const today = new Date()
  const [calYear, setCalYear] = useState(today.getFullYear())
  const [calMonth, setCalMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  // Slots
  const [slots, setSlots] = useState<Slot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)

  // Form
  const [step, setStep] = useState<Step>('pick')
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmedBooking, setConfirmedBooking] = useState<{
    startAt: string
    guestName: string
  } | null>(null)

  // Load meeting page
  useEffect(() => {
    fetch(`/api/meetings/${slug}`)
      .then((r) => {
        if (!r.ok) { setNotFound(true); return null }
        return r.json()
      })
      .then((d) => { if (d) setPageData(d) })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [slug])

  // Load slots when date is selected
  const loadSlots = useCallback(
    async (date: string) => {
      setSlotsLoading(true)
      setSlots([])
      try {
        const r = await fetch(`/api/meetings/${slug}/slots?date=${date}`)
        if (r.ok) {
          const d = await r.json()
          setSlots(d.slots ?? [])
        }
      } finally {
        setSlotsLoading(false)
      }
    },
    [slug],
  )

  function handleDateClick(date: string) {
    setSelectedDate(date)
    setSelectedSlot(null)
    loadSlots(date)
  }

  function handleSlotClick(slot: Slot) {
    setSelectedSlot(slot)
    setStep('form')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedSlot) return
    setSubmitting(true)
    setFormError(null)

    try {
      const r = await fetch(`/api/meetings/${slug}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startAt: selectedSlot.startAt,
          guestName: guestName.trim(),
          guestEmail: guestEmail.trim(),
          notes: notes.trim() || undefined,
        }),
      })
      if (!r.ok) {
        const d = await r.json()
        setFormError(d.error ?? 'Failed to book. Please try again.')
        return
      }
      const d = await r.json()
      setConfirmedBooking(d.booking)
      setStep('confirmed')
    } catch {
      setFormError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // Calendar helpers
  function getDaysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate()
  }

  function getFirstDayOfMonth(year: number, month: number) {
    return new Date(year, month, 1).getDay()
  }

  function isDayAvailable(year: number, month: number, day: number): boolean {
    if (!pageData) return false
    const date = new Date(year, month, day)
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    if (date < todayMidnight) return false
    const dayKey = DAY_KEYS[date.getDay()]
    const ranges = pageData.weeklyHours[dayKey] ?? []
    return ranges.length > 0
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    )
  }

  if (notFound || !pageData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-5xl mb-4">404</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Page not found</h1>
          <p className="text-gray-500">This booking page does not exist or is inactive.</p>
        </div>
      </div>
    )
  }

  const daysInMonth = getDaysInMonth(calYear, calMonth)
  const firstDay = getFirstDayOfMonth(calYear, calMonth)

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-xl mx-auto">
        {/* Header card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">
                {pageData.ownerName ?? pageData.slug}
              </h1>
              <p className="text-sm text-gray-500 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {pageData.duration}-minute meeting
              </p>
            </div>
          </div>
          <h2 className="text-base font-semibold text-gray-800">{pageData.title}</h2>
          {pageData.description && (
            <p className="text-sm text-gray-500 mt-1">{pageData.description}</p>
          )}
        </div>

        {/* Step: pick */}
        {step === 'pick' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            {/* Calendar nav */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => {
                  if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11) }
                  else setCalMonth(m => m - 1)
                }}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-semibold text-gray-900">
                {MONTH_NAMES[calMonth]} {calYear}
              </span>
              <button
                onClick={() => {
                  if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0) }
                  else setCalMonth(m => m + 1)
                }}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Day labels */}
            <div className="grid grid-cols-7 mb-2">
              {DAY_LABELS.map((d) => (
                <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-y-1">
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const available = isDayAvailable(calYear, calMonth, day)
                const dateStr = toDateString(calYear, calMonth, day)
                const isSelected = dateStr === selectedDate
                return (
                  <button
                    key={day}
                    disabled={!available}
                    onClick={() => handleDateClick(dateStr)}
                    className={`
                      mx-auto w-9 h-9 rounded-full text-sm font-medium transition-colors
                      ${isSelected
                        ? 'bg-indigo-600 text-white'
                        : available
                          ? 'text-gray-900 hover:bg-indigo-50 hover:text-indigo-700'
                          : 'text-gray-300 cursor-not-allowed'
                      }
                    `}
                  >
                    {day}
                  </button>
                )
              })}
            </div>

            {/* Slots */}
            {selectedDate && (
              <div className="mt-6 border-t border-gray-100 pt-5">
                <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-indigo-500" />
                  Available times for{' '}
                  {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
                {slotsLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                  </div>
                ) : slots.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">
                    No available slots for this day.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {slots.map((slot) => (
                      <button
                        key={slot.startAt}
                        onClick={() => handleSlotClick(slot)}
                        className="px-3 py-2 text-sm font-medium border border-indigo-200 text-indigo-700 rounded-lg hover:bg-indigo-50 hover:border-indigo-400 transition-colors"
                      >
                        {slot.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step: form */}
        {step === 'form' && selectedSlot && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <button
              onClick={() => setStep('pick')}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-5 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>

            <div className="bg-indigo-50 rounded-xl px-4 py-3 mb-5">
              <p className="text-sm font-semibold text-indigo-800">
                {formatDateShort(selectedSlot.startAt)} &middot; {selectedSlot.label}
              </p>
              <p className="text-xs text-indigo-600 mt-0.5">
                {pageData.duration} min with{' '}
                {pageData.ownerName ?? pageData.slug}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Your name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Akhilesh Chauhan"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Your email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Additional notes
                </label>
                <textarea
                  rows={3}
                  placeholder="What would you like to discuss?"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                />
              </div>

              {formError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
                  {formError}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting || !guestName.trim() || !guestEmail.trim()}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirm booking
              </button>
            </form>
          </div>
        )}

        {/* Step: confirmed */}
        {step === 'confirmed' && confirmedBooking && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-7 h-7 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">You&apos;re booked!</h2>
            <p className="text-sm font-semibold text-gray-700 mb-1">
              {formatDateTime(confirmedBooking.startAt)}
            </p>
            <p className="text-sm text-gray-500 mb-4">
              {pageData.duration}-minute meeting with{' '}
              {pageData.ownerName ?? pageData.slug}
            </p>
            <div className="bg-gray-50 rounded-xl px-4 py-3 mb-4 text-left">
              <p className="text-xs text-gray-500">Confirmation sent to</p>
              <p className="text-sm font-medium text-gray-800">{guestEmail}</p>
            </div>
            <p className="text-xs text-gray-400">
              Need to cancel? Click the link in your confirmation email.
            </p>
            <div className="mt-8 pt-6 border-t border-gray-100">
              <p className="text-xs text-gray-400">Powered by OutreachAI</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
