import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'About',
  description: 'OutreachAI — built by founders, for founders. Learn why we built an AI-powered outreach platform that is free during beta.',
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white font-sans antialiased">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg shadow-sm" style={{ backgroundColor: '#0A66C2' }}>
              <span className="text-white font-black text-[13px] leading-none" style={{ fontFamily: 'Georgia, serif' }}>in</span>
            </div>
            <span className="text-lg font-extrabold text-gray-900 tracking-tight">
              OutReachAI<span style={{ color: '#0A66C2' }}>.in</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-2">Log in</Link>
            <Link href="/signup" className="text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-2 rounded-lg shadow-sm">
              Start free
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-20">
        <div className="mb-12">
          <p className="text-sm font-semibold text-blue-600 uppercase tracking-widest mb-3">About</p>
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-6">
            Built by founders, for founders.
          </h1>
          <p className="text-xl text-gray-500 leading-relaxed">
            OutReachAI was built because cold outreach is broken — and we got tired of tools that were either too expensive, too American, or too manual for the way Indian sales teams actually work.
          </p>
        </div>

        <div className="space-y-10 text-gray-700 leading-relaxed">
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-3">The problem we&apos;re solving</h2>
            <p>
              Most LinkedIn outreach tools charge $100+/month for features that were designed for US enterprise SDR teams. Indian founders and sales teams are sending copy-paste messages and manually tracking follow-ups in spreadsheets. The result? Low reply rates, wasted hours, and burned bridges with great prospects.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-3">What we built</h2>
            <p className="mb-4">
              OutReachAI is an AI-first outreach platform that connects directly to your LinkedIn workflow. It reads your prospect&apos;s profile and recent posts to generate a genuinely personalised opening line — not a template, not a mail-merge. Then it runs your follow-up sequence automatically, pausing the moment someone replies.
            </p>
            <p>
              We&apos;re also the first outreach platform with native <strong>MCP (Model Context Protocol)</strong> support — meaning you can connect Claude Desktop or Claude Code directly to your OutReachAI account and run your entire pipeline as an AI agent.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Our principles</h2>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <span className="text-blue-600 font-bold mt-0.5">→</span>
                <span><strong>BYOK (Bring Your Own Key)</strong> — We never mark up AI costs. You pay Anthropic or OpenAI directly.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-blue-600 font-bold mt-0.5">→</span>
                <span><strong>LinkedIn-safe by design</strong> — No bots, no click automation, no ToS violations. Your account stays safe.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-blue-600 font-bold mt-0.5">→</span>
                <span><strong>Free during beta</strong> — We launched on Product Hunt with everything free. No credit card, no limits, no tricks.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-blue-600 font-bold mt-0.5">→</span>
                <span><strong>Made in India</strong> — Priced in INR, built for Indian timezones, supported by people who understand the Indian B2B market.</span>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Get in touch</h2>
            <p>
              We read every email. Reach us at{' '}
              <a href="mailto:outreachai.in@gmail.com" className="text-blue-600 underline font-medium">
                outreachai.in@gmail.com
              </a>
              {' '}— whether it&apos;s feedback, a bug report, or just to say hello.
            </p>
          </div>
        </div>

        <div className="mt-16 pt-10 border-t border-gray-100 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-violet-600 text-white font-bold px-6 py-3 rounded-xl shadow-sm hover:from-blue-700 hover:to-violet-700 transition-all"
          >
            Get started free →
          </Link>
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
            ← Back to home
          </Link>
        </div>
      </div>

      <footer className="bg-black border-t border-white/5 py-8 mt-20">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-600">© 2025 OutReachAI.in · Made with ❤️ in India</p>
          <div className="flex items-center gap-6 text-xs text-gray-600">
            <Link href="/privacy" className="hover:text-gray-400 transition-colors">Privacy policy</Link>
            <Link href="/terms" className="hover:text-gray-400 transition-colors">Terms of service</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
