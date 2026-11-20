import type { Metadata } from 'next'
import Link from 'next/link'
import { Check, ArrowRight, Star } from 'lucide-react'

export const metadata: Metadata = {
  title: 'OutreachAI vs Saleshandy — Free Cold Email Alternative with LinkedIn + CRM',
  description: 'OutreachAI vs Saleshandy: OutreachAI does everything Saleshandy does — cold email, warmup, A/B testing — plus LinkedIn automation, CRM pipeline, and workflow automation. Free.',
}

const rows = [
  { feature: 'Cold email sequences',           outreach: true,      saleshandy: true },
  { feature: 'Email warmup',                   outreach: true,      saleshandy: true },
  { feature: 'A/B subject testing',            outreach: true,      saleshandy: true },
  { feature: 'Email open/click tracking',      outreach: true,      saleshandy: true },
  { feature: 'Auto-stop on reply',             outreach: true,      saleshandy: true },
  { feature: 'Sender rotation (inbox pool)',   outreach: true,      saleshandy: true },
  { feature: 'Merge tags / personalization',   outreach: true,      saleshandy: true },
  { feature: 'Liquid conditional variables',   outreach: true,      saleshandy: false },
  { feature: 'GDPR unsubscribe link',          outreach: true,      saleshandy: true },
  { feature: 'Deliverability monitoring',      outreach: true,      saleshandy: 'partial' },
  { feature: 'LinkedIn automation',            outreach: true,      saleshandy: false },
  { feature: 'Chrome extension (lead capture)', outreach: true,     saleshandy: false },
  { feature: 'Multi-step LinkedIn sequences',  outreach: true,      saleshandy: false },
  { feature: 'CRM pipeline (Kanban)',          outreach: true,      saleshandy: false },
  { feature: 'Deal tracking (won/lost)',       outreach: true,      saleshandy: false },
  { feature: 'Contact & Company records',      outreach: true,      saleshandy: 'partial' },
  { feature: 'Activity timeline per lead',     outreach: true,      saleshandy: false },
  { feature: 'Workflow automation engine',     outreach: true,      saleshandy: false },
  { feature: 'Meeting scheduler',              outreach: true,      saleshandy: false },
  { feature: 'Website visitor tracking',       outreach: true,      saleshandy: false },
  { feature: 'Signal agents',                  outreach: true,      saleshandy: false },
  { feature: 'AI personalization (BYO key)',   outreach: true,      saleshandy: 'partial' },
  { feature: 'Marketing campaigns (bulk)',     outreach: true,      saleshandy: false },
  { feature: 'Composable dashboards',          outreach: true,      saleshandy: 'partial' },
  { feature: 'Webhooks',                       outreach: true,      saleshandy: true },
  { feature: 'Team workspaces',                outreach: true,      saleshandy: true },
]

const whySwitchCards = [
  {
    icon: '✅',
    title: 'Everything Saleshandy does',
    items: ['Cold email sequences with conditions', 'Email warmup', 'A/B subject line testing', 'Sender pool rotation', 'Auto-stop on reply', 'Open/click/reply tracking'],
  },
  {
    icon: '🚀',
    title: 'What Saleshandy is missing',
    items: ['LinkedIn automation (none)', 'CRM pipeline for deal tracking', 'Workflow automation engine', 'Meeting scheduler', 'Chrome extension for lead capture', 'Liquid conditional variables'],
  },
  {
    icon: '🇮🇳',
    title: 'Built for Indian sales teams',
    items: ['Free during beta — no per-seat fees', 'Unlimited email accounts included', 'AI with your own Anthropic/OpenAI key', 'Support during IST hours', 'No INR/USD conversion headaches', 'LinkedIn-safe automation'],
  },
]

const testimonials = [
  {
    quote: 'Saleshandy was our first cold email tool. OutreachAI replaced it completely — same warmup quality, but with LinkedIn automation and a CRM built in.',
    name: 'Nisha Gupta',
    role: 'Sales Manager, SaaS startup',
    avatar: 'NG',
    color: 'bg-pink-500',
  },
  {
    quote: 'We were paying for Saleshandy + a separate LinkedIn tool + HubSpot Starter. OutreachAI replaced all three. The saving was over ₹2 lakh a year.',
    name: 'Aditya Kumar',
    role: 'Founder, B2B services',
    avatar: 'AK',
    color: 'bg-blue-500',
  },
  {
    quote: 'The workflow automation is what Saleshandy will never build. Reply → auto-create deal in pipeline → create follow-up task. Game changer for us.',
    name: 'Priya Sharma',
    role: 'SDR Lead, Series A startup',
    avatar: 'PS',
    color: 'bg-emerald-500',
  },
]

