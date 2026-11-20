'use client'

import Link from 'next/link'
import { useState } from 'react'
import { CHROME_STORE_URL } from '@/lib/extension'
import {
  Zap, Users, Check, ChevronDown,
  Star, ArrowRight, Mail,
  TrendingUp, Shield, Globe, Sparkles,
  Flame, Megaphone, Newspaper, Calendar, Puzzle,
} from 'lucide-react'

// ─── Data ────────────────────────────────────────────────────────────────────

const stats = [
  { value: '12,000+', label: 'Users worldwide' },
  { value: '4.2M+', label: 'Messages sent' },
  { value: '38%', label: 'Average reply rate' },
  { value: '3 min', label: 'To set up a campaign' },
]

const logos = ['Razorpay', 'Groww', 'Meesho', 'PhysicsWallah', 'Cred', 'Zepto']

const LINKEDIN_FEATURES = [
  {
    icon: Globe,
    tag: 'Chrome Extension',
    title: 'Save leads from LinkedIn in one click',
    description: 'Browse LinkedIn naturally. When you find a great prospect, hit the OutreachAI button to save them instantly — name, company, headline, and LinkedIn URL auto-filled.',
    color: 'from-blue-500 to-cyan-500',
    light: 'bg-blue-50 dark:bg-blue-950',
    text: 'text-blue-600',
    bullets: ['One-click lead capture from any LinkedIn profile', 'Auto-fills name, company, headline', 'Add directly to a campaign'],
  },
  {
    icon: Users,
    tag: 'LinkedIn Sequences',
    title: 'Automate visits, connections, and messages',
    description: 'Build multi-step LinkedIn sequences: visit a profile → wait → send a connection request → wait until accepted → send a message. All automated, all within LinkedIn\'s limits.',
    color: 'from-indigo-500 to-violet-600',
    light: 'bg-indigo-50 dark:bg-indigo-950',
    text: 'text-indigo-600',
    bullets: ['Visit profile → connect → message in sequence', 'Conditional steps (if accepted, then...)', 'AI-personalised messages with {{firstName}}, {{company}}'],
  },
  {
    icon: Newspaper,
    tag: 'Captured Posts',
    title: 'Turn one LinkedIn post into three pieces of content',
    description: 'Capture any LinkedIn post, and OutreachAI\'s AI rewrites it as a Twitter thread, a LinkedIn repost, and a newsletter section — ready to publish in one click.',
    color: 'from-purple-500 to-pink-500',
    light: 'bg-purple-50 dark:bg-purple-950',
    text: 'text-purple-600',
    bullets: ['Capture posts from LinkedIn via extension', 'AI generates Twitter thread + LinkedIn repost + newsletter', 'Schedule LinkedIn posts directly'],
  },
]

const EMAIL_FEATURES = [
  {
    icon: Mail,
    tag: 'Email Sequences',
    title: 'Follow up automatically until they reply',
    description: 'Build multi-step cold email sequences that auto-pause the moment a prospect replies. Set A/B subject lines, add conditional steps, and use liquid variables like {{if company}}.',
    color: 'from-emerald-500 to-teal-500',
    light: 'bg-emerald-50 dark:bg-emerald-950',
    text: 'text-emerald-600',
    bullets: ['A/B test subject lines and body copy', 'Liquid variables: {{if company}}...{{end}}', 'Auto-stop on reply — never double-message'],
  },
  {
    icon: Flame,
    tag: 'Email Warmup',
    title: 'Build sender reputation before you blast',
    description: 'New email domain? OutreachAI automatically sends and replies to warmup emails so your cold outreach lands in inboxes — not spam — from day one.',
    color: 'from-orange-400 to-rose-500',
    light: 'bg-orange-50 dark:bg-orange-950',
    text: 'text-orange-600',
    bullets: ['Automated send/receive/reply cycle', 'Daily ramp-up targets', 'SPF/DKIM/DMARC health check built-in'],
  },
  {
    icon: Megaphone,
    tag: 'Marketing Campaigns',
    title: 'Send newsletters and broadcasts to your whole list',
    description: 'Beyond cold outreach — send bulk marketing emails with open/click tracking, A/B testing, and one-click unsubscribe. All from the same platform.',
    color: 'from-pink-500 to-rose-600',
    light: 'bg-pink-50 dark:bg-pink-950',
    text: 'text-pink-600',
    bullets: ['Bulk sends with open + click tracking', 'A/B test subject lines with auto-winner', 'Unsubscribe compliance built-in'],
  },
]

