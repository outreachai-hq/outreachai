'use client'

// HelpPanel — contextual "How it works" side panel for every page.
//
// Dark mode note: this component intentionally uses `slate` classes instead
// of `gray` throughout. The app has a gray-palette CSS inversion hack in
// globals.css that remaps --color-gray-* for dark mode; slate is unaffected
// and renders correctly on both light and dark backgrounds.

import { useState, useEffect, useRef } from 'react'
import { X, HelpCircle, ChevronDown, ChevronRight } from 'lucide-react'

export interface HelpSection {
  title: string
  content: string
  example?: string
  tip?: string
}

export interface HelpPanelProps {
  title: string
  description: string
  sections: HelpSection[]
}

export function HelpPanel({ title, description, sections }: HelpPanelProps) {
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState<number | null>(0)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <>
      {/* Floating ? button — uses brand blue, visible in both modes */}
      <button
        onClick={() => setOpen(true)}
        title="How does this work?"
        className="fixed bottom-6 right-6 z-40 w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg flex items-center justify-center transition-all hover:scale-110"
      >
        <HelpCircle className="w-5 h-5" />
      </button>

      {open && <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]" />}

      {/* Panel — slate-based so it doesn't interact with the gray CSS hack */}
      <div
        ref={panelRef}
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-sm shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col
          bg-white dark:bg-slate-900
          ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex-shrink-0">
          <div className="flex-1 min-w-0 pr-3">
            <div className="flex items-center gap-1.5 mb-1">
              <HelpCircle className="w-3.5 h-3.5 text-indigo-500" />
              <span className="text-[10px] font-semibold text-indigo-500 uppercase tracking-[0.0833em]">How it works</span>
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-50 leading-snug">{title}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{description}</p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="flex-shrink-0 p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sections */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {sections.map((s, i) => (
            <div key={i} className="border border-slate-100 dark:border-slate-700 rounded-xl overflow-hidden">

              {/* Accordion trigger */}
              <button
                onClick={() => setExpanded(expanded === i ? null : i)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
              >
                <span className="flex items-center gap-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>
                  {s.title}
                </span>
                {expanded === i
                  ? <ChevronDown className="w-4 h-4 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                  : <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                }
              </button>

              {/* Expanded content */}
              {expanded === i && (
                <div className="px-4 pb-4 space-y-3 bg-slate-50/50 dark:bg-slate-800/20">
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed pt-1">{s.content}</p>

                  {s.example && (
                    <div
                      className="rounded-lg p-3 border"
                      style={{
                        background:   'var(--chip-sent-bg)',
                        borderColor:  'var(--chip-sent-border)',
                      }}
                    >
                      <p
                        className="text-[10px] font-semibold uppercase tracking-[0.0833em] mb-1.5"
                        style={{ color: 'var(--chip-sent-text)', opacity: 0.8 }}
                      >
                        Example
                      </p>
                      <p
                        className="text-xs leading-relaxed"
                        style={{ color: 'var(--chip-sent-text)' }}
                      >
                        {s.example}
                      </p>
                    </div>
                  )}

                  {s.tip && (
                    <div
                      className="rounded-lg p-3 border"
                      style={{
                        background:  'var(--chip-paused-bg)',
                        borderColor: 'var(--chip-paused-border)',
                      }}
                    >
                      <p
                        className="text-[10px] font-semibold uppercase tracking-[0.0833em] mb-1.5"
                        style={{ color: 'var(--chip-paused-text)', opacity: 0.8 }}
                      >
                        💡 Tip
                      </p>
                      <p
                        className="text-xs leading-relaxed"
                        style={{ color: 'var(--chip-paused-text)' }}
                      >
                        {s.tip}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700 flex-shrink-0">
          <p className="text-[11px] text-center text-slate-400 dark:text-slate-500">
            Press{' '}
            <kbd className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded text-[10px] font-mono">
              Esc
            </kbd>{' '}
            to close
          </p>
        </div>
      </div>
    </>
  )
}
