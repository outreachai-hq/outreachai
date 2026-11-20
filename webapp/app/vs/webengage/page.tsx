import type { Metadata } from 'next'
import Link from 'next/link'
import { Check, ArrowRight, Star } from 'lucide-react'

export const metadata: Metadata = {
  title: 'OutreachAI vs WebEngage — B2B Outreach vs B2C Retention',
  description: 'OutreachAI vs WebEngage: OutreachAI is built for B2B sales teams — cold email, LinkedIn automation, CRM pipeline, and workflow automation. Free vs WebEngage\'s $199–$999/month.',
}

const rows = [
  // Outreach & Acquisition
  { feature: 'Cold email sequences',          outreach: true,      webengage: false,     category: 'Outreach & Acquisition' },
  { feature: 'LinkedIn automation',           outreach: true,      webengage: false,     category: 'Outreach & Acquisition' },
  { feature: 'Chrome extension (lead capture)', outreach: true,    webengage: false,     category: 'Outreach & Acquisition' },
  { feature: 'Email warmup',                  outreach: true,      webengage: false,     category: 'Outreach & Acquisition' },
  { feature: 'A/B subject line testing',      outreach: true,      webengage: true,      category: 'Outreach & Acquisition' },
  { feature: 'Meeting scheduler',             outreach: true,      webengage: false,     category: 'Outreach & Acquisition' },
  // CRM & Pipeline
  { feature: 'CRM deal pipeline (Kanban)',    outreach: true,      webengage: false,     category: 'CRM & Pipeline' },
  { feature: 'Contact & Company records',     outreach: true,      webengage: 'partial', category: 'CRM & Pipeline' },
  { feature: 'Activity timeline per lead',    outreach: true,      webengage: 'partial', category: 'CRM & Pipeline' },
  { feature: 'Custom fields',                 outreach: true,      webengage: true,      category: 'CRM & Pipeline' },
  { feature: 'Hot leads scoring',             outreach: true,      webengage: true,      category: 'CRM & Pipeline' },
  // Automation
  { feature: 'Workflow automation engine',    outreach: true,      webengage: true,      category: 'Automation' },
  { feature: 'Visual journey builder',        outreach: 'partial', webengage: true,      category: 'Automation' },
  { feature: 'Conditional sequence steps',   outreach: true,      webengage: true,      category: 'Automation' },
  { feature: 'Trigger-based campaigns',       outreach: true,      webengage: true,      category: 'Automation' },
  { feature: 'Liquid / dynamic variables',    outreach: true,      webengage: true,      category: 'Automation' },
  // Channels
  { feature: 'Email marketing campaigns',     outreach: true,      webengage: true,      category: 'Channels' },
  { feature: 'Push notifications (web/mobile)', outreach: false,   webengage: true,      category: 'Channels' },
  { feature: 'SMS campaigns',                 outreach: false,     webengage: true,      category: 'Channels' },
  { feature: 'WhatsApp Business',             outreach: false,     webengage: true,      category: 'Channels' },
  { feature: 'In-app messaging (mobile SDK)', outreach: false,     webengage: true,      category: 'Channels' },
  // Analytics
  { feature: 'Campaign analytics',            outreach: true,      webengage: true,      category: 'Analytics' },
  { feature: 'Composable dashboards',         outreach: true,      webengage: true,      category: 'Analytics' },
  { feature: 'Cohort & retention analysis',   outreach: false,     webengage: true,      category: 'Analytics' },
  { feature: 'Funnel analysis',               outreach: false,     webengage: true,      category: 'Analytics' },
  { feature: 'Website visitor tracking',      outreach: true,      webengage: 'partial', category: 'Analytics' },
  { feature: 'Deliverability monitoring',     outreach: true,      webengage: 'partial', category: 'Analytics' },
  // Platform
  { feature: 'AI personalization (BYO key)',  outreach: true,      webengage: 'partial', category: 'Platform' },
  { feature: 'Webhooks & integrations',       outreach: true,      webengage: true,      category: 'Platform' },
  { feature: 'Team workspaces',               outreach: true,      webengage: true,      category: 'Platform' },
  { feature: 'GDPR unsubscribe',              outreach: true,      webengage: true,      category: 'Platform' },
]