const PLATFORM_FEATURES = [
  {
    icon: TrendingUp,
    tag: 'CRM Pipeline',
    title: 'Track deals without leaving your outreach tool',
    description: 'Full Kanban deal pipeline — Lead → Qualified → Proposal → Won. Drag cards between stages, track deal value, and see your total pipeline at a glance. No HubSpot needed.',
    color: 'from-violet-500 to-purple-600',
    light: 'bg-violet-50 dark:bg-violet-950',
    text: 'text-violet-600',
    bullets: ['Kanban board with drag-and-drop', 'Deal value + close date + probability', '"Add to pipeline" from inbox, contacts, hot leads'],
  },
  {
    icon: Zap,
    tag: 'Workflow Automation',
    title: 'If-This-Then-That for your outreach',
    description: 'Build automations that fire when things happen: a lead replies → create a deal + task. An email is opened 3 times → tag as hot. A booking is confirmed → create a deal. 13 triggers, 11 actions.',
    color: 'from-amber-400 to-orange-500',
    light: 'bg-amber-50 dark:bg-amber-950',
    text: 'text-amber-600',
    bullets: ['13 triggers: reply, open, deal won, booking confirmed...', '11 actions: create deal, add tag, create task, webhook...', '6 ready-made templates to start in seconds'],
  },
  {
    icon: Calendar,
    tag: 'Meeting Scheduler',
    title: 'Your own booking page — no Calendly needed',
    description: 'Get a public booking link at outreachai.in/meet/yourname. Set your availability, share the link in your emails, and prospects book directly into your calendar.',
    color: 'from-cyan-500 to-blue-500',
    light: 'bg-cyan-50 dark:bg-cyan-950',
    text: 'text-cyan-600',
    bullets: ['Public page at /meet/yourname', 'Availability by day + hour range', 'Google Calendar .ics invite on booking'],
  },
]

const steps = [
  {
    num: '01',
    title: 'Install the extension',
    desc: 'Add OutReachAI to Chrome in 30 seconds. It works silently in the background on LinkedIn.',
  },
  {
    num: '02',
    title: 'Build your prospect list',
    desc: 'Browse LinkedIn and save prospects with one click. Our extension scrapes name, role, company, and recent activity automatically.',
  },
  {
    num: '03',
    title: 'Create a sequence',
    desc: 'Set up a multi-step message sequence — connection request, follow-up, and bumps — with AI personalising each first line.',
  },
  {
    num: '04',
    title: 'Watch replies come in',
    desc: 'OutReachAI runs your sequences and pauses when someone replies. You just handle the conversations.',
  },
]

const testimonials = [
  {
    quote:
      'We went from 3% to 41% reply rates within a week of switching to OutReachAI. The AI personalisation is genuinely scary good.',
    name: 'Rohan Mehta',
    role: 'Head of Growth, Series B SaaS',
    avatar: 'RM',
    color: 'bg-violet-500',
    stars: 5,
  },
  {
    quote:
      'I run outreach for 4 founders simultaneously. OutReachAI is the only tool that lets me do that without drowning in spreadsheets.',
    name: 'Priya Nair',
    role: 'Fractional Sales Lead',
    avatar: 'PN',
    color: 'bg-blue-500',
    stars: 5,
  },
  {
    quote:
      'Booked 14 discovery calls in my first week. I\'d been manually messaging for months with nothing close to that result.',
    name: 'Arjun Sharma',
    role: 'Founder, EdTech Startup',
    avatar: 'AS',
    color: 'bg-orange-500',
    stars: 5,
  },
]

const pricingFree = [
  '50 AI-personalized messages / mo',
  'Chrome extension included',
  '2-step sequences',
  'Basic analytics',
  'Community support',
]

const pricingPro = [
  'Unlimited AI-personalized messages',
  'Chrome extension included',
  'Up to 8-step sequences',
  'Advanced reply analytics',
  'Team seats (up to 5)',
  'CSV lead import & enrichment',
  'Priority email + chat support',
  'Zapier / webhook integration',
]

