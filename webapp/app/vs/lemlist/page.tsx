import type { Metadata } from 'next'
import Link from 'next/link'
import { Check, X, Minus, ArrowRight, Star } from 'lucide-react'

export const metadata: Metadata = {
  title: 'OutreachAI vs Lemlist — Free Alternative Comparison',
  description: 'OutreachAI vs Lemlist: feature-by-feature comparison. OutreachAI is free and includes CRM pipeline, workflow automation, and meeting scheduler that Lemlist charges $800+/month for.',
}

const rows = [
  { feature: 'Email sequences',           outreach: true,      lemlist: true },
  { feature: 'LinkedIn automation',       outreach: true,      lemlist: true },
  { feature: 'A/B testing',               outreach: true,      lemlist: true },
  { feature: 'Conditional steps',         outreach: true,      lemlist: true },
  { feature: 'Auto-stop on reply',        outreach: true,      lemlist: true },
  { feature: 'AI personalization (BYO key)', outreach: true,   lemlist: 'partial' },
  { feature: 'Liquid conditional variables', outreach: true,   lemlist: true },
  { feature: 'CRM pipeline (Kanban)',      outreach: true,     lemlist: false },
  { feature: 'Workflow automation',        outreach: true,     lemlist: 'partial' },
  { feature: 'Meeting scheduler',          outreach: true,     lemlist: 'extra' },
  { feature: 'Website visitor tracking',   outreach: true,     lemlist: 'extra' },
  { feature: 'Signal agents',              outreach: true,     lemlist: true },
  { feature: 'Email warmup',               outreach: true,     lemlist: 'extra' },
  { feature: 'Marketing campaigns',        outreach: true,     lemlist: false },
  { feature: 'Composable dashboards',      outreach: true,     lemlist: true },
  { feature: 'Chrome extension',           outreach: true,     lemlist: true },
  { feature: 'GDPR unsubscribe',           outreach: true,     lemlist: true },
  { feature: 'Deliverability alerts',      outreach: true,     lemlist: false },
]

const whySwitchCards = [
  {
    icon: '✅',
    title: 'Everything Lemlist does',
    items: ['Email sequences with conditions', 'LinkedIn automation', 'A/B testing on subject lines', 'Auto-pause on reply', 'Liquid conditional variables'],
  },
  {
    icon: '💰',
    title: 'Things Lemlist charges extra for',
    items: ['Email warmup (included free)', 'Meeting scheduler (included free)', 'Website visitor tracking (included free)', 'All features in one plan'],
  },
  {
    icon: '🚀',
    title: 'Things Lemlist does not have',
    items: ['Full CRM pipeline (Kanban deals)', 'Workflow automation engine', 'Marketing campaigns', 'Deliverability alerts', 'BYO AI key (no markup)'],
  },
]

const testimonials = [
  {
    quote: 'We switched from Lemlist after our third seat renewal. OutreachAI does everything and the CRM pipeline means we stopped paying for HubSpot too.',
    name: 'Sahil Patel',
    role: 'Head of Sales, B2B SaaS',
    avatar: 'SP',
    color: 'bg-violet-500',
  },
  {
    quote: 'The conditional sequence steps are better than Lemlist. And the fact that email warmup is included — not a $29/month add-on — sealed it for me.',
    name: 'Meera Iyer',
    role: 'Growth Lead, Series A startup',
    avatar: 'MI',
    color: 'bg-blue-500',
  },
  {
    quote: 'Import took 10 minutes. Our reply rates are the same and we saved $1,900 last year.',
    name: 'Vikram Nair',
    role: 'Founder, RevOps agency',
    avatar: 'VN',
    color: 'bg-emerald-500',
  },
]

function Cell({ value }: { value: boolean | string }) {
  if (value === true) return <span className="flex items-center justify-center"><span className="text-emerald-500 text-lg">✅</span></span>
  if (value === false) return <span className="flex items-center justify-center"><span className="text-red-400 text-lg">❌</span></span>
  if (value === 'partial') return <span className="flex items-center justify-center text-amber-500 text-sm font-medium">🟡 Limited</span>
  if (value === 'extra') return <span className="flex items-center justify-center text-amber-500 text-sm font-medium">🟡 Extra cost</span>
  return null
}

