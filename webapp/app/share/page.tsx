'use client'

import { useState } from 'react'
import Link from 'next/link'

const PRODUCT_URL = 'https://outreachai.in'

const TWEET_TEXT = encodeURIComponent(
  "Just discovered OutreachAI — replaces $200/month of cold-outreach SaaS.\n\nLinkedIn automation, cold email sequences, marketing broadcasts, email warmup, and team workspaces. All in one place.\n\n" +
  PRODUCT_URL
)

const TWITTER_SHARE_URL = `https://twitter.com/intent/tweet?text=${TWEET_TEXT}`
const LINKEDIN_SHARE_URL = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(PRODUCT_URL)}`

export default function SharePage() {
  const [copied, setCopied] = useState(false)

  function copyLink() {
    navigator.clipboard.writeText(PRODUCT_URL).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-blue-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-800 p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="text-4xl mb-3">🎉</div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              You&apos;re all set!
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              OutreachAI is working. Help others discover it:
            </p>
          </div>

          {/* Action buttons — 2×2 grid */}
          <div className="grid grid-cols-2 gap-3 mb-8">
            <a
              href={PRODUCT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
            >
              <span>🌐</span>
              <span>Visit website</span>
            </a>

            <a
              href="https://www.producthunt.com/products/outreachai-in?launch=outreachai-in"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-orange-200 dark:border-orange-800 text-sm font-semibold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors"
            >
              <span>🗳️</span>
              <span>Vote on Product Hunt</span>
            </a>

            <a
              href={TWITTER_SHARE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-sky-200 dark:border-sky-800 text-sm font-semibold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/20 hover:bg-sky-100 dark:hover:bg-sky-900/30 transition-colors"
            >
              <span>𝕏</span>
              <span>Share on Twitter</span>
            </a>

            <a
              href={LINKEDIN_SHARE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-blue-200 dark:border-blue-800 text-sm font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
            >
              <span>in</span>
              <span>Share on LinkedIn</span>
            </a>
          </div>

          {/* Copy link section */}
          <div className="mb-6">
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
              Or copy this link to share with a colleague
            </p>
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3">
              <span className="flex-1 text-sm text-gray-600 dark:text-gray-300 truncate font-mono">
                {PRODUCT_URL}
              </span>
              <button
                onClick={copyLink}
                className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Share your story */}
          <div className="border-t border-gray-100 dark:border-gray-800 pt-6">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 text-center">
              Built something cool with OutreachAI?
            </p>
            <a
              href={`mailto:girish@greatlearning.in?subject=My OutreachAI story`}
              className="flex items-center justify-center gap-1.5 text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
            >
              Share your story
              <span>→</span>
            </a>
          </div>
        </div>

        {/* Back to dashboard */}
        <div className="text-center mt-4">
          <Link
            href="/dashboard"
            className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            ← Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
