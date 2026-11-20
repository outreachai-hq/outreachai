'use client'

type BadgeVariant = 'beta' | 'live' | 'soon' | 'coming' | 'new' | 'pro' | 'enterprise'

interface ModernBadgeProps {
  variant: BadgeVariant
  label: string
  className?: string
}

const variantStyles: Record<BadgeVariant, { bg: string; text: string; border: string }> = {
  beta: {
    bg: 'bg-blue-100 dark:bg-blue-950/50',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border border-blue-200 dark:border-blue-800/40',
  },
  live: {
    bg: 'bg-emerald-100 dark:bg-emerald-950/50',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border border-emerald-200 dark:border-emerald-800/40',
  },
  soon: {
    bg: 'bg-gray-100 dark:bg-gray-800/50',
    text: 'text-gray-600 dark:text-gray-400',
    border: 'border border-gray-200 dark:border-gray-700/40',
  },
  coming: {
    bg: 'bg-amber-100 dark:bg-amber-950/50',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border border-amber-200 dark:border-amber-800/40',
  },
  new: {
    bg: 'bg-rose-100 dark:bg-rose-950/50',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border border-rose-200 dark:border-rose-800/40',
  },
  pro: {
    bg: 'bg-violet-100 dark:bg-violet-950/50',
    text: 'text-violet-700 dark:text-violet-300',
    border: 'border border-violet-200 dark:border-violet-800/40',
  },
  enterprise: {
    bg: 'bg-indigo-100 dark:bg-indigo-950/50',
    text: 'text-indigo-700 dark:text-indigo-300',
    border: 'border border-indigo-200 dark:border-indigo-800/40',
  },
}

export default function ModernBadge({
  variant,
  label,
  className,
}: ModernBadgeProps) {
  const style = variantStyles[variant]
  return (
    <span
      className={`inline-flex items-center rounded-full text-xs px-2 py-0.5 font-semibold leading-none ${style.bg} ${style.text} ${style.border} ${className || ''}`}
    >
      {label}
    </span>
  )
}
