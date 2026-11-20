'use client'

// Plan 7 — slash-snippet picker.
//
// Hook returns:
//   - popover:        JSX to render adjacent to the textarea (anchored below it)
//   - handleKeyDown:  spread on the textarea's onKeyDown so arrow/enter/esc work
//
// Trigger rule: `/token` must be at the start of input OR preceded by whitespace.
// That keeps URLs like `https://example.com/path` from opening the picker.

import { useEffect, useRef, useState, useCallback, type KeyboardEvent, type RefObject } from 'react'

type Snippet = {
  id: string
  key: string
  label: string
  body: string
}

type ActiveToken = { start: number; end: number; query: string }

// Cached across hook instances so the picker doesn't refetch every time the
// user opens a new reply on the same page.
let snippetCache: Snippet[] | null = null
let snippetCachePromise: Promise<Snippet[]> | null = null

async function loadSnippets(): Promise<Snippet[]> {
  if (snippetCache) return snippetCache
  if (snippetCachePromise) return snippetCachePromise
  snippetCachePromise = fetch('/api/snippets')
    .then((r) => (r.ok ? r.json() : { snippets: [] }))
    .then((d) => {
      snippetCache = (d.snippets ?? []) as Snippet[]
      return snippetCache
    })
    .finally(() => { snippetCachePromise = null })
  return snippetCachePromise
}

export function useSnippetPicker(opts: {
  textareaRef: RefObject<HTMLTextAreaElement | null>
  value: string
  onChange: (next: string) => void
}) {
  const { textareaRef, value, onChange } = opts
  const [snippets, setSnippets] = useState<Snippet[]>(() => snippetCache ?? [])
  const [active, setActive] = useState<ActiveToken | null>(null)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const activeRef = useRef<ActiveToken | null>(null)
  useEffect(() => { activeRef.current = active }, [active])

  useEffect(() => {
    loadSnippets().then((s) => setSnippets(s))
  }, [])

  // Re-evaluate the cursor position whenever the value or cursor changes.
  const reevaluate = useCallback(() => {
    const ta = textareaRef.current
    if (!ta) return
    const cursor = ta.selectionStart
    const before = ta.value.slice(0, cursor)
    // Trailing /token preceded by line-start or whitespace. Empty query is OK
    // (picker opens the moment you type `/`).
    const m = before.match(/(^|\s)\/([a-z0-9_]*)$/i)
    if (m) {
      const tokenStart = cursor - (m[2].length + 1) // 1 for the `/`
      setActive({ start: tokenStart, end: cursor, query: m[2].toLowerCase() })
      setSelectedIdx(0)
    } else {
      setActive(null)
    }
  }, [textareaRef])

  useEffect(() => { reevaluate() }, [value, reevaluate])

  const matches = active
    ? snippets
        .filter(
          (s) =>
            s.key.toLowerCase().includes(active.query) ||
            s.label.toLowerCase().includes(active.query),
        )
        .slice(0, 6)
    : []

  const insert = useCallback((snippet: Snippet) => {
    const ta = textareaRef.current
    const tok = activeRef.current
    if (!ta || !tok) return
    const before = ta.value.slice(0, tok.start)
    const after = ta.value.slice(tok.end)
    const next = before + snippet.body + after
    onChange(next)
    setActive(null)
    // Move caret to end of inserted body
    requestAnimationFrame(() => {
      const pos = tok.start + snippet.body.length
      ta.setSelectionRange(pos, pos)
      ta.focus()
    })
  }, [textareaRef, onChange])

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    const tok = activeRef.current
    if (!tok || matches.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx((i) => (i + 1) % matches.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx((i) => (i - 1 + matches.length) % matches.length)
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      insert(matches[selectedIdx])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setActive(null)
    }
  }, [matches, selectedIdx, insert])

  const popover = active && matches.length > 0 ? (
    // Anchor above the textarea — composers in this app sit at the bottom of
    // the viewport, so opening downward gets clipped by the window edge.
    <div className="absolute left-0 right-0 bottom-full mb-1 z-30 mx-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden">
      <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800">
        Snippets {active.query && <span className="text-gray-500">— matching “{active.query}”</span>}
      </div>
      <ul>
        {matches.map((s, i) => (
          <li key={s.id}>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); insert(s) }}
              onMouseEnter={() => setSelectedIdx(i)}
              className={`w-full text-left px-3 py-2 flex items-baseline gap-2 transition-colors ${
                i === selectedIdx
                  ? 'bg-violet-50 dark:bg-violet-950/50'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <code className="text-[11px] font-mono text-violet-700 dark:text-violet-200 bg-violet-50 dark:bg-violet-900/40 px-1.5 py-0.5 rounded flex-shrink-0">
                /{s.key}
              </code>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{s.label}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{s.body}</p>
              </div>
            </button>
          </li>
        ))}
      </ul>
      <div className="px-3 py-1.5 text-[10px] text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800">
        ↑↓ navigate · ⏎ insert · esc close
      </div>
    </div>
  ) : null

  return { popover, handleKeyDown }
}
