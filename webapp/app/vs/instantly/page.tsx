import type { Metadata } from 'next'
import Link from 'next/link'
import { Check, ArrowRight, Star } from 'lucide-react'

export const metadata: Metadata = {
  title: 'OutreachAI vs Instantly.ai — Free Alternative with LinkedIn + CRM',
  description: 'OutreachAI vs Instantly.ai: OutreachAI adds LinkedIn automation, CRM pipeline, and workflow automation on top of everything Instantly does — all free vs $37–$97/month.',
}

const rows = [
  { feature: 'Cold email sequences',           outreach: true,      instantly: true },
  { feature: 'Email warmup',                   outreach: true,      instantly: true },
  { feature: 'A/B subject line testing',       outreach: true,      instantly: true },
  { feature: 'Inbox rotation (sender pool)',   outreach: true,      instantly: true },
  { feature: 'Auto-stop on reply',             outreach: true,      instantly: true },
  { feature: 'Email open/click tracking',      outreach: true,      instantly: true },
  { feature: 'Deliverability monitoring',      outreach: true,      instantly: 'partial' },
  { feature: 'GDPR unsubscribe link',          outreach: true,      instantly: true },
  { feature: 'LinkedIn automation',            outreach: true,      instantly: false },
  { feature: 'Chrome extension (lead capture)', outreach: true,     instantly: false },
  { feature: 'LinkedIn sequences',             outreach: true,      instantly: false },
  { feature: 'CRM pipeline (Kanban)',          outreach: true,      instantly: false },
  { feature: 'Deal tracking (won/lost)',       outreach: true,      instantly: false },
  { feature: 'Contact & Company records',      outreach: true,      instantly: 'partial' },
  { feature: 'Workflow automation engine',     outreach: true,      instantly: false },
  { feature: 'Meeting scheduler',              outreach: true,      instantly: false },
  { feature: 'Website visitor tracking',       outreach: true,      instantly: false },
  { feature: 'Signal agents',                  outreach: true,      instantly: false },
  { feature: 'AI personalization (BYO key)',   outreach: true,      instantly: 'partial' },
  { feature: 'Liquid conditional variables',   outreach: true,      instantly: false },
  { feature: 'Marketing campaigns (bulk)',     outreach: true,      instantly: false },
  { feature: 'Composable dashboards',          outreach: true,      instantly: 'partial' },
  { feature: 'Webhooks',                       outreach: true,      instantly: true },
  { feature: 'Team workspaces',                outreach: true,      instantly: true },
]

const whySwitchCards = [
  {
    icon: '✅',
    title: 'Everything Instantly does',
    items: ['Cold email sequences', 'Email warmup (built-in)', 'A/B subject line testing', 'Sender pool rotation', 'Auto-stop on reply', 'Open/click tracking'],
  },
  {
    icon: '🔗',
    title: 'What Instantly is missing',
    items: ['LinkedIn automation (zero)', 'CRM pipeline to track deals', 'Workflow automation', 'Meeting scheduler', 'Chrome extension for lead capture', 'Website visitor tracking'],
  },
  {
    icon: '💸',
    title: 'Price difference',
    items: ['Instantly: $37–$97/month', 'OutreachAI: Free during beta', 'Instantly limits: 1k–5k contacts', 'OutreachAI: unlimited contacts', 'Instantly charges per email account', 'OutreachAI: unlimited email accounts'],
  },
]

const testimonials = [
  {
    quote: 'Instantly is great for pure cold email. But we needed LinkedIn too. OutreachAI gave us both in one place, plus the CRM pipeline means we stopped paying for a separate tool.',
    name: 'Kiran Reddy',
    role: 'Sales Director, B2B SaaS',
    avatar: 'KR',
    color: 'bg-blue-500',
  },
  {
    quote: 'The email warmup in OutreachAI is comparable to Instantly. But the workflow automation on top is what sealed it — reply → auto-create deal in pipeline.',
    name: 'Pooja Nair',
    role: 'Growth Manager, Series A startup',
    avatar: 'PN',
    color: 'bg-violet-500',
  },
  {
    quote: 'Instantly capped us at 1,000 contacts on the cheap plan. OutreachAI has no contact limits. We switched in an afternoon.',
    name: 'Suresh Menon',
    role: 'Founder, outbound agency',
    avatar: 'SM',
    color: 'bg-emerald-500',
  },
]

function Cell({ value }: { value: boolean | string }) {
  if (value === true) return <span className="flex items-center justify-center text-lg">✅</span>
  if (value === false) return <span className="flex items-center justify-center text-lg">❌</span>
  if (value === 'partial') return <span className="flex items-center justify-center text-amber-500 text-xs font-medium">🟡 Limited</span>
  return null
}