const whySwitchCards = [
  {
    icon: '🎯',
    title: 'Built for B2B sales — not B2C apps',
    items: [
      'Cold email + LinkedIn outreach in one tool',
      'CRM pipeline to track deals (Kanban)',
      'Chrome extension to capture leads from LinkedIn',
      'Email warmup for new sending domains',
      'Meeting scheduler built in',
    ],
  },
  {
    icon: '💸',
    title: 'Free vs $199–$999/month',
    items: [
      'OutreachAI is free during beta',
      'WebEngage starts at ~$199/month',
      'No per-MAU pricing that explodes as you grow',
      'No seat licences',
      'All features included — no tier gates',
    ],
  },
  {
    icon: '🤖',
    title: 'AI that works with your API key',
    items: [
      'Bring your own Anthropic or OpenAI key',
      'AI-generated personalised openers per lead',
      'AI inbox reply suggestions',
      'AI auto-classify inbound replies',
      'No AI markup — you pay your provider directly',
    ],
  },
]

const differenceCards = [
  {
    heading: 'OutreachAI is better for',
    color: 'border-blue-200 bg-blue-50',
    headingColor: 'text-blue-700',
    items: [
      '🏢 B2B sales teams doing cold outreach',
      '📧 Cold email + LinkedIn automation',
      '🤝 SDRs and founders prospecting new customers',
      '📊 CRM pipeline (deal tracking, won/lost)',
      '📅 Meeting scheduling from sequences',
      '🔥 Email warmup for new domains',
    ],
  },
  {
    heading: 'WebEngage is better for',
    color: 'border-orange-200 bg-orange-50',
    headingColor: 'text-orange-700',
    items: [
      '📱 B2C apps with large user bases',
      '🔔 Push notifications (iOS, Android, web)',
      '💬 WhatsApp + SMS re-engagement',
      '📉 Churn reduction and retention',
      '🔄 In-app messaging and onboarding flows',
      '📊 Cohort and retention analytics',
    ],
  },
]

const testimonials = [
  {
    quote: 'We were using WebEngage for our app users and still needed a separate tool for B2B outreach. OutreachAI replaced the outreach side completely — sequences, LinkedIn, CRM — all in one.',
    name: 'Arjun Mehta',
    role: 'Head of Growth, B2B SaaS',
    avatar: 'AM',
    color: 'bg-blue-500',
  },
  {
    quote: 'WebEngage is great for consumer apps. For B2B sales, OutreachAI is the right choice — the LinkedIn automation and pipeline together saved us two tools.',
    name: 'Priya Sharma',
    role: 'Sales Lead, Enterprise SaaS',
    avatar: 'PS',
    color: 'bg-violet-500',
  },
  {
    quote: 'The free pricing during beta is what got us started. Now we\'ve replaced Lemlist + HubSpot. WebEngage was never really competing — different use case.',
    name: 'Rohan Desai',
    role: 'Founder, RevOps startup',
    avatar: 'RD',
    color: 'bg-emerald-500',
  },
]

function Cell({ value }: { value: boolean | string }) {
  if (value === true) return <span className="flex items-center justify-center"><span className="text-lg">✅</span></span>
  if (value === false) return <span className="flex items-center justify-center"><span className="text-lg">❌</span></span>
  if (value === 'partial') return <span className="flex items-center justify-center text-amber-500 text-xs font-medium">🟡 Partial</span>
  return null
}

const categories = [...new Set(rows.map(r => r.category))]

