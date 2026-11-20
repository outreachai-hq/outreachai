'use client'

import { useState, useEffect } from 'react'
import { X, ChevronRight } from 'lucide-react'

const TOUR_KEY = 'navtour_v1'

const STEPS = [
  {
    label: 'FIND & MANAGE',
    emoji: '👤',
    title: 'Build your lead database',
    body: 'Import contacts, create lead lists by job title or company, and track all prospects in one place.',
    y: 158,
  },
  {
    label: 'ENGAGE',
    emoji: '🚀',
    title: 'Launch outreach campaigns',
    body: 'Write multi-step email + LinkedIn sequences, run them as campaigns, and manage all replies in Inbox.',
    y: 340,
  },
  {
    label: 'GROW',
    emoji: '🌱',
    title: 'Grow your domain & brand',
    body: 'Warm up your sending domain before cold outreach. Repurpose captured LinkedIn posts as content.',
    y: 525,
  },
  {
    label: 'ANALYZE',
    emoji: '📊',
    title: 'Track what\'s working',
    body: 'Monitor open rates, reply rates, and deliverability scores. Build custom dashboards for your KPIs.',
    y: 630,
  },
]

export default function NavTour() {
  const [step, setStep] = useState(0)
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.innerWidth < 768) return
    if (!localStorage.getItem(TOUR_KEY)) {
      const t = setTimeout(() => setShow(true), 700)
      return () => clearTimeout(t)
    }
  }, [])

  function dismiss() {
    localStorage.setItem(TOUR_KEY, '1')
    setShow(false)
  }

  function next() {
    if (step < STEPS.length - 1) setStep((s) => s + 1)
    else dismiss()
  }

  if (!show) return null

  const cur = STEPS[step]
  const isLast = step === STEPS.length - 1

  return (
    <>
      {/* Sidebar section highlight */}
      <div
        className="fixed z-[45] pointer-events-none rounded-md"
        style={{
          left: 4,
          top: cur.y - 14,
          width: 252,
          height: 26,
          background: 'rgba(59, 130, 246, 0.1)',
          outline: '1px solid rgba(59, 130, 246, 0.3)',
          transition: 'top 0.25s ease',
        }}
      />

      {/* Tour card */}
      <div
        className="fixed z-50 w-[272px] bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
        style={{
          left: 272,
          top: cur.y,
          transform: 'translateY(-50%)',
          transition: 'top 0.25s ease',
        }}
      >
        {/* Blue left accent */}
        <div className="absolute left-0 inset-y-0 w-1 bg-blue-500 dark:bg-blue-500" />

        <div className="pl-5 pr-4 py-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <span className="text-base leading-none">{cur.emoji}</span>
              <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                {cur.label}
              </span>
            </div>
            <button
              onClick={dismiss}
              aria-label="Close tour"
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
            {cur.title}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            {cur.body}
          </p>

          {/* Footer */}
          <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-800">
            {/* Progress dots */}
            <div className="flex items-center gap-1">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === step
                      ? 'bg-blue-600 dark:bg-blue-400'
                      : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                  style={{ width: i === step ? 16 : 6 }}
                />
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {!isLast && (
                <button
                  onClick={dismiss}
                  className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  Skip
                </button>
              )}
              <button
                onClick={next}
                className="flex items-center gap-1 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                {isLast ? 'Got it!' : 'Next'}
                {!isLast && <ChevronRight className="w-3 h-3" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