const faqs = [
  {
    q: 'Does OutReachAI send messages automatically?',
    a: 'No — to keep your LinkedIn account safe, OutReachAI fills the message box for you and you click Send. Follow-ups are semi-automated: we remind you and pre-fill the message. Full automation is available for email outreach.',
  },
  {
    q: 'Will LinkedIn ban my account?',
    a: 'OutReachAI is built to work within LinkedIn\'s limits. We never use bots or scrapers that violate ToS. Your messages go through the normal LinkedIn compose box, and our extension mimics natural human behaviour.',
  },
  {
    q: 'What AI models do you support?',
    a: 'Currently Claude (Anthropic) and GPT-4o (OpenAI). You bring your own API key and pay your provider directly — we don\'t mark up AI costs.',
  },
  {
    q: 'Can I use this for my whole sales team?',
    a: 'Yes. The Pro plan supports up to 5 seats. Each team member gets their own Chrome extension login and campaign workspace. Contact us for larger teams.',
  },
  {
    q: 'Is there a free plan?',
    a: 'Everything is free during our Product Hunt beta launch — no message limits, no credit card, no time limit. All features included.',
  },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-gray-200 last:border-0">
      <button
        className="w-full flex items-center justify-between py-5 text-left gap-4"
        onClick={() => setOpen(!open)}
      >
        <span className="font-semibold text-gray-900 text-base">{q}</span>
        <ChevronDown
          className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <p className="pb-5 text-gray-500 text-sm leading-relaxed">{a}</p>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white font-sans antialiased">

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-14 md:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg shadow-sm" style={{ backgroundColor: '#0A66C2' }}>
              <span className="text-white font-black text-[13px] leading-none" style={{ fontFamily: 'Georgia, serif' }}>in</span>
            </div>
            <span className="text-lg font-extrabold text-gray-900 tracking-tight">
              OutReachAI<span style={{ color: '#0A66C2' }}>.in</span>
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
            <a href="#linkedin" className="hover:text-gray-900 transition-colors">LinkedIn</a>
            <a href="#email" className="hover:text-gray-900 transition-colors">Email</a>
            <a href="#platform" className="hover:text-gray-900 transition-colors">CRM &amp; Automation</a>
            <a href="#pricing" className="hover:text-gray-900 transition-colors">Pricing</a>
            <a href="#mcp" className="flex items-center gap-1.5 text-violet-600 font-semibold hover:text-violet-700 transition-colors">
              <Sparkles className="w-3.5 h-3.5" />
              MCP
            </a>
            <Link href="/vs/lemlist" className="hover:text-gray-900 transition-colors">vs Lemlist</Link>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors px-2 md:px-3 py-2 whitespace-nowrap">
              Log in
            </Link>
            <Link
              href="/signup"
              className="text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 transition-all px-3 md:px-4 py-2 rounded-lg shadow-sm whitespace-nowrap"
            >
              Start free
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-gray-950 pt-20 pb-32">
        {/* Background glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-br from-blue-600/20 via-violet-600/15 to-transparent rounded-full blur-3xl" />
          <div className="absolute top-1/2 -left-32 w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-3xl" />
          <div className="absolute top-1/3 -right-32 w-[400px] h-[400px] bg-violet-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-5xl mx-auto px-4 md:px-6 text-center">
          <a href="https://www.producthunt.com/@outreachai" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-orange-500/20 text-orange-300 text-xs font-semibold px-4 py-2 rounded-full mb-6 md:mb-8 border border-orange-500/30 backdrop-blur hover:bg-orange-500/30 transition-colors">
            🚀 Launching free on Product Hunt — all features included
          </a>

          <h1 className="text-3xl sm:text-5xl md:text-7xl font-extrabold text-white tracking-tight leading-[1.05] mb-6 md:mb-8">
            Stop cold messaging.<br />
            <span className="bg-gradient-to-r from-blue-400 via-violet-400 to-rose-400 bg-clip-text text-transparent">
              Start warm conversations.
            </span>
          </h1>

          <p className="text-base md:text-xl text-gray-400 max-w-2xl mx-auto mb-8 md:mb-12 leading-relaxed">
            OutReachAI.in uses AI to personalise every LinkedIn message from your prospect&apos;s own profile,
            then automates follow-ups so you never lose a lead to the inbox black hole.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10 md:mb-16">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-600 hover:to-violet-700 text-white font-bold px-8 py-4 rounded-xl transition-all shadow-lg shadow-blue-500/25 text-base"
            >
              Get started for free
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href={CHROME_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/15 border border-white/20 text-white font-bold px-8 py-4 rounded-xl transition-colors text-base"
            >
              <Puzzle className="w-4 h-4" />
              Add to Chrome — free
            </a>
          </div>
          <div className="-mt-6 md:-mt-10 mb-10 md:mb-16">
            <span className="text-sm text-gray-500">No credit card · Free forever plan</span>
          </div>

          {/* Stats bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
            {stats.map(({ value, label }) => (
              <div key={label} className="text-center">
                <div className="text-3xl font-extrabold text-white mb-1">{value}</div>
                <div className="text-xs text-gray-500 font-medium">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Social proof logos ── */}
      <section className="bg-gray-50 border-y border-gray-100 py-8">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-center text-xs font-semibold text-gray-400 uppercase tracking-widest mb-6">
            Trusted by teams at
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4">
            {logos.map((logo) => (
              <span key={logo} className="text-gray-400 font-bold text-sm tracking-tight">
                {logo}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── LinkedIn Section ── */}
      <section id="linkedin" className="py-16 md:py-20 bg-white dark:bg-gray-950">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="text-center mb-10 md:mb-16">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-200 border border-blue-100 dark:border-blue-800 mb-4">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
              LinkedIn Automation
            </span>
            <h2 className="text-2xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Everything you need for LinkedIn outreach
            </h2>
            <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
              From saving a lead with one click to sending a fully automated multi-step sequence — all within LinkedIn&apos;s daily limits.
            </p>
          </div>
          <div className="space-y-16 md:space-y-24">
            {LINKEDIN_FEATURES.map(({ icon: Icon, tag, title, description, color, light, text, bullets }, i) => (
              <div
                key={tag}
                className={`flex flex-col ${i % 2 === 1 ? 'md:flex-row-reverse' : 'md:flex-row'} items-center gap-8 md:gap-16`}
              >
                <div className="flex-1 w-full">
                  <div className={`inline-flex items-center gap-2 ${light} ${text} text-xs font-bold px-3 py-1.5 rounded-full mb-5`}>
                    <Icon className="w-3.5 h-3.5" />
                    {tag}
                  </div>
                  <h3 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-4 leading-tight">{title}</h3>
                  <p className="text-gray-500 text-base md:text-lg leading-relaxed mb-6">{description}</p>
                  <ul className="space-y-3">
                    {bullets.map((b) => (
                      <li key={b} className="flex items-center gap-3 text-sm text-gray-700">
                        <Check className={`w-4 h-4 ${text} flex-shrink-0`} />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex-1 w-full">
                  <div className={`relative bg-gradient-to-br ${color} rounded-2xl p-8 aspect-video flex items-center justify-center shadow-2xl`}>
                    <div className="absolute inset-0 bg-black/10 rounded-2xl" />
                    <Icon className="w-24 h-24 text-white/30" />
                    <div className="absolute bottom-6 left-6 right-6 bg-white/95 backdrop-blur rounded-xl p-4 shadow-lg">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">A</div>
                        <div>
                          <div className="text-xs font-semibold text-gray-900">{tag}</div>
                          <div className="text-xs text-gray-400">OutreachAI</div>
                        </div>
                        <span className="ml-auto text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">Live</span>
                      </div>
                      <p className="text-xs text-gray-600 italic">&quot;{bullets[0]}&quot;</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Email Section ── */}
      <section id="email" className="py-16 md:py-20 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="text-center mb-10 md:mb-16">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200 border border-emerald-100 dark:border-emerald-800 mb-4">
              ✉️ Email Outreach
            </span>
            <h2 className="text-2xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Cold email that actually lands in inboxes
            </h2>
            <p className="text-base md:text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
              Sequences, warmup, A/B testing, and bulk sends — everything you&apos;d pay Lemlist + Mailchimp for, in one place.
            </p>
          </div>
          <div className="space-y-16 md:space-y-24">
            {EMAIL_FEATURES.map(({ icon: Icon, tag, title, description, color, light, text, bullets }, i) => (
              <div
                key={tag}
                className={`flex flex-col ${i % 2 === 1 ? 'md:flex-row-reverse' : 'md:flex-row'} items-center gap-8 md:gap-16`}
              >
                <div className="flex-1 w-full">
                  <div className={`inline-flex items-center gap-2 ${light} ${text} text-xs font-bold px-3 py-1.5 rounded-full mb-5`}>
                    <Icon className="w-3.5 h-3.5" />
                    {tag}
                  </div>
                  <h3 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-4 leading-tight">{title}</h3>
                  <p className="text-gray-500 text-base md:text-lg leading-relaxed mb-6">{description}</p>
                  <ul className="space-y-3">
                    {bullets.map((b) => (
                      <li key={b} className="flex items-center gap-3 text-sm text-gray-700">
                        <Check className={`w-4 h-4 ${text} flex-shrink-0`} />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex-1 w-full">
                  <div className={`relative bg-gradient-to-br ${color} rounded-2xl p-8 aspect-video flex items-center justify-center shadow-2xl`}>
                    <div className="absolute inset-0 bg-black/10 rounded-2xl" />
                    <Icon className="w-24 h-24 text-white/30" />
                    <div className="absolute bottom-6 left-6 right-6 bg-white/95 backdrop-blur rounded-xl p-4 shadow-lg">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">A</div>
                        <div>
                          <div className="text-xs font-semibold text-gray-900">{tag}</div>
                          <div className="text-xs text-gray-400">OutreachAI</div>
                        </div>
                        <span className="ml-auto text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">Live</span>
                      </div>
                      <p className="text-xs text-gray-600 italic">&quot;{bullets[0]}&quot;</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CRM & Automation Section ── */}
      <section id="platform" className="py-16 md:py-20 bg-white dark:bg-gray-950">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="text-center mb-10 md:mb-16">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-200 border border-violet-100 dark:border-violet-800 mb-4">
              ⚡ CRM &amp; Automation
            </span>
            <h2 className="text-2xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Close deals without switching tools
            </h2>
            <p className="text-base md:text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
              Pipeline, workflows, and meeting scheduling — everything HubSpot charges $3,200/year for.
            </p>
          </div>
          <div className="space-y-16 md:space-y-24">
            {PLATFORM_FEATURES.map(({ icon: Icon, tag, title, description, color, light, text, bullets }, i) => (
              <div
                key={tag}
                className={`flex flex-col ${i % 2 === 1 ? 'md:flex-row-reverse' : 'md:flex-row'} items-center gap-8 md:gap-16`}
              >
                <div className="flex-1 w-full">
                  <div className={`inline-flex items-center gap-2 ${light} ${text} text-xs font-bold px-3 py-1.5 rounded-full mb-5`}>
                    <Icon className="w-3.5 h-3.5" />
                    {tag}
                  </div>
                  <h3 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-4 leading-tight">{title}</h3>
                  <p className="text-gray-500 text-base md:text-lg leading-relaxed mb-6">{description}</p>
                  <ul className="space-y-3">
                    {bullets.map((b) => (
                      <li key={b} className="flex items-center gap-3 text-sm text-gray-700">
                        <Check className={`w-4 h-4 ${text} flex-shrink-0`} />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex-1 w-full">
                  <div className={`relative bg-gradient-to-br ${color} rounded-2xl p-8 aspect-video flex items-center justify-center shadow-2xl`}>
                    <div className="absolute inset-0 bg-black/10 rounded-2xl" />
                    <Icon className="w-24 h-24 text-white/30" />
                    <div className="absolute bottom-6 left-6 right-6 bg-white/95 backdrop-blur rounded-xl p-4 shadow-lg">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">A</div>
                        <div>
                          <div className="text-xs font-semibold text-gray-900">{tag}</div>
                          <div className="text-xs text-gray-400">OutreachAI</div>
                        </div>
                        <span className="ml-auto text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">Live</span>
                      </div>
                      <p className="text-xs text-gray-600 italic">&quot;{bullets[0]}&quot;</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" className="bg-gray-950 py-16 md:py-28">
        <div className="max-w-5xl mx-auto px-4 md:px-6">
          <div className="text-center mb-12 md:mb-20">
            <p className="text-sm font-semibold text-blue-400 uppercase tracking-widest mb-3">How it works</p>
            <h2 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight mb-5">
              Up and running in under 10 minutes
            </h2>
            <p className="text-gray-400 text-base md:text-xl max-w-xl mx-auto">
              No sales ops team needed. No complex integrations. Just install, connect, and go.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {steps.map(({ num, title, desc }) => (
              <div key={num} className="bg-white/5 border border-white/10 rounded-2xl p-8 hover:bg-white/8 transition-colors">
                <div className="text-5xl font-extrabold text-white/10 mb-4">{num}</div>
                <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
                {num === '01' && (
                  <a
                    href={CHROME_STORE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 mt-4 text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    <Puzzle className="w-4 h-4" /> Get it on the Chrome Web Store
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            ))}
          </div>

          <div className="text-center mt-10 md:mt-12">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 bg-white hover:bg-gray-100 text-gray-900 font-bold px-6 py-3 rounded-xl transition-colors shadow-lg"
            >
              Start for free — takes 5 minutes
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="py-16 md:py-28 bg-white">
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          <div className="text-center mb-10 md:mb-16">
            <p className="text-sm font-semibold text-blue-600 uppercase tracking-widest mb-3">Testimonials</p>
            <h2 className="text-2xl md:text-4xl font-extrabold text-gray-900 tracking-tight">
              Real results from real teams
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {testimonials.map(({ quote, name, role, avatar, color, stars }) => (
              <div key={name} className="bg-gray-50 rounded-2xl p-8 border border-gray-100 hover:shadow-md transition-shadow">
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: stars }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-gray-700 text-sm leading-relaxed mb-6 italic">&quot;{quote}&quot;</p>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full ${color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                    {avatar}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{name}</div>
                    <div className="text-xs text-gray-400">{role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="bg-gray-50 py-16 md:py-28">
        <div className="max-w-4xl mx-auto px-4 md:px-6">
          <div className="text-center mb-10 md:mb-12">
            <span className="inline-flex items-center gap-2 bg-orange-100 text-orange-700 text-xs font-bold px-4 py-2 rounded-full mb-5 uppercase tracking-widest">
              🚀 Product Hunt Launch
            </span>
            <h2 className="text-2xl md:text-4xl font-extrabold text-gray-900 tracking-tight mb-4">
              100% free during our beta launch
            </h2>
            <p className="text-gray-500 text-base md:text-lg max-w-xl mx-auto">
              Every feature — AI personalization, email outreach, sequences, inbox sync — is free while we launch on Product Hunt. No credit card. No limits.
            </p>
          </div>

          <div className="bg-gradient-to-br from-blue-600 to-violet-700 rounded-2xl p-6 md:p-10 text-center shadow-2xl shadow-blue-500/20 max-w-2xl mx-auto">
            <div className="text-5xl md:text-6xl font-extrabold text-white mb-2">₹0</div>
            <div className="text-blue-200 text-base md:text-lg mb-6 md:mb-8">Everything included · No card needed · Forever free during beta</div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8 md:mb-10 text-left">
              {pricingPro.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-white">
                  <Check className="w-4 h-4 text-blue-300 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 bg-white hover:bg-blue-50 text-blue-700 font-extrabold px-6 md:px-10 py-3 md:py-4 rounded-xl transition-colors shadow-lg text-base md:text-lg w-full sm:w-auto justify-center"
            >
              Get started free — takes 5 minutes
              <ArrowRight className="w-5 h-5" />
            </Link>
            <p className="text-blue-200 text-sm mt-4">
              Launching on Product Hunt — <a href="https://www.producthunt.com/products/outreachai-in?launch=outreachai-in" target="_blank" rel="noopener noreferrer" className="text-white underline font-semibold">support us here 🔼</a>
            </p>
          </div>
        </div>
      </section>

      {/* ── Why us ── */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-5xl mx-auto px-4 md:px-6">
          <div className="text-center mb-10 md:mb-16">
            <p className="text-sm font-semibold text-blue-600 uppercase tracking-widest mb-3">Why OutReachAI.in</p>
            <h2 className="text-2xl md:text-4xl font-extrabold text-gray-900 tracking-tight">
              Built different
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {[
              { icon: Globe, title: 'Made for India', desc: 'Priced in INR, built for Indian founders, sales teams, and recruiters. Support in IST hours.' },
              { icon: Shield, title: 'LinkedIn-safe', desc: 'We never automate clicks or bypass LinkedIn controls. Your account stays safe while you scale.' },
              { icon: TrendingUp, title: 'BYOK AI', desc: 'Bring your own OpenAI or Claude API key. We don\'t charge AI markup — you pay your provider directly.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="text-center p-6">
                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Icon className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── MCP ── */}
      <section id="mcp" className="bg-gray-950 py-16 md:py-28 overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          <div className="flex flex-col md:flex-row items-center gap-10 md:gap-16">
            {/* Text */}
            <div className="flex-1 w-full">
              <div className="inline-flex items-center gap-2 bg-violet-500/20 text-violet-300 text-xs font-bold px-4 py-2 rounded-full mb-6 border border-violet-500/30">
                <Sparkles className="w-3.5 h-3.5" />
                World&apos;s first MCP-powered outreach platform
              </div>
              <h2 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight leading-[1.08] mb-6">
                Your AI agent,<br />
                <span className="bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">
                  inside your pipeline.
                </span>
              </h2>
              <p className="text-gray-400 text-base md:text-lg leading-relaxed mb-8">
                OutReachAI is the first outreach tool with native <strong className="text-white">MCP (Model Context Protocol)</strong> support. Connect Claude Desktop or Claude Code directly to your account — and let AI run your entire outreach pipeline as an autonomous agent.
              </p>
              <ul className="space-y-3 mb-10">
                {[
                  '13 tools: manage leads, campaigns, inbox, sequences',
                  'Auto-classify replies — positive, negative, OOO',
                  'Morning pipeline runs, hot lead ranking, reply drafts',
                  'One-click setup from Settings → MCP Server',
                ].map(item => (
                  <li key={item} className="flex items-center gap-3 text-sm text-gray-300">
                    <Check className="w-4 h-4 text-violet-400 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-500 to-blue-600 hover:from-violet-600 hover:to-blue-700 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-lg shadow-violet-500/20"
              >
                Get your MCP config
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Code block */}
            <div className="flex-1 w-full">
              <div className="bg-gray-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-white/5">
                  <div className="w-3 h-3 rounded-full bg-red-500/70" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                  <div className="w-3 h-3 rounded-full bg-green-500/70" />
                  <span className="ml-2 text-xs text-gray-500 font-mono">.mcp.json</span>
                </div>
                <pre className="p-6 text-xs font-mono leading-relaxed overflow-x-auto text-gray-300">{`{
  "mcpServers": {
    "outreachai": {
      "type": "http",
      "url": "https://outreachai.in/api/mcp",
      "headers": {
        "Authorization": "Bearer <your-token>",
        "X-User-Id": "<your-user-id>"
      }
    }
  }
}`}</pre>
                <div className="px-6 pb-6">
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <p className="text-xs text-gray-400 mb-3 font-semibold uppercase tracking-widest">Available tools</p>
                    <div className="flex flex-wrap gap-1.5">
                      {['batchRunPendingSteps','classifyReply','enrichLead','executeEmailStep','getHotLeads','getDashboardStats','getNotifications','getCampaignPerformance','getPendingSteps','pauseLeadOnReply','queueLinkedInStep','rankLeadsByPriority','suggestReply'].map(tool => (
                        <span key={tool} className="text-[10px] font-mono bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded border border-violet-500/20">
                          {tool}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="bg-gray-50 py-16 md:py-24">
        <div className="max-w-3xl mx-auto px-4 md:px-6">
          <div className="text-center mb-10 md:mb-14">
            <p className="text-sm font-semibold text-blue-600 uppercase tracking-widest mb-3">FAQ</p>
            <h2 className="text-2xl md:text-4xl font-extrabold text-gray-900 tracking-tight">
              Common questions
            </h2>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-4 md:px-8">
            {faqs.map(({ q, a }) => (
              <FAQItem key={q} q={q} a={a} />
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="bg-gray-950 py-16 md:py-28">
        <div className="max-w-3xl mx-auto px-4 md:px-6 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 text-blue-300 text-xs font-semibold px-4 py-2 rounded-full mb-6 md:mb-8 border border-white/10">
            <Sparkles className="w-3.5 h-3.5" />
            Join 12,000+ users already growing with AI
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-extrabold text-white tracking-tight mb-4 md:mb-6">
            Your next 10 meetings are one campaign away.
          </h2>
          <p className="text-gray-400 text-base md:text-xl mb-8 md:mb-10">
            Set up your first OutReachAI campaign in under 10 minutes. Free forever — no card needed.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-600 hover:to-violet-700 text-white font-bold px-8 md:px-10 py-4 rounded-xl transition-all shadow-lg shadow-blue-500/25 text-base md:text-lg w-full sm:w-auto"
          >
            Get started free
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-black border-t border-white/5 py-10 md:py-12">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="flex flex-col md:flex-row items-start justify-between gap-8 md:gap-10 mb-8 md:mb-10">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg" style={{ backgroundColor: '#0A66C2' }}>
                  <span className="text-white font-black text-xs leading-none" style={{ fontFamily: 'Georgia, serif' }}>in</span>
                </div>
                <span className="text-base font-extrabold text-white tracking-tight">
                  OutReachAI<span style={{ color: '#60A5FA' }}>.in</span>
                </span>
              </div>
              <p className="text-gray-500 text-sm max-w-xs leading-relaxed">
                AI-powered LinkedIn outreach for Indian startups, founders, and sales teams.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-10 text-sm">
              <div>
                <div className="text-white font-semibold mb-3">Product</div>
                <div className="space-y-2 text-gray-500">
                  <a href="#features" className="block hover:text-gray-300 transition-colors">Features</a>
                  <a href="#pricing" className="block hover:text-gray-300 transition-colors">Pricing</a>
                  <a href="#how-it-works" className="block hover:text-gray-300 transition-colors">How it works</a>
                  <a href={CHROME_STORE_URL} target="_blank" rel="noopener noreferrer" className="block hover:text-gray-300 transition-colors">Chrome extension</a>
                  <Link href="/changelog" className="block hover:text-gray-300 transition-colors">Changelog</Link>
                </div>
              </div>
              <div>
                <div className="text-white font-semibold mb-3">Compare</div>
                <div className="space-y-2 text-gray-500">
                  <Link href="/vs/lemlist" className="block hover:text-gray-300 transition-colors">vs Lemlist</Link>
                  <Link href="/vs/hubspot" className="block hover:text-gray-300 transition-colors">vs HubSpot</Link>
                  <Link href="/vs/instantly" className="block hover:text-gray-300 transition-colors">vs Instantly</Link>
                  <Link href="/vs/apollo" className="block hover:text-gray-300 transition-colors">vs Apollo</Link>
                  <Link href="/vs/saleshandy" className="block hover:text-gray-300 transition-colors">vs Saleshandy</Link>
                  <Link href="/vs/webengage" className="block hover:text-gray-300 transition-colors">vs WebEngage</Link>
                  <Link href="/privacy" className="block hover:text-gray-300 transition-colors">Privacy policy</Link>
                  <Link href="/terms" className="block hover:text-gray-300 transition-colors">Terms of service</Link>
                </div>
              </div>
              <div>
                <div className="text-white font-semibold mb-3">Company</div>
                <div className="space-y-2 text-gray-500">
                  <Link href="/about" className="block hover:text-gray-300 transition-colors">About</Link>
                  <a href="mailto:outreachai.in@gmail.com" className="block hover:text-gray-300 transition-colors">Contact</a>
                  <Link href="/report-issue" className="block hover:text-gray-300 transition-colors">Report issue</Link>
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-white/5 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-gray-600">© 2025 OutReachAI.in · Made with ❤️ in India</p>
            <p className="text-xs text-gray-600">Not affiliated with LinkedIn Corporation</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
