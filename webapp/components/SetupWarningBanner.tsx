'use client'

import Link from 'next/link'
import { AlertCircle, X } from 'lucide-react'
import { useState } from 'react'

interface SetupWarningBannerProps {
  title: string
  description: string
  action: {
    text: string
    href: string
  }
  onDismiss?: () => void
  variant?: 'warning' | 'info'
}

export default function SetupWarningBanner({
  title,
  description,
  action,
  onDismiss,
  variant = 'warning',
}: SetupWarningBannerProps) {
  const [dismissed, setDismissed] = useState(false)

  const handleDismiss = () => {
    setDismissed(true)
    onDismiss?.()
  }

  if (dismissed) return null

  const colorClasses = variant === 'warning'
    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/40'
    : 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/40'

  const iconColorClass = variant === 'warning'
    ? 'text-amber-600 dark:text-amber-500'
    : 'text-blue-600 dark:text-blue-500'

  const buttonColorClass = variant === 'warning'
    ? 'bg-amber-600 hover:bg-amber-700 text-white'
    : 'bg-blue-600 hover:bg-blue-700 text-white'

  return (
    <div className={`flex items-start gap-4 px-4 py-3.5 border rounded-lg ${colorClasses}`}>
      <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${iconColorClass}`} />

      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">
          {title}
        </h3>
        <p className="text-gray-600 dark:text-gray-300 text-xs leading-relaxed mb-3">
          {description}
        </p>
        <Link
          href={action.href}
          className={`inline-flex items-center px-3 py-1.5 rounded text-xs font-medium transition-colors ${buttonColorClass}`}
        >
          {action.text}
        </Link>
      </div>

      <button
        onClick={handleDismiss}
        className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-400 p-1 rounded"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
