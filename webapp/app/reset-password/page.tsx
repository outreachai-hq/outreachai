'use client'
import { useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'

function ResetForm() {
  const params = useSearchParams()
  const router = useRouter()
  const token = params.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    setLoading(true); setError(null)
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Failed to reset'); setLoading(false); return }
    router.push('/login?reset=1')
  }

  if (!token) return (
    <div className="text-center">
      <p className="text-red-600 text-sm mb-4">Invalid reset link.</p>
      <Link href="/forgot-password" className="text-blue-600 hover:underline text-sm">Request a new one</Link>
    </div>
  )

  return (
    <>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Set new password</h1>
      <p className="text-sm text-gray-500 mb-6">Choose a strong password for your account.</p>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">{error}</div>}
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">New password</label>
          <input type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm password</label>
          <input type="password" required minLength={8} value={confirm} onChange={e => setConfirm(e.target.value)}
            placeholder="Repeat password"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" />
        </div>
        <button type="submit" disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors">
          {loading ? 'Resetting…' : 'Reset password'}
        </button>
      </form>
    </>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#0A66C2' }}>
            <span className="text-white font-black text-sm leading-none" style={{ fontFamily: 'Georgia, serif' }}>in</span>
          </div>
          <span className="text-xl font-extrabold text-gray-900 tracking-tight">OutReachAI<span style={{ color: '#0A66C2' }}>.in</span></span>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
          <Suspense fallback={<div className="text-center text-gray-400 text-sm">Loading…</div>}>
            <ResetForm />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