function Cell({ value }: { value: boolean | string }) {
  if (value === true) return <span className="flex items-center justify-center text-lg">✅</span>
  if (value === false) return <span className="flex items-center justify-center text-lg">❌</span>
  if (value === 'partial') return <span className="flex items-center justify-center text-amber-500 text-xs font-medium">🟡 Limited</span>
  return null
}

export default function VsSaleshandyPage() {
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
          <div className="inline-flex items-center gap-2 bg-green-500/20 text-green-300 text-xs font-semibold px-4 py-2 rounded-full mb-8 border border-green-500/30">
            OutreachAI vs Saleshandy
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold text-white tracking-tight leading-[1.05] mb-6">
            Cold email done right —<br />
            <span className="bg-gradient-to-r from-green-400 to-blue-400 bg-clip-text text-transparent">plus LinkedIn, CRM, and automation.</span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Saleshandy is a solid cold email tool popular in India. OutreachAI does everything Saleshandy does — and adds LinkedIn automation, CRM pipeline, and a full workflow engine. All free.
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
            <div className="text-sm font-semibold text-red-500 mb-1">Saleshandy Scale</div>
            <div className="text-2xl font-extrabold text-gray-900">$219<span className="text-base font-normal text-gray-500">/mo</span></div>
            <div className="text-xs text-gray-500 mt-1">for 30 email accounts</div>
          </div>
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
            <div className="text-sm font-semibold text-emerald-600 mb-1">OutreachAI</div>
            <div className="text-2xl font-extrabold text-gray-900">FREE</div>
            <div className="text-xs text-gray-500 mt-1">Unlimited accounts · Free during beta</div>
          </div>
          <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
            <div className="text-sm font-semibold text-blue-600 mb-1">You save</div>
            <div className="text-2xl font-extrabold text-gray-900">₹2L+</div>
            <div className="text-xs text-gray-500 mt-1">per year + get LinkedIn too</div>
          </div>
        </div>
      </section>

      <section id="comparison" className="py-20 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-3">Feature-by-feature comparison</h2>
            <p className="text-gray-500">Every feature that matters for Indian B2B sales teams.</p>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-6 py-4 font-semibold text-gray-700 w-1/2">Feature</th>
                  <th className="text-center px-6 py-4 font-bold text-blue-700 w-1/4">OutreachAI</th>
                  <th className="text-center px-6 py-4 font-semibold text-gray-500 w-1/4">Saleshandy</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.feature} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                    <td className="px-6 py-3.5 text-gray-700">{row.feature}</td>
                    <td className="px-6 py-3.5"><Cell value={row.outreach} /></td>
                    <td className="px-6 py-3.5"><Cell value={row.saleshandy} /></td>
                  </tr>
                ))}
                <tr className="bg-blue-50">
                  <td className="px-6 py-4 font-bold text-gray-900">Price</td>
                  <td className="px-6 py-4 text-center font-bold text-emerald-600">Free (beta)</td>
                  <td className="px-6 py-4 text-center font-semibold text-gray-500">$25–$219/mo</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="bg-white py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-3">Why Indian sales teams choose OutreachAI</h2>
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
            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-3">Teams who switched from Saleshandy</h2>
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
          <h2 className="text-4xl font-extrabold text-white tracking-tight mb-4">Saleshandy + LinkedIn + CRM in one tool</h2>
          <p className="text-gray-400 text-lg mb-8">Made for Indian B2B sales teams. Free during beta.</p>
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
            <Link href="/vs/instantly" className="hover:text-gray-300">vs Instantly</Link>
            <Link href="/vs/apollo" className="hover:text-gray-300">vs Apollo</Link>
            <Link href="/vs/hubspot" className="hover:text-gray-300">vs HubSpot</Link>
            <Link href="/privacy" className="hover:text-gray-300">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
