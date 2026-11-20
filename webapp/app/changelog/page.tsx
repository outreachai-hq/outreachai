import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Changelog',
  description: "What's new in OutreachAI — product updates, new features, and improvements.",
}

interface ChangelogEntry {
  date: string
  version: string
  badge: string
  badgeColor: string
  title: string
  description: string
  items: string[]
}

const ENTRIES: ChangelogEntry[] = [
  {
    date: 'Jun 24, 2026',
    version: 'v2.4',
    badge: 'New',
    badgeColor: 'bg-emerald-100 text-emerald-700',
    title: 'Website Visitor Tracking',
    description: 'Identify companies visiting your website and turn them into outreach targets. Add a 1-line JS snippet, get instant company identification via IP resolution, and auto-fire workflow actions when known prospects visit.',
    items: [
      'JS tracking snippet hosted at /api/track/snippet',
      'IP-to-company resolution via ipinfo.io',
      'Automatic lead/contact/company matching',
      'Signal agents integration for website_visit type',
      'Workflow automation: signal.fired trigger',
    ],
  },
  {
    date: 'Jun 24, 2026',
    version: 'v2.3',
    badge: 'New',
    badgeColor: 'bg-emerald-100 text-emerald-700',
    title: 'Workflow Automation',
    description: 'Automate your outreach with an If-This-Then-That engine. 13 triggers × 11 actions with AND conditions.',
    items: [
      '13 triggers: lead replied, email opened, deal won/lost, booking confirmed, and more',
      '11 actions: create deal, add tag, create task, send webhook, and more',
      'Visual workflow builder with templates',
      'Run log showing every execution',
    ],
  },
  {
    date: 'Jun 24, 2026',
    version: 'v2.2',
    badge: 'New',
    badgeColor: 'bg-emerald-100 text-emerald-700',
    title: 'In-house CRM Pipeline',
    description: 'Full Kanban deal pipeline — no HubSpot needed. Drag deals between stages, track revenue, and see your pipeline value at a glance.',
    items: [
      'Kanban board with drag-and-drop',
      'Deal slide-over with activity timeline',
      'Won/Lost tracking with reasons',
      'Pipeline stats: total value, win rate, avg deal size',
      '"Add to pipeline" from contacts, companies, inbox, hot leads',
    ],
  },
  {
    date: 'Jun 24, 2026',
    version: 'v2.1',
    badge: 'New',
    badgeColor: 'bg-emerald-100 text-emerald-700',
    title: 'Meeting Scheduler',
    description: 'Your own booking page at outreachai.in/meet/yourname. Prospects pick a slot, get a calendar invite, you get notified.',
    items: [
      'Public booking page at /meet/[slug]',
      'Availability config by day + hour range',
      'Google Calendar .ics invite on booking',
      'Bookings management page',
    ],
  },
  {
    date: 'Jun 23, 2026',
    version: 'v2.0',
    badge: 'New',
    badgeColor: 'bg-emerald-100 text-emerald-700',
    title: 'Sequence A/B Variants + Liquid Variables',
    description: 'Split-test subject lines and personalise emails with conditional logic.',
    items: [
      'A/B variants on email steps (50/50 split)',
      '{{if company}}...{{end}} conditional blocks',
      '{{if field}}...{{else}}...{{end}} with fallbacks',
      'GDPR unsubscribe link auto-added to all sequence emails',
    ],
  },
  {
    date: 'Jun 23, 2026',
    version: 'v1.9',
    badge: 'Improved',
    badgeColor: 'bg-blue-100 text-blue-700',
    title: 'Inbox bulk actions + done/snoozed',
    description: 'Triage your inbox faster with bulk operations and status management.',
    items: [
      'Bulk select conversations',
      'Bulk mark read / mark done',
      'Open / Done / All status tabs',
      'AI auto-classify replies as Interested / OOO / Not interested',
    ],
  },
  {
    date: 'Jun 23, 2026',
    version: 'v1.8',
    badge: 'New',
    badgeColor: 'bg-emerald-100 text-emerald-700',
    title: 'Signal Agents + Calls + Deliverability Alerts',
    description: 'Monitor buying intent, log calls, and get alerted when your deliverability drops.',
    items: [
      'Signal Agents: watchlists for job change, funding, LinkedIn engagement, website visits',
      'Calls: manual call log with outcome tracking',
      'Deliverability: alert rules for bounce/open/reply rate thresholds',
    ],
  },
]

export default function ChangelogPage() {
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
            <Link href="/signup" className="text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-2 rounded-lg shadow-sm hover:from-blue-700 hover:to-violet-700 transition-all">
              Start free
            </Link>
          </div>
        </div>
      </nav>

      {/* Header */}
      <div className="max-w-3xl mx-auto px-6 pt-16 pb-10">
        <p className="text-sm font-semibold text-blue-600 uppercase tracking-widest mb-3">Changelog</p>
        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-4">What&apos;s new in OutreachAI</h1>
        <p className="text-lg text-gray-500 leading-relaxed">Product updates, new features, and improvements. Most recent first.</p>
      </div>

      {/* Timeline */}
      <div className="max-w-3xl mx-auto px-6 pb-24">
        {/* Year label */}
        <div className="flex items-center gap-4 mb-8">
          <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">2026</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <div className="relative">
          {/* Vertical timeline line */}
          <div className="absolute left-[9px] top-3 bottom-3 w-px bg-gray-200" />

          <div className="space-y-12">
            {ENTRIES.map((entry, i) => (
              <div key={`${entry.version}-${i}`} className="flex gap-6">
                {/* Dot */}
                <div className="flex-shrink-0 mt-1.5">
                  <div className="w-5 h-5 rounded-full bg-blue-600 border-4 border-white ring-1 ring-blue-600 shadow-sm" />
                </div>

                {/* Content */}
                <div className="flex-1 pb-2">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="text-sm text-gray-400">{entry.date}</span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${entry.badgeColor}`}>
                      {entry.badge}
                    </span>
                    <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                      {entry.version}
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 mb-2">{entry.title}</h2>
                  <p className="text-gray-600 text-sm leading-relaxed mb-4">{entry.description}</p>
                  <ul className="space-y-1.5">
                    {entry.items.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm text-gray-600">
                        <span className="text-blue-400 mt-0.5 flex-shrink-0">•</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-16 pt-10 border-t border-gray-100 text-center">
          <p className="text-gray-500 text-sm mb-6">Want to be notified about new features?</p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-violet-600 text-white font-bold px-6 py-3 rounded-xl shadow-sm hover:from-blue-700 hover:to-violet-700 transition-all text-sm"
          >
            Create free account
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-black border-t border-white/5 py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-600">© 2026 OutreachAI.in · Made with love in India</p>
          <div className="flex items-center gap-6 text-xs text-gray-500">
            <Link href="/vs/lemlist" className="hover:text-gray-300 transition-colors">vs Lemlist</Link>
            <Link href="/vs/hubspot" className="hover:text-gray-300 transition-colors">vs HubSpot</Link>
            <Link href="/privacy" className="hover:text-gray-300 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-gray-300 transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
