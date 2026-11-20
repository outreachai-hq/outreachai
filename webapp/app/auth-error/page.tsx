'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import { AlertCircle, ArrowLeft, Mail } from 'lucide-react'

const ERROR_MESSAGES: Record<string, { title: string; detail: string }> = {
  AccessDenied: {
    title: 'Access denied',
    detail: 'Your account is not authorized to sign in. Make sure you are using the correct Google account, or sign in with email and password instead.',
  },
  OAuthSignin: {
    title: 'Google sign-in failed',
    detail: 'There was a problem connecting to Google. Please try again or use email/password login.',
  },
  OAuthCallback: {
    title: 'Google callback error',
    detail: 'The sign-in flow was interrupted. Please try again.',
  },
  OAuthCreateAccount: {
    title: 'Could not create account',
    detail: 'We could not create an account with your Google profile. Please sign up with email and password.',
  },
  Verification: {
    title: 'Verification failed',
    detail: 'The sign-in link may have expired. Please request a new one.',
  },
  Default: {
    title: 'Authentication error',
    detail: 'Something went wrong during sign in. Please try again.',
  },
}

function AuthErrorContent() {
  const searchParams = useSearchParams()
  const rawError = searchParams.get('error') ?? 'Default'
  // NextAuth sometimes appends /signin — strip it
  const error = rawError.split('/')[0]
  const { title, detail } = ERROR_MESSAGES[error] ?? ERROR_MESSAGES.Default

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-md p-8 text-center">
        {/* Icon */}
        <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <AlertCircle className="w-7 h-7 text-red-500" />
        </div>

        {/* Error name chip */}
        <span className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full bg-red-50 text-red-600 border border-red-100 mb-4">
          {error}
        </span>

        <h1 className="text-xl font-bold text-gray-900 mb-2">{title}</h1>
        <p className="text-sm text-gray-500 mb-8">{detail}</p>

        <div className="space-y-3">
          <Link
            href="/login"
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to sign in
          </Link>

          {(error === 'AccessDenied' || error === 'OAuthSignin') && (
            <Link
              href="/signup"
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-xl border border-gray-200 transition-colors"
            >
              <Mail className="w-4 h-4" />
              Sign up with email instead
            </Link>
          )}
        </div>

        <p className="mt-6 text-xs text-gray-400">
          Need help?{' '}
          <a href="mailto:girish@greatlearning.in" className="underline hover:text-gray-600">
            Contact support
          </a>
        </p>
      </div>
    </div>
  )
}

export default function AuthErrorPage() {
  return (
    <Suspense>
      <AuthErrorContent />
    </Suspense>
  )
}
