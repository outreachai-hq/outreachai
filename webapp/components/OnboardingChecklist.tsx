'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const DISMISS_KEY = 'outreachai_onboarding_dismissed'

interface OnboardingStep {
  id: number
  label: string
  href: string
  done: boolean
}

interface OnboardingState {
  onboardingCompleted: boolean
  onboardingStep: number
  steps: OnboardingStep[]
}

export default function OnboardingChecklist() {
  const [state, setState] = useState<OnboardingState | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setDismissed(!!localStorage.getItem(DISMISS_KEY))
    }
    fetch('/api/onboarding')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setState(data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function dismiss() {
    if (typeof window !== 'undefined') {
      localStorage.setItem(DISMISS_KEY, '1')
    }
    setDismissed(true)
  }

  if (loading || !state) return null
  if (dismissed || state.onboardingCompleted) return null

  const completedCount = state.steps.filter((s) => s.done).length
  const totalCount = state.steps.length
  const allDone = completedCount === totalCount
  const progressPercent = (completedCount / totalCount) * 100

  if (allDone) {
    return (
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-6 py-4 mb-6 flex items-center justify-between gap-4">
        <p className="text-sm font-semibold text-green-700 dark:text-green-400">
          🎉 You&apos;re all set!
        </p>
        <Link
          href="/share"
          className="flex-shrink-0 text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg px-3 py-1.5 transition-colors hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
        >
          Help spread the word →
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 mb-6">
      {/* Header */}
      <div className="flex items-start justify-between px-6 pt-5 pb-3">
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">
            Get started with OutreachAI
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Complete these steps to launch your first campaign
          </p>
          {/* Progress bar */}
          <div className="flex items-center gap-3 mt-3">
            <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap flex-shrink-0">
              {completedCount} of {totalCount} complete
            </span>
          </div>
        </div>
        <button
          onClick={dismiss}
          title="Dismiss"
          className="ml-4 mt-0.5 flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors text-lg leading-none"
        >
          ×
        </button>
      </div>

      {/* Steps */}
      <div className="divide-y divide-gray-100 dark:divide-gray-800 pb-2">
        {state.steps.map((step) => (
          <div
            key={step.id}
            className="flex items-center gap-3 px-6 py-3"
          >
            {/* Status indicator */}
            {step.done ? (
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                  <path
                    d="M2 6l3 3 5-5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            ) : (
              <div className="flex-shrink-0 w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600" />
            )}

            {/* Label */}
            <span
              className={`flex-1 text-sm ${
                step.done
                  ? 'text-gray-400 dark:text-gray-600 line-through'
                  : 'text-gray-800 dark:text-gray-200 font-medium'
              }`}
            >
              {step.label}
            </span>

            {/* CTA */}
            {!step.done && (
              <Link
                href={step.href}
                className="flex-shrink-0 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg px-3 py-1.5 transition-colors hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
              >
                Go →
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
