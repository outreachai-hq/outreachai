'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Settings, ArrowRight, Loader2 } from 'lucide-react'

interface AiStatus {
  configured: { anthropic: boolean; openai: boolean; gemini: boolean }
}

export function useAiConfigured() {
  const [state, setState] = useState<'loading' | 'configured' | 'missing'>('loading')

  useEffect(() => {
    fetch('/api/settings/ai-keys')
      .then((r) => r.json())
      .then((data: AiStatus) => {
        const any = Object.values(data.configured ?? {}).some(Boolean)
        setState(any ? 'configured' : 'missing')
      })
      .catch(() => setState('missing'))
  }, [])

  return state
}

interface NoAiProviderGateProps {
  children: React.ReactNode
  featureName?: string
}

export function NoAiProviderGate({ children, featureName = 'this feature' }: NoAiProviderGateProps) {
  const status = useAiConfigured()
  const router = useRouter()

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    )
  }

  if (status === 'missing') {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center mb-6 shadow-lg">
          <Sparkles className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Set up your AI provider first
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-8">
          To use {featureName}, add an API key for Anthropic, OpenAI, or Google Gemini in Settings.
        </p>
        <button
          onClick={() => router.push('/settings#ai-providers')}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
        >
          <Settings className="w-4 h-4" />
          Go to Settings
          <ArrowRight className="w-4 h-4" />
        </button>
        <p className="text-xs text-gray-400 mt-4">
          Your key is encrypted and stored securely — never shared.
        </p>
      </div>
    )
  }

  return <>{children}</>
}
