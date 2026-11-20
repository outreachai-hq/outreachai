'use client'

import { ExternalLink, Star, Users, Zap } from 'lucide-react'
import { CHROME_STORE_URL } from '@/lib/extension'

const FEATURES = [
  { icon: Zap, title: 'AI-personalised openers', desc: 'One click to generate a hyper-personalised message on any LinkedIn profile.' },
  { icon: Users, title: 'Auto-sync to dashboard', desc: 'Contacts are pushed to your OutreachAI CRM instantly — no manual export.' },
  { icon: Star, title: 'Track replies & follow-ups', desc: 'See reply status and schedule follow-ups directly from the extension.' },
]

// Manual-install fallback (latest build; may be newer than the store version while in review).
const EXTENSION_VERSION = '1.5'
const EXTENSION_ZIP_URL = `/outreachai-extension-v${EXTENSION_VERSION}.zip`

const INSTALL_STEPS = [
  <><a href={EXTENSION_ZIP_URL} download className="text-blue-600 dark:text-blue-400 font-semibold hover:underline">Download the .zip</a> and unzip it. You&apos;ll get a folder named <code className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-xs">outreachai-extension-v{EXTENSION_VERSION}</code>.</>,
  <>In Chrome, open <code className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-xs">chrome://extensions</code> (paste it into the address bar).</>,
  <>Turn on <strong>Developer mode</strong> using the toggle in the top-right corner.</>,
  <>Click <strong>Load unpacked</strong> and select that unzipped folder.</>,
  <>Pin it from the puzzle-piece menu, open LinkedIn, and sign in to OutreachAI from the extension popup.</>,
]

export default function DownloadExtensionPage() {
  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1 rounded-full bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800/50 mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
          Live on Chrome Web Store
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">OutreachAI for LinkedIn</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Add our Chrome extension and start sending AI-personalised LinkedIn messages in seconds.
        </p>
      </div>

      {/* Install card */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6 mb-8 flex items-center gap-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/extension-icon-128.png" alt="" width={56} height={56} className="w-14 h-14 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 dark:text-white">OutreachAI for LinkedIn</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Manifest V3 · Free</p>
        </div>
        <a
          href={CHROME_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors flex-shrink-0"
        >
          <ExternalLink className="w-4 h-4" />
          Add to Chrome
        </a>
      </div>

      {/* Manual install steps */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Can&apos;t use the Web Store? Install manually</h2>
        <ol className="space-y-3">
          {INSTALL_STEPS.map((step, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-gray-600 dark:text-gray-300">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center justify-center">{i + 1}</span>
              <span className="pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
        <p className="text-xs text-gray-400 mt-4">
          Chrome may show a &ldquo;Disable developer mode extensions&rdquo; notice on startup — click <strong>Keep</strong>. Manual installs don&apos;t auto-update — use the Web Store when you can.
        </p>
      </div>

      {/* Features */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-5">What you get</h2>
        <ul className="space-y-5">
          {FEATURES.map((f, i) => (
            <li key={i} className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900 flex items-center justify-center">
                <f.icon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{f.title}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{f.desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-gray-400 text-center">
        Works on Chrome and all Chromium-based browsers (Edge, Brave, Arc).
      </p>
    </div>
  )
}
