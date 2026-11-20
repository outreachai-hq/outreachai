'use client'

import Link from 'next/link'
import { LucideIcon } from 'lucide-react'

interface ActionableEmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  ctaText: string
  ctaHref: string
  helperText?: string
  alternateAction?: {
    text: string
    href: string
  }
}

export default function ActionableEmptyState({
  icon: Icon,
  title,
  description,
  ctaText,
  ctaHref,
  helperText,
  alternateAction,
}: ActionableEmptyStateProps) {
  return (
    <div className="flex items-center justify-center min-h-[500px] px-4 py-12">
      <div className="w-full max-w-md text-center">
        {/* Icon container with soft background */}
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-50 dark:bg-blue-950/40 rounded-2xl mb-6">
          <Icon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
        </div>

        {/* Title */}
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {title}
        </h3>

        {/* Description */}
        <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-6">
          {description}
        </p>

        {/* Helper text */}
        {helperText && (
          <p className="text-xs text-gray-500 dark:text-gray-500 mb-6 px-3 py-2 bg-gray-50 dark:bg-gray-900/40 rounded-lg border border-gray-100 dark:border-gray-800">
            💡 {helperText}
          </p>
        )}

        {/* Primary CTA */}
        <Link
          href={ctaHref}
          className="inline-flex items-center justify-center w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors mb-3 shadow-sm"
        >
          {ctaText}
        </Link>

        {/* Alternate action */}
        {alternateAction && (
          <Link
            href={alternateAction.href}
            className="inline-flex items-center justify-center w-full text-gray-700 dark:text-gray-300 font-medium py-2.5 px-4 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm"
          >
            {alternateAction.text}
          </Link>
        )}
      </div>
    </div>
  )
}
