import type { Metadata } from 'next'
import Link from 'next/link'
import { Check, ArrowRight, Star } from 'lucide-react'

export const metadata: Metadata = {
  title: 'OutreachAI vs Apollo.io — Free Outreach Alternative with LinkedIn + CRM',
  description: 'OutreachAI vs Apollo.io: OutreachAI gives you outreach sequences, LinkedIn automation, CRM pipeline, and workflow automation without Apollo\'s $49–$99/seat data costs.',
}

const rows = [
  { feature: 'Cold email sequences',           outreach: true,   apollo: true },
  { feature: 'Email open/click tracking',      outreach: true,   apollo: true },
  { feature: 'A/B subject testing',            outreach: true,   apollo: 'partial' },
  { feature: 'Auto-stop on reply',             outreach: true,   apollo: true },
  { feature: 'Email warmup',                   outreach: true,   apollo: false },
  { feature: 'Inbox rotation (sender pool)',   outreach: true,   apollo: 'partial' },
  { feature: 'GDPR unsubscribe',               outreach: true,   apollo: true },
  { feature: 'LinkedIn automation',            outreach: true,   apollo: 'partial' },
  { feature: 'Chrome extension (lead capture)', outreach: true,  apollo: true },
  { feature: 'Multi-step LinkedIn sequences',  outreach: true,   apollo: false },
  { feature: 'B2B contact database (250M+)',   outreach: false,  apollo: true },
  { feature: 'Email verification',             outreach: false,  apollo: true },
  { feature: 'Intent data / buying signals',   outreach: false,  apollo: true },
  { feature: 'CRM pipeline (Kanban)',          outreach: true,   apollo: 'partial' },
  { feature: 'Deal tracking (won/lost)',       outreach: true,   apollo: 'partial' },
  { feature: 'Full contact & company records', outreach: true,   apollo: true },
  { feature: 'Activity timeline per lead',     outreach: true,   apollo: true },
  { feature: 'Custom fields',                  outreach: true,   apollo: true },
  { feature: 'Workflow automation engine',     outreach: true,   apollo: 'partial' },
  { feature: 'Meeting scheduler',             outreach: true,   apollo: true },
  { feature: 'Website visitor tracking',       outreach: true,   apollo: false },
  { feature: 'Marketing campaigns (bulk)',     outreach: true,   apollo: false },
  { feature: 'AI personalization (BYO key)',   outreach: true,   apollo: 'partial' },
  { feature: 'Webhooks',                       outreach: true,   apollo: true },
  { feature: 'Composable dashboards',          outreach: true,   apollo: 'partial' },
  { feature: 'Deliverability monitoring',      outreach: true,   apollo: false },
]

const whySwitchCards = [
  {
    icon: '🎯',
    title: 'OutreachAI wins on outreach',
    items: ['Email warmup (Apollo has none)', 'Full LinkedIn sequences (visit → connect → message)', 'Workflow automation engine (13 triggers)', 'Meeting scheduler built-in', 'Marketing campaigns for bulk sends', 'Deliverability alert rules'],
  },
  {
    icon: '🗄️',
    title: 'Apollo wins on data',
    items: ['250M+ B2B contact database', 'Direct email lookup & verification', 'Intent data signals', 'Company technographics', 'Buyer intent filters', 'Direct dial phone numbers'],
  },
  {
    icon: '💡',
    title: 'Best of both worlds',
    items: ['Use Apollo to find leads', 'Export to CSV', 'Import into OutreachAI', 'Run sequences + LinkedIn automation', 'Track deals in CRM pipeline', 'Total cost: Apollo free tier + OutreachAI free'],
  },
]

