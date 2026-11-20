'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect } from 'react'
import { Bold, Italic, List, Link2, RotateCcw, RotateCw } from 'lucide-react'
import { cn } from '@/lib/cn'

// ── Variable chips ────────────────────────────────────────────────────────────

const VARS = [
  { key: 'firstName',  label: 'First name' },
  { key: 'lastName',   label: 'Last name' },
  { key: 'company',    label: 'Company' },
  { key: 'headline',   label: 'Headline' },
  { key: 'aiOpener',   label: 'AI opener' },
]

// Extract all {{var}} tokens from an HTML string
function extractVars(html: string): string[] {
  const matches = html.match(/\{\{([^}]+)\}\}/g) ?? []
  return [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, '').trim()))]
}

// ── Toolbar button ────────────────────────────────────────────────────────────

function ToolbarBtn({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      disabled={disabled}
      title={title}
      className={cn(
        'p-1.5 rounded transition-colors',
        active
          ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200'
          : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-800 dark:hover:text-gray-200',
        disabled && 'opacity-40 cursor-not-allowed',
      )}
    >
      {children}
    </button>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minHeight?: number
}

export function RichTemplateEditor({ value, onChange, placeholder = 'Write your message… Use {{firstName}}, {{company}} etc.', minHeight = 180 }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false, blockquote: false, code: false, codeBlock: false, horizontalRule: false }),
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    onUpdate({ editor }) {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'outline-none min-h-[inherit] prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-ul:my-1',
      },
    },
  })

  // Sync external value changes (e.g. when editing a different template)
  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    if (current !== value) {
      editor.commands.setContent(value ?? '', { emitUpdate: false })
    }
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  const addLink = () => {
    const url = window.prompt('URL')
    if (!url) return
    editor?.chain().focus().setLink({ href: url }).run()
  }

  const insertVar = (key: string) => {
    editor?.chain().focus().insertContent(`{{${key}}}`).run()
  }

  const detectedVars = extractVars(editor?.getHTML() ?? value)

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden focus-within:ring-2 focus-within:ring-blue-600 focus-within:border-transparent transition-all">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
        <ToolbarBtn onClick={() => editor?.chain().focus().toggleBold().run()} active={editor?.isActive('bold')} title="Bold">
          <Bold className="w-3.5 h-3.5" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor?.chain().focus().toggleItalic().run()} active={editor?.isActive('italic')} title="Italic">
          <Italic className="w-3.5 h-3.5" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor?.chain().focus().toggleBulletList().run()} active={editor?.isActive('bulletList')} title="Bullet list">
          <List className="w-3.5 h-3.5" />
        </ToolbarBtn>
        <ToolbarBtn onClick={addLink} active={editor?.isActive('link')} title="Add link">
          <Link2 className="w-3.5 h-3.5" />
        </ToolbarBtn>
        <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1" />
        <ToolbarBtn onClick={() => editor?.chain().focus().undo().run()} disabled={!editor?.can().undo()} title="Undo">
          <RotateCcw className="w-3.5 h-3.5" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor?.chain().focus().redo().run()} disabled={!editor?.can().redo()} title="Redo">
          <RotateCw className="w-3.5 h-3.5" />
        </ToolbarBtn>

        {/* Variable insertion buttons */}
        <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1" />
        <span className="text-[10px] text-gray-400 dark:text-gray-500 mr-1">Insert:</span>
        {VARS.map((v) => (
          <button
            key={v.key}
            type="button"
            onMouseDown={(e) => { e.preventDefault(); insertVar(v.key) }}
            className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-violet-50 dark:bg-violet-900 text-violet-700 dark:text-violet-200 border border-violet-200 dark:border-violet-600 hover:bg-violet-100 dark:hover:bg-violet-900/50 transition-colors whitespace-nowrap"
          >
            {`{{${v.key}}}`}
          </button>
        ))}
      </div>

      {/* Editor area */}
      <div style={{ minHeight }} className="px-3 py-2.5 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white cursor-text" onClick={() => editor?.commands.focus()}>
        <EditorContent editor={editor} />
      </div>

      {/* Detected variables footer */}
      {detectedVars.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap px-3 py-2 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30">
          <span className="text-[10px] text-gray-400 dark:text-gray-500">Variables detected:</span>
          {detectedVars.map((v) => (
            <span key={v} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-violet-50 dark:bg-violet-900 text-violet-700 dark:text-violet-200 border border-violet-200 dark:border-violet-600">
              {`{{${v}}}`}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