export default function VsInstantlyPage() {
  return (
    <div className="min-h-screen bg-white font-sans antialiased">
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg shadow-sm" style={{ backgroundColor: '#0A66C2' }}>
              <span className="text-white font-black text-[13px] leading-none" style={{ fontFamily: 'Georgia, serif' }}>in</span>
            </div>
            <span className="text-lg font-extrabold text-gray-900 tracking-tight">OutReachAI<span style={{ color: '#0A66C2' }}>.in</span></span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-2">Log in</Link>
            <Link href="/signup" className="text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-2 rounded-lg">Start free</Link>
          </div>
        </div>
      </nav>

      <section className="bg-gray-950 pt-20 pb-24 text-center px-6">
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-blue-500/20 text-blue-300 text-xs font-semibold px-4 py-2 rounded-full mb-8 border border-blue-500/30">
            OutreachAI vs Instantly.ai
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold text-white tracking-tight leading-[1.05] mb-6">
            Cold email + LinkedIn —<br />
            <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">not cold email only.</span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Instantly.ai is a solid cold email tool. OutreachAI does everything Instantly does — plus LinkedIn automation, CRM pipeline, and workflow automation. For free.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup" className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 to-violet-600 text-white font-bold px-8 py-4 rounded-xl shadow-lg shadow-blue-500/25 text-base">
              Start free <ArrowRight className="w-4 h-4" />
            </Link>
            <a href="#comparison" className="text-gray-400 hover:text-white text-sm font-medium">See full comparison ↓</a>
          </div>
        </div>
      </section>

      <section className="bg-amber-50 border-y border-amber-200 py-8 px-6">
        <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
          <div className="p-4 rounded-xl bg-red-50 border border-red-100">
            <div className="text-sm font-semibold text-red-500 mb-1">Instantly Hypergrowth</div>
            <div className="text-2xl font-extrabold text-gray-900">$97<span className="text-base font-normal text-gray-500">/mo</span></div>
            <div className="text-xs text-gray-500 mt-1">= $1,164/year</div>
          </div>
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
            <div className="text-sm font-semibold text-emerald-600 mb-1">OutreachAI</div>
            <div className="text-2xl font-extrabold text-gray-900">FREE</div>
            <div className="text-xs text-gray-500 mt-1">Free during beta</div>
          </div>
          <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
            <div className="text-sm font-semibold text-blue-600 mb-1">You save</div>
            <div className="text-2xl font-extrabold text-gray-900">$1,164</div>
            <div className="text-xs text-gray-500 mt-1">per year + get LinkedIn too</div>
          </div>
        </div>
      </section>

      <section id="comparison" className="py-20 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-3">Feature-by-feature comparison</h2>
            <p className="text-gray-500">Every feature that matters for cold outreach teams.</p>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-6 py-4 font-semibold text-gray-700 w-1/2">Feature</th>
                  <th className="text-center px-6 py-4 font-bold text-blue-700 w-1/4">OutreachAI</th>
                  <th className="text-center px-6 py-4 font-semibold text-gray-500 w-1/4">Instantly.ai</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.feature} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                    <td className="px-6 py-3.5 text-gray-700">{row.feature}</td>
                    <td className="px-6 py-3.5"><Cell value={row.outreach} /></td>
                    <td className="px-6 py-3.5"><Cell value={row.instantly} /></td>
                  </tr>
                ))}
                <tr className="bg-blue-50">
                  <td className="px-6 py-4 font-bold text-gray-900">Price</td>
                  <td className="px-6 py-4 text-center font-bold text-emerald-600">Free (beta)</td>
                  <td className="px-6 py-4 text-center font-semibold text-gray-500">$37–$97/mo</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="bg-white py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-3">Why teams switch from Instantly to OutreachAI</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {whySwitchCards.map((card) => (
              <div key={card.title} className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-3xl mb-4">{card.icon}</div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">{card.title}</h3>
                <ul className="space-y-2">
                  {card.items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-gray-600">
                      <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />{item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-3">Teams who switched from Instantly</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {testimonials.map((t) => (
              <div key={t.name} className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
                <div className="flex gap-1 mb-4">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />)}</div>
                <p className="text-gray-700 text-sm leading-relaxed mb-6 italic">&quot;{t.quote}&quot;</p>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full ${t.color} flex items-center justify-center text-white text-xs font-bold`}>{t.avatar}</div>
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

      <section className="bg-gray-950 py-24 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-4xl font-extrabold text-white tracking-tight mb-4">More than cold email</h2>
          <p className="text-gray-400 text-lg mb-8">Cold email + LinkedIn + CRM + workflows. Free during beta.</p>
          <Link href="/signup" className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 to-violet-600 text-white font-bold px-10 py-4 rounded-xl shadow-lg shadow-blue-500/25 text-lg">
            Create free account <ArrowRight className="w-5 h-5" />
          </Link>
          <p className="text-gray-600 text-sm mt-4">No credit card · Free during beta</p>
        </div>
      </section>

      <footer className="bg-black border-t border-white/5 py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-600">© 2026 OutreachAI.in · Made with love in India</p>
          <div className="flex items-center gap-6 text-xs text-gray-500">
            <Link href="/vs/lemlist" className="hover:text-gray-300">vs Lemlist</Link>
            <Link href="/vs/hubspot" className="hover:text-gray-300">vs HubSpot</Link>
            <Link href="/vs/apollo" className="hover:text-gray-300">vs Apollo</Link>
            <Link href="/vs/saleshandy" className="hover:text-gray-300">vs Saleshandy</Link>
            <Link href="/privacy" className="hover:text-gray-300">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