export default function VsWebEngagePage() {
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

      {/* Hero */}
      <section className="bg-gray-950 pt-20 pb-24 text-center px-6">
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-orange-500/20 text-orange-300 text-xs font-semibold px-4 py-2 rounded-full mb-8 border border-orange-500/30">
            OutreachAI vs WebEngage
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold text-white tracking-tight leading-[1.05] mb-6">
            B2B outreach tool.<br />
            <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
              Not a B2C retention platform.
            </span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            WebEngage is great for consumer apps and push notifications.<br />
            OutreachAI is built for B2B sales teams who need cold email, LinkedIn automation, and a CRM pipeline — for free.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-600 hover:to-violet-700 text-white font-bold px-8 py-4 rounded-xl transition-all shadow-lg shadow-blue-500/25 text-base"
            >
              Start free
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a href="#comparison" className="text-gray-400 hover:text-white text-sm font-medium transition-colors">
              See full comparison ↓
            </a>
          </div>
        </div>
      </section>

      {/* Price banner */}
      <section className="bg-amber-50 border-y border-amber-200 py-8 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div className="p-4 rounded-xl bg-red-50 border border-red-100">
              <div className="text-sm font-semibold text-red-500 mb-1">WebEngage</div>
              <div className="text-2xl font-extrabold text-gray-900">$199<span className="text-base font-normal text-gray-500">+/mo</span></div>
              <div className="text-xs text-gray-500 mt-1">scales with MAU — grows fast</div>
            </div>
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
              <div className="text-sm font-semibold text-emerald-600 mb-1">OutreachAI</div>
              <div className="text-2xl font-extrabold text-gray-900">FREE</div>
              <div className="text-xs text-gray-500 mt-1">Free during beta — all features</div>
            </div>
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
              <div className="text-sm font-semibold text-blue-600 mb-1">Key difference</div>
              <div className="text-xl font-extrabold text-gray-900">B2B vs B2C</div>
              <div className="text-xs text-gray-500 mt-1">different tools for different teams</div>
            </div>
          </div>
        </div>
      </section>

      {/* Use case clarity */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Which tool is right for you?</h2>
            <p className="text-gray-500 mt-2">The honest answer — they serve different teams.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {differenceCards.map((card) => (
              <div key={card.heading} className={`rounded-2xl border p-8 ${card.color}`}>
                <h3 className={`text-lg font-bold mb-5 ${card.headingColor}`}>{card.heading}</h3>
                <ul className="space-y-3">
                  {card.items.map((item) => (
                    <li key={item} className="text-sm text-gray-700 flex items-start gap-2">
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison table */}
      <section id="comparison" className="py-20 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-3">Feature-by-feature comparison</h2>
            <p className="text-gray-500">Grouped by category — for B2B sales teams, the gaps are clear.</p>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-6 py-4 font-semibold text-gray-700 w-1/2">Feature</th>
                  <th className="text-center px-6 py-4 font-bold text-blue-700 w-1/4">OutreachAI</th>
                  <th className="text-center px-6 py-4 font-semibold text-gray-500 w-1/4">WebEngage</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat) => (
                  <>
                    <tr key={`cat-${cat}`} className="bg-gray-100 border-b border-gray-200">
                      <td colSpan={3} className="px-6 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wider">{cat}</td>
                    </tr>
                    {rows.filter(r => r.category === cat).map((row, i) => (
                      <tr key={row.feature} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                        <td className="px-6 py-3.5 text-gray-700">{row.feature}</td>
                        <td className="px-6 py-3.5"><Cell value={row.outreach} /></td>
                        <td className="px-6 py-3.5"><Cell value={row.webengage} /></td>
                      </tr>
                    ))}
                  </>
                ))}
                <tr className="bg-blue-50 border-b border-gray-100">
                  <td className="px-6 py-4 font-bold text-gray-900">Price</td>
                  <td className="px-6 py-4 text-center font-bold text-emerald-600">Free (beta)</td>
                  <td className="px-6 py-4 text-center font-semibold text-gray-500">$199–$999+/mo</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Why OutreachAI for B2B */}
      <section className="bg-white py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-3">Why B2B sales teams choose OutreachAI</h2>
            <p className="text-gray-500">For new customer acquisition — not app retention</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {whySwitchCards.map((card) => (
              <div key={card.title} className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-3xl mb-4">{card.icon}</div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">{card.title}</h3>
                <ul className="space-y-2">
                  {card.items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-gray-600">
                      <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-3">What B2B teams are saying</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {testimonials.map((t) => (
              <div key={t.name} className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-gray-700 text-sm leading-relaxed mb-6 italic">&quot;{t.quote}&quot;</p>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full ${t.color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                    {t.avatar}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{t.name}</div>
                    <div className="text-xs text-gray-400">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gray-950 py-24 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-4xl font-extrabold text-white tracking-tight mb-4">Built for B2B outreach teams</h2>
          <p className="text-gray-400 text-lg mb-8">Cold email + LinkedIn + CRM + workflows. All free during beta.</p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-600 hover:to-violet-700 text-white font-bold px-10 py-4 rounded-xl transition-all shadow-lg shadow-blue-500/25 text-lg"
          >
            Create free account
            <ArrowRight className="w-5 h-5" />
          </Link>
          <p className="text-gray-600 text-sm mt-4">No credit card needed · Free during beta</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black border-t border-white/5 py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-600">© 2026 OutreachAI.in · Made with love in India</p>
          <div className="flex items-center gap-6 text-xs text-gray-500">
            <Link href="/vs/lemlist" className="hover:text-gray-300 transition-colors">vs Lemlist</Link>
            <Link href="/vs/hubspot" className="hover:text-gray-300 transition-colors">vs HubSpot</Link>
            <Link href="/changelog" className="hover:text-gray-300 transition-colors">Changelog</Link>
            <Link href="/privacy" className="hover:text-gray-300 transition-colors">Privacy</Link>
          </div>
        </div>
      </footer>

    </div>
  )
}
