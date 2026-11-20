'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import {
  Bold, Italic, List, ListOrdered, Link2, Heading2,
  Heading3, Code, Minus, RotateCcw, RotateCw,
} from 'lucide-react'

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  disabled?: boolean
  placeholder?: string
}

function ToolbarBtn({
  onClick, active, disabled, title, children,
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
      className={`p-1.5 rounded transition-colors text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed ${
        active ? 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white' : ''
      }`}
    >
      {children}
    </button>
  )
}

const VAR_BUTTONS = [
  { label: '{{firstName}}', title: 'Insert first name' },
  { label: '{{lastName}}',  title: 'Insert last name' },
  { label: '{{company}}',   title: 'Insert company' },
  { label: '{{email}}',     title: 'Insert email' },
]

export function RichTextEditor({ value, onChange, disabled, placeholder }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-blue-600 underline cursor-pointer' } }),
      Placeholder.configure({ placeholder: placeholder ?? 'Write your email body here…' }),
    ],
    content: value,
    editable: !disabled,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[400px] px-4 py-3 text-gray-900 dark:text-gray-100',
      },
    },
  })

  if (!editor) return null

  const addLink = () => {
    const url = window.prompt('Enter URL')
    if (url) editor.chain().focus().setLink({ href: url }).run()
  }

  const insertVar = (v: string) => {
    editor.chain().focus().insertContent(v).run()
  }

  return (
    <div className={`border rounded-lg overflow-hidden ${disabled ? 'opacity-60 cursor-not-allowed' : 'border-gray-300 dark:border-gray-700 focus-within:ring-2 focus-within:ring-blue-600 focus-within:border-transparent'}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex-wrap">
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} disabled={disabled} title="Bold">
          <Bold className="w-3.5 h-3.5" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} disabled={disabled} title="Italic">
          <Italic className="w-3.5 h-3.5" />
        </ToolbarBtn>

        <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1" />

        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} disabled={disabled} title="Heading 2">
          <Heading2 className="w-3.5 h-3.5" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} disabled={disabled} title="Heading 3">
          <Heading3 className="w-3.5 h-3.5" />
        </ToolbarBtn>

        <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1" />

        <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} disabled={disabled} title="Bullet list">
          <List className="w-3.5 h-3.5" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} disabled={disabled} title="Numbered list">
          <ListOrdered className="w-3.5 h-3.5" />
        </ToolbarBtn>

        <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1" />

        <ToolbarBtn onClick={addLink} active={editor.isActive('link')} disabled={disabled} title="Insert link">
          <Link2 className="w-3.5 h-3.5" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} disabled={disabled} title="Inline code">
          <Code className="w-3.5 h-3.5" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} disabled={disabled} title="Divider">
          <Minus className="w-3.5 h-3.5" />
        </ToolbarBtn>

        <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1" />

        <ToolbarBtn onClick={() => editor.chain().focus().undo().run()} disabled={disabled || !editor.can().undo()} title="Undo">
          <RotateCcw className="w-3.5 h-3.5" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().redo().run()} disabled={disabled || !editor.can().redo()} title="Redo">
          <RotateCw className="w-3.5 h-3.5" />
        </ToolbarBtn>

        {/* Personalisation variables */}
        <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1" />
        <span className="text-xs text-gray-400 mr-1">Insert:</span>
        {VAR_BUTTONS.map(({ label, title }) => (
          <button
            key={label}
            type="button"
            onMouseDown={(e) => { e.preventDefault(); insertVar(label) }}
            disabled={disabled}
            title={title}
            className="px-1.5 py-0.5 text-xs font-mono bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors disabled:opacity-40"
          >
            {label}
          </button>
        ))}
      </div>

      {/* Editor area */}
      <div className="bg-white dark:bg-gray-800">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