const testimonials = [
  {
    quote: 'We use Apollo for lead discovery and OutreachAI for everything after that — sequences, LinkedIn, pipeline. Apollo\'s outreach features are nowhere near as good.',
    name: 'Deepak Verma',
    role: 'VP Sales, B2B SaaS',
    avatar: 'DV',
    color: 'bg-orange-500',
  },
  {
    quote: 'Apollo\'s email warmup is non-existent and their LinkedIn automation is basic. OutreachAI does both properly, plus the CRM pipeline is actually useful.',
    name: 'Ananya Singh',
    role: 'Outbound Lead, Series B startup',
    avatar: 'AS',
    color: 'bg-blue-500',
  },
  {
    quote: 'The Apollo free tier gets us contacts. OutreachAI runs the outreach. Both free. It\'s a better stack than paying $500/month for Apollo Paid + Lemlist.',
    name: 'Rahul Kapoor',
    role: 'Founder, sales agency',
    avatar: 'RK',
    color: 'bg-violet-500',
  },
]

function Cell({ value }: { value: boolean | string }) {
  if (value === true) return <span className="flex items-center justify-center text-lg">✅</span>
  if (value === false) return <span className="flex items-center justify-center text-lg">❌</span>
  if (value === 'partial') return <span className="flex items-center justify-center text-amber-500 text-xs font-medium">🟡 Limited</span>
  return null
}

export default function VsApolloPage() {
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
          <div className="inline-flex items-center gap-2 bg-orange-500/20 text-orange-300 text-xs font-semibold px-4 py-2 rounded-full mb-8 border border-orange-500/30">
            OutreachAI vs Apollo.io
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold text-white tracking-tight leading-[1.05] mb-6">
            Apollo finds leads.<br />
            <span className="bg-gradient-to-r from-orange-400 to-blue-400 bg-clip-text text-transparent">OutreachAI closes them.</span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Apollo.io is the best B2B contact database. OutreachAI is the best tool for what comes next — sequences, LinkedIn, CRM, and automation. Use both for free.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup" className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 to-violet-600 text-white font-bold px-8 py-4 rounded-xl shadow-lg shadow-blue-500/25 text-base">
              Start free <ArrowRight className="w-4 h-4" />
            </Link>
            <a href="#comparison" className="text-gray-400 hover:text-white text-sm font-medium">See full comparison ↓</a>
          </div>
        </div>
      </section>

      <section className="bg-blue-50 border-y border-blue-100 py-10 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-sm font-semibold text-blue-700 mb-2">💡 The smarter stack</p>
          <p className="text-2xl font-extrabold text-gray-900 mb-2">Apollo (free tier) + OutreachAI (free) = $0/month</p>
          <p className="text-gray-500 text-sm">Apollo Free: 50 credits/month to find contacts. OutreachAI: unlimited sequences, LinkedIn, CRM, and automation.</p>
        </div>
      </section>

      <section id="comparison" className="py-20 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-3">Feature-by-feature comparison</h2>
            <p className="text-gray-500">Honest. Apollo wins on data. OutreachAI wins on outreach execution.</p>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-6 py-4 font-semibold text-gray-700 w-1/2">Feature</th>
                  <th className="text-center px-6 py-4 font-bold text-blue-700 w-1/4">OutreachAI</th>
                  <th className="text-center px-6 py-4 font-semibold text-gray-500 w-1/4">Apollo.io</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.feature} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                    <td className="px-6 py-3.5 text-gray-700">{row.feature}</td>
                    <td className="px-6 py-3.5"><Cell value={row.outreach} /></td>
                    <td className="px-6 py-3.5"><Cell value={row.apollo} /></td>
                  </tr>
                ))}
                <tr className="bg-blue-50">
                  <td className="px-6 py-4 font-bold text-gray-900">Outreach price</td>
                  <td className="px-6 py-4 text-center font-bold text-emerald-600">Free (beta)</td>
                  <td className="px-6 py-4 text-center font-semibold text-gray-500">$49–$99/seat/mo</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="bg-white py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-3">How OutreachAI and Apollo compare</h2>
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
            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-3">What sales teams are saying</h2>
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
          <h2 className="text-4xl font-extrabold text-white tracking-tight mb-4">Find leads with Apollo. Close them with OutreachAI.</h2>
          <p className="text-gray-400 text-lg mb-8">Both free. Better together.</p>
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
            <Link href="/vs/saleshandy" className="hover:text-gray-300">vs Saleshandy</Link>
            <Link href="/vs/hubspot" className="hover:text-gray-300">vs HubSpot</Link>
            <Link href="/privacy" className="hover:text-gray-300">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
