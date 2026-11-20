// Unified AI provider abstraction — supports Anthropic, OpenAI, and Gemini.
// Users store their own API keys in Settings (encrypted in DB).
// Falls back to server env vars (ANTHROPIC_API_KEY etc.) if no user key set.

import { prisma } from '@/lib/prisma'
import { safeDecrypt } from '@/lib/encryption'

export type AIProvider = 'anthropic' | 'openai' | 'gemini'

export interface AIModel {
  provider: AIProvider
  model: string
  label: string
}

export const AI_MODELS: AIModel[] = [
  { provider: 'anthropic', model: 'claude-haiku-4-5-20251001',  label: 'Claude Haiku (Anthropic)' },
  { provider: 'anthropic', model: 'claude-sonnet-4-6',          label: 'Claude Sonnet (Anthropic)' },
  { provider: 'openai',    model: 'gpt-4o-mini',                label: 'GPT-4o Mini (OpenAI)' },
  { provider: 'openai',    model: 'gpt-4o',                     label: 'GPT-4o (OpenAI)' },
  { provider: 'gemini',    model: 'gemini-2.0-flash',           label: 'Gemini 2.0 Flash (Google)' },
  { provider: 'gemini',    model: 'gemini-1.5-pro',             label: 'Gemini 1.5 Pro (Google)' },
]

function getProvider(): AIProvider {
  const p = (process.env.AI_PROVIDER ?? 'anthropic').toLowerCase()
  if (p === 'openai' || p === 'gemini' || p === 'anthropic') return p as AIProvider
  return 'anthropic'
}

function getModel(): string {
  if (process.env.AI_MODEL) return process.env.AI_MODEL
  const provider = getProvider()
  if (provider === 'openai')  return 'gpt-4o-mini'
  if (provider === 'gemini')  return 'gemini-2.0-flash'
  return 'claude-haiku-4-5-20251001'
}

function getEnvApiKey(provider: AIProvider): string | undefined {
  if (provider === 'anthropic') return process.env.ANTHROPIC_API_KEY
  if (provider === 'openai')    return process.env.OPENAI_API_KEY
  if (provider === 'gemini')    return process.env.GEMINI_API_KEY
}

export function getConfiguredProviders(): AIProvider[] {
  const providers: AIProvider[] = []
  if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'placeholder') providers.push('anthropic')
  if (process.env.OPENAI_API_KEY    && process.env.OPENAI_API_KEY    !== 'placeholder') providers.push('openai')
  if (process.env.GEMINI_API_KEY    && process.env.GEMINI_API_KEY    !== 'placeholder') providers.push('gemini')
  return providers
}

// Per-user DB key takes priority over server env var
export async function resolveApiKey(provider: AIProvider, userId?: string): Promise<string | null> {
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { aiKeyAnthropic: true, aiKeyOpenai: true, aiKeyGemini: true },
    })
    if (user) {
      const encrypted = { anthropic: user.aiKeyAnthropic, openai: user.aiKeyOpenai, gemini: user.aiKeyGemini }[provider]
      if (encrypted) return safeDecrypt(encrypted)
    }
  }
  return getEnvApiKey(provider) ?? null
}

export async function generateText(prompt: string, opts?: {
  provider?: AIProvider
  model?: string
  maxTokens?: number
  systemPrompt?: string
  userId?: string
}): Promise<string> {
  const provider  = opts?.provider  ?? getProvider()
  const model     = opts?.model     ?? getModel()
  const maxTokens = opts?.maxTokens ?? 300
  const apiKey    = await resolveApiKey(provider, opts?.userId)

  if (!apiKey || apiKey === 'placeholder') {
    throw new Error(`${provider} API key not configured. Add it in Settings → AI Providers.`)
  }

  if (provider === 'anthropic') {
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const client = new Anthropic({ apiKey })
    const res = await client.messages.create({
      model,
      max_tokens: maxTokens,
      ...(opts?.systemPrompt ? { system: opts.systemPrompt } : {}),
      messages: [{ role: 'user', content: prompt }],
    })
    return res.content[0].type === 'text' ? res.content[0].text.trim() : ''
  }

  if (provider === 'openai') {
    const { default: OpenAI } = await import('openai')
    const client = new OpenAI({ apiKey })
    const messages: Array<{ role: 'system' | 'user'; content: string }> = []
    if (opts?.systemPrompt) messages.push({ role: 'system', content: opts.systemPrompt })
    messages.push({ role: 'user', content: prompt })
    const res = await client.chat.completions.create({ model, max_tokens: maxTokens, messages })
    return res.choices[0]?.message?.content?.trim() ?? ''
  }

  if (provider === 'gemini') {
    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    const genAI = new GoogleGenerativeAI(apiKey)
    const geminiModel = genAI.getGenerativeModel({
      model,
      ...(opts?.systemPrompt ? { systemInstruction: opts.systemPrompt } : {}),
    })
    const res = await geminiModel.generateContent(prompt)
    return res.response.text().trim()
  }

  throw new Error(`Unknown provider: ${provider}`)
}
