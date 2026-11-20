'use client'

import { ReactNode } from 'react'
import GettingStartedChecklist from '@/components/GettingStartedChecklist'

interface DashboardLayoutProps {
  children: ReactNode
  title?: string
  showChecklist?: boolean
  checklistItems?: Array<{
    id: string
    label: string
    description: string
    href: string
    completed: boolean
  }>
  onChecklistItemClick?: (itemId: string) => void
}

export default function DashboardLayout({
  children,
  title,
  showChecklist = false,
  checklistItems = [],
  onChecklistItemClick,
}: DashboardLayoutProps) {
  return (
    <div className="w-full h-full flex flex-col">
      {/* Header */}
      {title && (
        <div className="border-b border-gray-200 dark:border-gray-800 px-6 py-4 bg-white dark:bg-gray-950">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
        </div>
      )}

      {/* Content area with scrollable region */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="p-6 max-w-7xl mx-auto w-full">
          {/* Getting Started Checklist */}
          {showChecklist && checklistItems.length > 0 && (
            <div className="mb-6">
              <GettingStartedChecklist
                items={checklistItems}
                onItemClick={onChecklistItemClick}
              />
            </div>
          )}

          {/* Main content */}
          {children}
        </div>
      </div>
    </div>
  )
}
