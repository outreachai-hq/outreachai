'use client'

import Link from 'next/link'
import { ChevronDown, ChevronUp, Check } from 'lucide-react'
import { useState, useEffect } from 'react'

interface ChecklistItem {
  id: string
  label: string
  description: string
  href: string
  completed: boolean
}

interface GettingStartedChecklistProps {
  items: ChecklistItem[]
  onItemClick?: (itemId: string) => void
}

export default function GettingStartedChecklist({
  items,
  onItemClick,
}: GettingStartedChecklistProps) {
  const [open, setOpen] = useState(true)
  const [checklist, setChecklist] = useState(items)

  useEffect(() => {
    setChecklist(items)
  }, [items])

  const completedCount = checklist.filter(item => item.completed).length
  const progressPercent = (completedCount / checklist.length) * 100

  const handleItemClick = (itemId: string) => {
    onItemClick?.(itemId)
  }

  // Hide if all items are completed
  if (completedCount === checklist.length) return null

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 rounded-lg border border-blue-200 dark:border-blue-800/40 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-blue-100/50 dark:hover:bg-blue-900/20 transition-colors"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex-shrink-0">
            {open ? (
              <ChevronUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            )}
          </div>
          <div className="flex-1 text-left">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              Get started in 3 steps
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              {completedCount} of {checklist.length} completed
            </p>
          </div>
        </div>
      </button>

      {/* Progress bar */}
      <div className="px-4 pb-3">
        <div className="h-1.5 bg-blue-200 dark:bg-blue-900/40 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Checklist items */}
      {open && (
        <div className="border-t border-blue-200 dark:border-blue-800/40">
          {checklist.map((item, index) => (
            <div
              key={item.id}
              className={`px-4 py-3.5 flex items-start gap-3 ${
                index < checklist.length - 1 ? 'border-b border-blue-100 dark:border-blue-800/20' : ''
              } ${item.completed ? 'bg-blue-100/30 dark:bg-blue-900/20' : ''}`}
            >
              {/* Checkbox */}
              <div className="flex-shrink-0 mt-0.5">
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    item.completed
                      ? 'bg-blue-600 dark:bg-blue-500 border-blue-600 dark:border-blue-500'
                      : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500'
                  }`}
                >
                  {item.completed && (
                    <Check className="w-3 h-3 text-white" strokeWidth={3} />
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <Link
                  href={item.href}
                  onClick={() => handleItemClick(item.id)}
                  className="text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  {item.label}
                </Link>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                  {item.description}
                </p>
              </div>

              {!item.completed && (
                <div className="flex-shrink-0">
                  <Link
                    href={item.href}
                    onClick={() => handleItemClick(item.id)}
                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 whitespace-nowrap ml-2"
                  >
                    Set up →
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
