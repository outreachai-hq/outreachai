import type { Metadata } from 'next'
import Link from 'next/link'
import { Check, ArrowRight, Star } from 'lucide-react'

export const metadata: Metadata = {
  title: 'OutreachAI vs HubSpot — Free Alternative for Outbound Sales',
  description: "OutreachAI vs HubSpot: OutreachAI combines LinkedIn outreach, email sequences, CRM pipeline and workflow automation — without HubSpot's $800–$3,200/month price tag.",
}

const rows = [
  { feature: 'Contact CRM',              outreach: true,      hubspot: true },
  { feature: 'Company records',           outreach: true,      hubspot: true },
  { feature: 'Deal pipeline (Kanban)',    outreach: true,      hubspot: true },
  { feature: 'Activity timeline',         outreach: true,      hubspot: true },
  { feature: 'Email sequences',           outreach: true,      hubspot: true },
  { feature: 'LinkedIn automation',       outreach: true,      hubspot: false },
  { feature: 'Workflow automation',        outreach: true,     hubspot: true },
  { feature: 'Meeting scheduler',          outreach: true,     hubspot: true },
  { feature: 'Website visitor tracking',   outreach: true,     hubspot: true },
  { feature: 'Email warmup',               outreach: true,     hubspot: false },
  { feature: 'Chrome extension',           outreach: true,     hubspot: true },
  { feature: 'Marketing campaigns',        outreach: true,     hubspot: true },
  { feature: 'Custom fields',              outreach: true,     hubspot: true },
  { feature: 'Webhooks',                   outreach: true,     hubspot: true },
  { feature: 'AI personalization',         outreach: true,     hubspot: 'partial' },
]

const whySwitchCards = [
  {
    icon: '🔗',
    title: 'LinkedIn outreach built-in',
    desc: 'HubSpot has no native LinkedIn automation. OutreachAI connects directly to LinkedIn for connection requests, profile visits, and chat messages — all in your sequences.',
  },
  {
    icon: '🔥',
    title: 'Email warmup included',
    desc: 'HubSpot has no email warmup. OutreachAI includes warmup for every connected inbox — so your cold emails actually land in the inbox, not spam.',
  },
  {
    icon: '🤖',
    title: 'BYO AI keys',
    desc: "HubSpot's AI features are locked to their model with significant markup. OutreachAI lets you bring your own OpenAI or Claude key — you pay your provider directly, zero markup.",
  },
]

const testimonials = [
  {
    quote: 'We cancelled HubSpot Sales Hub after two months with OutreachAI. We were paying $600/month and not using half the features. OutreachAI does everything our outbound team needs.',
    name: 'Ananya Krishnan',
    role: 'VP Sales, Series B SaaS',
    avatar: 'AK',
    color: 'bg-orange-500',
  },
  {
    quote: "The LinkedIn automation alone is worth switching. HubSpot doesn't even have it. We book 40% of our meetings from LinkedIn now.",
    name: 'Rajan Mehta',
    role: 'SDR Lead, RevTech Startup',
    avatar: 'RM',
    color: 'bg-blue-500',
  },
  {
    quote: 'The deal pipeline and workflow automation are genuinely as good as HubSpot for our use case. And we stopped paying $150/seat.',
    name: 'Deepa Sharma',
    role: 'Founder, Outbound Agency',
    avatar: 'DS',
    color: 'bg-violet-500',
  },
]

function Cell({ value }: { value: boolean | string }) {
  if (value === true) return <span className="flex items-center justify-center"><span className="text-emerald-500 text-lg">✅</span></span>
  if (value === false) return <span className="flex items-center justify-center"><span className="text-red-400 text-lg">❌</span></span>
  if (value === 'partial') return <span className="flex items-center justify-center text-amber-500 text-sm font-medium">🟡 Add-on</span>
  return null
}

export default function VsHubspotPage() {
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
            OutreachAI vs HubSpot
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold text-white tracking-tight leading-[1.05] mb-6">
            HubSpot is great.<br />
            <span className="bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">
              At $3,200/month.
            </span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            OutreachAI gives outbound teams everything they need —<br />
            CRM pipeline, LinkedIn automation, email sequences, and workflows.<br />
            Free.
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
      <section className="bg-orange-50 border-y border-orange-200 py-8 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div className="p-4 rounded-xl bg-red-50 border border-red-100">
              <div className="text-sm font-semibold text-red-500 mb-1">HubSpot Sales Hub Pro</div>
              <div className="text-2xl font-extrabold text-gray-900">$100<span className="text-base font-normal text-gray-500">/seat/mo</span></div>
              <div className="text-xs text-gray-500 mt-1">+ platform fee = $3,200+/year</div>
            </div>
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
              <div className="text-sm font-semibold text-emerald-600 mb-1">OutreachAI</div>
              <div className="text-2xl font-extrabold text-gray-900">FREE</div>
              <div className="text-xs text-gray-500 mt-1">Free during beta</div>
            </div>
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
              <div className="text-sm font-semibold text-blue-600 mb-1">You save</div>
              <div className="text-2xl font-extrabold text-gray-900">$3,200+</div>
              <div className="text-xs text-gray-500 mt-1">per year</div>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison table */}
      <section id="comparison" className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-3">Feature-by-feature comparison</h2>
            <p className="text-gray-500">Built for outbound teams who need more than a CRM.</p>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-6 py-4 font-semibold text-gray-700 w-1/2">Feature</th>
                  <th className="text-center px-6 py-4 font-bold text-blue-700 w-1/4">OutreachAI</th>
                  <th className="text-center px-6 py-4 font-semibold text-gray-500 w-1/4">HubSpot Sales Hub</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.feature} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                    <td className="px-6 py-3.5 text-gray-700">{row.feature}</td>
                    <td className="px-6 py-3.5"><Cell value={row.outreach} /></td>
                    <td className="px-6 py-3.5"><Cell value={row.hubspot} /></td>
                  </tr>
                ))}
                <tr className="bg-blue-50 border-b border-gray-100">
                  <td className="px-6 py-4 font-bold text-gray-900">Price</td>
                  <td className="px-6 py-4 text-center font-bold text-emerald-600">Free</td>
                  <td className="px-6 py-4 text-center font-semibold text-gray-500">$100–$150/seat/mo</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Why OutreachAI for outbound */}
      <section className="bg-gray-50 py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-3">Why OutreachAI for outbound teams</h2>
            <p className="text-gray-500">Three things HubSpot can&apos;t do (that we can).</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {whySwitchCards.map((card) => (
              <div key={card.title} className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-3xl mb-4">{card.icon}</div>
                <h3 className="text-lg font-bold text-gray-900 mb-3">{card.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{card.desc}</p>
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
          <p className="text-gray-400 text-lg mb-8">Get your full outbound stack for free. No credit card needed.</p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-600 hover:to-violet-700 text-white font-bold px-10 py-4 rounded-xl transition-all shadow-lg shadow-blue-500/25 text-lg"
          >
            Create free account
            <ArrowRight className="w-5 h-5" />
          </Link>
          <p className="text-gray-600 text-sm mt-4">Free during beta. All features included.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black border-t border-white/5 py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-600">© 2026 OutreachAI.in · Made with love in India</p>
          <div className="flex items-center gap-6 text-xs text-gray-500">
            <Link href="/vs/lemlist" className="hover:text-gray-300 transition-colors">vs Lemlist</Link>
            <Link href="/changelog" className="hover:text-gray-300 transition-colors">Changelog</Link>
            <Link href="/privacy" className="hover:text-gray-300 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-gray-300 transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
