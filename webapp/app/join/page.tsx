'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Users, Loader2, CheckCircle } from 'lucide-react'

interface InviteInfo {
  workspaceName: string
  role: string
}

function JoinContent() {
  const { data: session, status } = useSession()
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')

  const [info, setInfo] = useState<InviteInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!token) return
    setLoading(true)
    // Peek at the invite — we can infer workspace info from the join response
    // For a better UX, we'd have a public token-peek endpoint, but we don't want to expose data
    // So we just show the generic invite UI and reveal workspace name after joining
    setLoading(false)
  }, [token])

  async function acceptInvite() {
    if (!token) return
    setJoining(true)
    setError(null)
    const res = await fetch('/api/workspaces/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Failed to join workspace')
      setJoining(false)
      return
    }
    setSuccess(true)
    setTimeout(() => router.push('/dashboard'), 1500)
  }

  if (!token) {
    return (
      <div className="text-center">
        <p className="text-gray-500 dark:text-gray-400">Invalid invite link — no token found.</p>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return (
      <div className="text-center space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          You need to be signed in to accept this invite.
        </p>
        <a
          href={`/login?callbackUrl=${encodeURIComponent(`/join?token=${token}`)}`}
          className="inline-flex px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
        >
          Sign in to continue
        </a>
      </div>
    )
  }

  if (success) {
    return (
      <div className="text-center space-y-3">
        <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
        <p className="text-base font-semibold text-gray-900 dark:text-white">Workspace joined!</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">Redirecting to your dashboard…</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="w-14 h-14 bg-blue-50 dark:bg-blue-950 rounded-full flex items-center justify-center mx-auto">
          <Users className="w-7 h-7 text-blue-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">You&apos;ve been invited</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Accept the invitation to join a shared workspace and collaborate with your team.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <button
        onClick={acceptInvite}
        disabled={joining || status === 'loading'}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors"
      >
        {joining && <Loader2 className="w-4 h-4 animate-spin" />}
        {joining ? 'Joining…' : 'Accept Invitation'}
      </button>
    </div>
  )
}

export default function JoinPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-8">
        <Suspense fallback={<div className="text-center text-sm text-gray-400">Loading…</div>}>
          <JoinContent />
        </Suspense>
      </div>
    </div>
  )
}
