'use client'

import { useState, useEffect, useCallback } from 'react'
import { Copy, Check, Calendar, Clock, Mail, X, Loader2, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import AppShell from '@/components/AppShell'

interface Booking {
  id: string
  guestName: string
  guestEmail: string
  startAt: string
  endAt: string
  notes: string | null
  status: string
  cancelToken: string
}

function formatBookingTime(startAt: string, endAt: string): string {
  const start = new Date(startAt)
  const end = new Date(endAt)
  const dateStr = start.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
  const startTime = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  const endTime = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  const durationMins = Math.round((end.getTime() - start.getTime()) / 60000)
  return `${dateStr} · ${startTime} – ${endTime} (${durationMins} min)`
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [slug, setSlug] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming')
  const [copied, setCopied] = useState(false)
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  const loadBookings = useCallback(async (all: boolean) => {
    setLoading(true)
    try {
      const r = await fetch(`/api/meetings/bookings${all ? '?all=1' : ''}`)
      if (r.ok) {
        const d = await r.json()
        setBookings(d.bookings ?? [])
        if (d.slug) setSlug(d.slug)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadBookings(tab === 'past')
  }, [tab, loadBookings])

  function copyLink() {
    if (!slug) return
    navigator.clipboard.writeText(`https://outreachai.in/meet/${slug}`).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  async function cancelBooking(id: string) {
    setCancellingId(id)
    try {
      const r = await fetch(`/api/meetings/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      })
      if (r.ok) {
        setBookings((prev) =>
          prev.map((b) => (b.id === id ? { ...b, status: 'cancelled' } : b)),
        )
      }
    } finally {
      setCancellingId(null)
    }
  }

  const confirmedBookings = bookings.filter((b) => b.status === 'confirmed')
  const cancelledBookings = bookings.filter((b) => b.status === 'cancelled')
  const displayBookings = tab === 'upcoming' ? confirmedBookings : bookings

  return (
    <AppShell>
      <div className="px-4 sm:px-6 py-6 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Bookings</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Meetings scheduled by prospects via your booking link
            </p>
          </div>

          {slug && (
            <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl px-3 py-2">
              <span className="text-xs text-indigo-600 dark:text-indigo-400 font-mono truncate max-w-[180px]">
                outreachai.in/meet/{slug}
              </span>
              <button
                onClick={copyLink}
                className="flex-shrink-0 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 transition-colors"
                title="Copy link"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
              <a
                href={`/meet/${slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 transition-colors"
                title="Open booking page"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          )}
        </div>

        {/* No meeting page set up */}
        {!loading && !slug && (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-8 text-center">
            <Calendar className="w-10 h-10 text-indigo-400 mx-auto mb-3" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
              Set up your meeting page first
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Create your booking page in Settings so prospects can schedule time with you.
            </p>
            <Link
              href="/settings#meeting"
              className="inline-block px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Go to Settings
            </Link>
          </div>
        )}

        {/* Tabs */}
        {slug && (
          <>
            <div className="flex gap-2 mb-4">
              {(['upcoming', 'past'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors capitalize ${
                    tab === t
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
              </div>
            ) : displayBookings.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {tab === 'upcoming'
                    ? 'No upcoming bookings. Share your booking link to get started!'
                    : 'No bookings found.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {displayBookings.map((booking) => (
                  <div
                    key={booking.id}
                    className={`bg-white dark:bg-gray-900 border rounded-2xl p-4 transition-all ${
                      booking.status === 'cancelled'
                        ? 'border-gray-100 dark:border-gray-800 opacity-60'
                        : 'border-gray-200 dark:border-gray-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <Clock className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">
                            {formatBookingTime(booking.startAt, booking.endAt)}
                          </span>
                          {booking.status === 'cancelled' && (
                            <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-medium border border-red-100">
                              Cancelled
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {booking.guestName}
                        </p>
                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                          <Mail className="w-3 h-3" />
                          {booking.guestEmail}
                        </p>
                        {booking.notes && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 bg-gray-50 dark:bg-gray-800 px-3 py-2 rounded-lg italic">
                            &ldquo;{booking.notes}&rdquo;
                          </p>
                        )}
                      </div>

                      {booking.status === 'confirmed' && (
                        <button
                          onClick={() => cancelBooking(booking.id)}
                          disabled={cancellingId === booking.id}
                          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                          title="Cancel booking"
                        >
                          {cancellingId === booking.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <X className="w-3 h-3" />
                          )}
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {tab === 'upcoming' && cancelledBookings.length > 0 && (
                  <p className="text-xs text-center text-gray-400 pt-2">
                    {cancelledBookings.length} cancelled booking
                    {cancelledBookings.length !== 1 ? 's' : ''} not shown.
                    Switch to &ldquo;Past&rdquo; to see all.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}
