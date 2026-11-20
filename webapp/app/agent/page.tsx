'use client'

import { useState, useRef, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Bot, Send, Sparkles, RefreshCw, Lightbulb } from 'lucide-react'
import { NoAiProviderGate } from '@/components/NoAiProviderGate'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: Date
}

const SUGGESTED_PROMPTS = [
  'Write a cold outreach message for a SaaS founder at a Series A startup',
  'Draft a LinkedIn connection note for a VP of Engineering',
  'Create a follow-up email for someone who opened my email 3 times but didn\'t reply',
  'Generate 5 personalized openers for leads in the fintech industry',
  'Write a short InMail to a recruiter about my product',
]

function genId() {
  return Math.random().toString(36).slice(2)
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold ${
          isUser ? 'bg-blue-600' : 'bg-gradient-to-br from-purple-500 to-blue-600'
        }`}
      >
        {isUser ? 'U' : <Bot className="w-4 h-4" />}
      </div>

      {/* Bubble */}
      <div
        className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? 'bg-blue-600 text-white rounded-tr-sm'
            : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-tl-sm shadow-sm'
        }`}
      >
        {msg.content}
      </div>
    </div>
  )
}

export default function AgentPage() {
  const { status } = useSession()
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hi! I'm your AI outreach assistant 👋\n\nI can help you:\n• Write personalized cold emails and LinkedIn messages\n• Generate follow-up sequences\n• Create AI openers for your leads\n• Review and improve your outreach copy\n\nWhat would you like to write today?`,
      createdAt: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login')
  }, [status, router])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(text?: string) {
    const content = (text ?? input).trim()
    if (!content || loading) return

    const userMsg: Message = { id: genId(), role: 'user', content, createdAt: new Date() }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/ai/suggest-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadMessages: messages.slice(-6).map((m) => ({ sender: m.role === 'user' ? 'You' : 'AI', text: m.content })),
          context: content,
          leadName: 'Prospect',
        }),
      })

      let assistantText = 'I\'m having trouble connecting right now. Please try again.'
      if (res.ok) {
        const data = await res.json()
        assistantText = data.reply ?? assistantText
      }

      const assistantMsg: Message = {
        id: genId(),
        role: 'assistant',
        content: assistantText,
        createdAt: new Date(),
      }
      setMessages((prev) => [...prev, assistantMsg])
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: genId(), role: 'assistant', content: 'Something went wrong. Please try again.', createdAt: new Date() },
      ])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  if (status === 'loading') return null

  return (
    <NoAiProviderGate featureName="the AI Agent">
    <div className="flex flex-col h-full max-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center shadow-sm">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900 dark:text-white">AI Agent</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Powered by Claude — writes outreach for you</p>
          </div>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-600">
            Beta
          </span>
        </div>
        <button
          onClick={() => setMessages([{
            id: 'welcome',
            role: 'assistant',
            content: 'Hi again! What would you like to write?',
            createdAt: new Date(),
          }])}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors border border-gray-200 dark:border-gray-700"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          New chat
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4 bg-gray-50 dark:bg-gray-950">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex-shrink-0 flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Suggestions (shown when only 1 message) */}
      {messages.length === 1 && (
        <div className="px-6 pb-3 bg-gray-50 dark:bg-gray-950 flex-shrink-0">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Lightbulb className="w-3.5 h-3.5" />
            Try a prompt
          </p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => sendMessage(prompt)}
                className="text-xs px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-800 hover:border-blue-300 hover:text-blue-600 transition-colors bg-white dark:bg-gray-900 shadow-sm"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-6 pb-6 pt-3 bg-white dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800 flex-shrink-0">
        <div className="flex items-end gap-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 shadow-sm focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all">
          <Sparkles className="w-4 h-4 text-purple-500 flex-shrink-0 mb-0.5" />
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me to write something… (Shift+Enter for new line)"
            className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 resize-none outline-none max-h-36 overflow-y-auto"
            style={{ lineHeight: '1.5' }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className="w-8 h-8 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-[11px] text-gray-400 text-center mt-2">
          AI-generated content — always review before sending to prospects
        </p>
      </div>
    </div>
    </NoAiProviderGate>
  )
}