export default function VsLemlistPage() {
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
          <div className="inline-flex items-center gap-2 bg-blue-500/20 text-blue-300 text-xs font-semibold px-4 py-2 rounded-full mb-8 border border-blue-500/30">
            OutreachAI vs Lemlist
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold text-white tracking-tight leading-[1.05] mb-6">
            The complete outreach platform —<br />
            <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
              without the $800/month bill.
            </span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Lemlist charges $63–$159/seat/month.<br />
            OutreachAI gives you everything (and more) for free.
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
              See all features
            </a>
          </div>
        </div>
      </section>

      {/* Price banner */}
      <section className="bg-amber-50 border-y border-amber-200 py-8 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div className="p-4 rounded-xl bg-red-50 border border-red-100">
              <div className="text-sm font-semibold text-red-500 mb-1">Lemlist Pro</div>
              <div className="text-2xl font-extrabold text-gray-900">$159<span className="text-base font-normal text-gray-500">/seat/mo</span></div>
              <div className="text-xs text-gray-500 mt-1">= $1,908/year per seat</div>
            </div>
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
              <div className="text-sm font-semibold text-emerald-600 mb-1">OutreachAI</div>
              <div className="text-2xl font-extrabold text-gray-900">FREE</div>
              <div className="text-xs text-gray-500 mt-1">Free during beta</div>
            </div>
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
              <div className="text-sm font-semibold text-blue-600 mb-1">You save</div>
              <div className="text-2xl font-extrabold text-gray-900">$1,908</div>
              <div className="text-xs text-gray-500 mt-1">per seat per year</div>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison table */}
      <section id="comparison" className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-3">Feature-by-feature comparison</h2>
            <p className="text-gray-500">Every feature you care about, side by side.</p>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-6 py-4 font-semibold text-gray-700 w-1/2">Feature</th>
                  <th className="text-center px-6 py-4 font-bold text-blue-700 w-1/4">OutreachAI</th>
                  <th className="text-center px-6 py-4 font-semibold text-gray-500 w-1/4">Lemlist</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.feature} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                    <td className="px-6 py-3.5 text-gray-700">{row.feature}</td>
                    <td className="px-6 py-3.5"><Cell value={row.outreach} /></td>
                    <td className="px-6 py-3.5"><Cell value={row.lemlist} /></td>
                  </tr>
                ))}
                <tr className="bg-blue-50 border-b border-gray-100">
                  <td className="px-6 py-4 font-bold text-gray-900">Price</td>
                  <td className="px-6 py-4 text-center font-bold text-emerald-600">Free</td>
                  <td className="px-6 py-4 text-center font-semibold text-gray-500">$63–$159/seat/mo</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Why switch */}
      <section className="bg-gray-50 py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-3">Why teams switch to OutreachAI</h2>
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
      <section className="py-20 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-3">Teams who made the switch</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {testimonials.map((t) => (
              <div key={t.name} className="bg-gray-50 rounded-2xl p-8 border border-gray-100">
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
          <h2 className="text-4xl font-extrabold text-white tracking-tight mb-4">Ready to switch?</h2>
          <p className="text-gray-400 text-lg mb-8">Import your Lemlist sequences in minutes.</p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-600 hover:to-violet-700 text-white font-bold px-10 py-4 rounded-xl transition-all shadow-lg shadow-blue-500/25 text-lg"
          >
            Create free account
            <ArrowRight className="w-5 h-5" />
          </Link>
          <p className="text-gray-600 text-sm mt-4">No credit card needed. Free during beta.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black border-t border-white/5 py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-600">© 2026 OutreachAI.in · Made with love in India</p>
          <div className="flex items-center gap-6 text-xs text-gray-500">
            <Link href="/vs/hubspot" className="hover:text-gray-300 transition-colors">vs HubSpot</Link>
            <Link href="/changelog" className="hover:text-gray-300 transition-colors">Changelog</Link>
            <Link href="/privacy" className="hover:text-gray-300 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-gray-300 transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
