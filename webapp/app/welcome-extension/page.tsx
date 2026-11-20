'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CheckCircle2, RefreshCw, ExternalLink } from 'lucide-react'

type Step = 'connecting' | 'login' | 'linked'

function LinkedInIcon() {
  return (
    <div className="w-16 h-16 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#0A66C2' }}>
      <span className="text-white font-black text-3xl leading-none" style={{ fontFamily: 'Georgia, serif' }}>in</span>
    </div>
  )
}

function AppIcon() {
  return (
    <div className="w-16 h-16 rounded-xl flex items-center justify-center bg-white border-2 border-blue-100 shadow-md">
      <span className="font-black text-3xl leading-none" style={{ color: '#0A66C2', fontFamily: 'Georgia, serif' }}>in</span>
    </div>
  )
}

function LinkChain({ active }: { active: boolean }) {
  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
            active ? 'bg-blue-500' : 'bg-gray-300'
          }`}
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  )
}

export default function WelcomeExtensionPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('connecting')
  const [checking, setChecking] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)

  // Auto-advance from connecting → login after animation
  useEffect(() => {
    const t = setTimeout(() => setStep('login'), 1800)
    return () => clearTimeout(t)
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoggingIn(true)
    try {
      const res = await fetch('/api/auth/callback/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (res.ok) {
        setStep('linked')
      } else {
        setError('Invalid email or password')
      }
    } catch {
      setError('Connection error. Please try again.')
    }
    setLoggingIn(false)
  }

  async function handleRefresh() {
    setChecking(true)
    await new Promise(r => setTimeout(r, 1000))
    setChecking(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'linear-gradient(135deg, #dbeafe 0%, #ede9fe 50%, #dbeafe 100%)' }}>
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-md p-10 text-center">

        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#0A66C2' }}>
            <span className="text-white font-black text-sm leading-none" style={{ fontFamily: 'Georgia, serif' }}>in</span>
          </div>
          <span className="text-lg font-extrabold text-gray-900">
            OutReachAI<span style={{ color: '#0A66C2' }}>.in</span>
          </span>
        </div>

        {/* Step: connecting */}
        {step === 'connecting' && (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Extension installed, linking your accounts...</h1>
            <p className="text-gray-500 text-sm mb-10">Finalizing setup, linking your accounts...</p>
            <div className="flex items-center justify-center gap-5 mb-10">
              <LinkedInIcon />
              <LinkChain active={true} />
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <LinkChain active={true} />
              <AppIcon />
            </div>
          </>
        )}

        {/* Step: login */}
        {step === 'login' && (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Connect your account</h1>
            <p className="text-gray-500 text-sm mb-8">Sign in to link the extension with your OutReachAI dashboard.</p>

            <div className="flex items-center justify-center gap-5 mb-8">
              <LinkedInIcon />
              <div className="flex items-center gap-1">
                {[0,1,2].map(i => (
                  <div key={i} className="w-2.5 h-2.5 rounded-full bg-gray-300" />
                ))}
              </div>
              <AppIcon />
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-center gap-3 mb-6 text-left">
              <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
                <span className="text-gray-500 text-xs">?</span>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-700">No connected account</p>
                <p className="text-xs text-gray-500">Please sign in to OutReachAI to continue</p>
              </div>
            </div>

            {error && (
              <p className="text-red-500 text-sm mb-4">{error}</p>
            )}

            <form onSubmit={handleLogin} className="space-y-3 mb-4">
              <input
                type="email" required placeholder="your@email.com"
                value={email} onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <input
                type="password" required placeholder="Password"
                value={password} onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <button type="submit" disabled={loggingIn}
                className="w-full py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-60 transition-colors"
                style={{ backgroundColor: '#0A66C2' }}>
                {loggingIn ? 'Connecting...' : 'Connect to Dashboard'}
              </button>
            </form>

            <div className="flex items-center gap-3">
              <button onClick={handleRefresh} disabled={checking}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-60">
                <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
                Refresh account
              </button>
              <a href="https://www.linkedin.com" target="_blank" rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                <ExternalLink className="w-4 h-4" />
                Open LinkedIn
              </a>
            </div>

            <p className="text-xs text-gray-400 mt-5">
              No account?{' '}
              <Link href="/signup" className="text-blue-600 hover:underline">Create one free →</Link>
            </p>
          </>
        )}

        {/* Step: linked successfully */}
        {step === 'linked' && (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">You&apos;re all set!</h1>
            <p className="text-gray-500 text-sm mb-8">
              Your LinkedIn account is now linked to OutReachAI. Open any LinkedIn profile to start sending personalized outreach.
            </p>

            <div className="flex items-center justify-center gap-5 mb-8">
              <LinkedInIcon />
              <div className="flex items-center gap-1">
                {[0,1,2].map(i => <div key={i} className="w-2.5 h-2.5 rounded-full bg-green-500" />)}
              </div>
              <AppIcon />
            </div>

            <div className="space-y-3">
              <a href="https://www.linkedin.com" target="_blank" rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors"
                style={{ backgroundColor: '#0A66C2' }}>
                <ExternalLink className="w-4 h-4" />
                Open LinkedIn &amp; start outreach
              </a>
              <Link href="/dashboard"
                className="w-full flex items-center justify-center py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                Go to Dashboard
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
