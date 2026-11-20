import Link from 'next/link'
import {
  Mail, Flame, UserSearch, BarChart2, Users,
  Check, ArrowRight, Zap, Shield, Globe, Sparkles,
  FlaskConical, MousePointerClick, Lock,
  Inbox, Star, FileText, Calendar, ClipboardList,
  MousePointer2, BookOpen, Target, Repeat, CheckSquare,
  Building2, Activity,
} from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Features — OutreachAI',
  description: 'Cold email sequences, LinkedIn outreach, lead enrichment, email warmup, deliverability, analytics, and more. One free platform — bring your own keys.',
}

// ─── Feature categories ───────────────────────────────────────────────────────

const categories = [
  {
    id: 'outreach',
    label: 'Outreach',
    color: 'bg-blue-500',
    lightBg: 'bg-blue-50 dark:bg-blue-950/40',
    border: 'border-blue-100 dark:border-blue-900',
    features: [
      {
        icon: Repeat,
        color: 'bg-blue-500',
        tag: 'Sequences',
        title: 'Multi-step outreach sequences',
        description:
          'Build multi-step follow-up flows that pause the moment a prospect replies. Set delays between steps and let OutreachAI run the whole sequence.',
        bullets: [
          'Up to 8-step sequences with configurable delays',
          'Auto-pause on reply detection',
          'Assign any message template to each step',
          'Toggle sequences active/inactive at any time',
        ],
        href: '/sequences',
      },
      {
        icon: Target,
        color: 'bg-indigo-500',
        tag: 'Campaigns',
        title: 'Campaign management',
        description:
          'Combine a lead list with a sequence into a campaign. Track every campaign\'s status — draft, active, paused, or completed — from one dashboard.',
        bullets: [
          'Grid and list view for all campaigns',
          'Link any lead list + sequence in seconds',
          'Launch, pause, and complete campaigns with one click',
          'Per-campaign reply and lead metrics',
        ],
        href: '/campaigns',
      },
      {
        icon: FileText,
        color: 'bg-violet-500',
        tag: 'Templates',
        title: 'Message templates with variables',
        description:
          'Create reusable message templates with dynamic variables. Templates sync across your Chrome extension and webapp so your message library stays consistent.',
        bullets: [
          '{{firstName}}, {{company}}, {{headline}}, {{lastName}} variables',
          'Manage templates in the dashboard or extension',
          'Templates sync instantly to the Chrome extension',
          'Default templates included to get started fast',
        ],
        href: '/templates',
      },
      {
        icon: Calendar,
        color: 'bg-sky-500',
        tag: 'Scheduling',
        title: 'Outreach scheduling',
        description:
          'Control exactly when your outreach goes out. Set send windows, pick optimal times, and make sure messages land during business hours in the prospect\'s timezone.',
        bullets: [
          'Schedule outreach by day and time window',
          'Timezone-aware sending',
          'Visualise your outreach calendar',
          'Prevent messages from sending on weekends',
        ],
        href: '/schedule',
      },
    ],
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    color: 'bg-blue-600',
    lightBg: 'bg-blue-50 dark:bg-blue-950/40',
    border: 'border-blue-100 dark:border-blue-900',
    features: [
      {
        icon: MousePointer2,
        color: 'bg-blue-600',
        tag: 'Chrome Extension',
        title: 'LinkedIn profile scraper',
        description:
          'Browse LinkedIn naturally. The extension auto-reads every profile you visit — name, headline, company, about, skills, recent posts — and fills your outreach panel instantly.',
        bullets: [
          'Auto-scrapes name, headline, company, about, skills',
          'Works on profile pages and messaging threads',
          'One-click "Add to Lead List + AI Opener"',
          'Capture LinkedIn posts for AI repurposing',
        ],
        href: '/download-extension',
      },
      {
        icon: Inbox,
        color: 'bg-cyan-600',
        tag: 'Inbox',
        title: 'Unified inbox — LinkedIn + Email',
        description:
          'One channel-agnostic inbox for every reply. LinkedIn DMs and email replies show up in the same thread view with the same compose UX. Open, read, reply, and resolve without context-switching.',
        bullets: [
          'LinkedIn DMs auto-sync every 15 seconds',
          'Email replies detected via IMAP and threaded automatically',
          'AI reply composer with one-click templates',
          'Auto-marks the lead as "replied" on the first inbound message',
        ],
        href: '/inbox',
      },
      {
        icon: BookOpen,
        color: 'bg-teal-500',
        tag: 'Content',
        title: 'Captured posts & AI repurposing',
        description:
          'Capture LinkedIn posts from any profile and save them to your dashboard. Use AI to repurpose top-performing posts into new content for your own feed.',
        bullets: [
          'Capture up to 10 posts per profile with one click',
          'Saves post text, URL, likes, and comments',
          'View all captured posts in one library',
          'AI-powered repurposing to transform posts into new angles',
        ],
        href: '/captured-posts',
      },
    ],
  },
  {
    id: 'leads',
    label: 'Lead Management',
    color: 'bg-emerald-500',
    lightBg: 'bg-emerald-50 dark:bg-emerald-950/40',
    border: 'border-emerald-100 dark:border-emerald-900',
    features: [
      {
        icon: Users,
        color: 'bg-emerald-500',
        tag: 'Leads',
        title: 'Lead list management',
        description:
          'Organise prospects into named lead lists. Import from LinkedIn via the extension, from enrichment results, or via CSV. Assign lists to campaigns in one click.',
        bullets: [
          'Unlimited lead lists with custom names',
          'Import leads from LinkedIn extension directly',
          'One-click import from enrichment results',
          'Assign a list to any campaign instantly',
        ],
        href: '/leads',
      },
      {
        icon: UserSearch,
        color: 'bg-teal-500',
        tag: 'Enrichment',
        title: 'Contact finder with BYOK',
        description:
          'Find leads by job title and domain using your own Apollo or Hunter key. Apollo hits its free limit? We automatically fall back to Hunter — no manual switching.',
        bullets: [
          'Apollo.io: search by title + company/domain',
          'Hunter.io: email verification + domain search fallback',
          'Auto waterfall: Apollo → Hunter on quota exhaustion',
          'Verify email validity before importing',
        ],
        href: '/enrichment',
      },
      {
        icon: Star,
        color: 'bg-amber-500',
        tag: 'Hot Leads',
        title: 'AI-scored hot leads',
        description:
          'OutreachAI scores every lead based on their engagement signals — replies, opens, clicks, connection status. Hot leads (score ≥ 70) surface automatically so you focus on the warmest prospects first.',
        bullets: [
          'Engagement score per lead from 0–100',
          'Signal labels: replied, connected, opened, follow-up',
          'Ranked list sorted by score descending',
          'Campaign attribution per hot lead',
        ],
        href: '/hot-leads',
      },
      {
        icon: ClipboardList,
        color: 'bg-rose-500',
        tag: 'Contacts',
        title: 'Contact tracking',
        description:
          'Every person you\'ve messaged is tracked with status — messaged, follow-up scheduled, replied. Contacts sync from the Chrome extension and update automatically when prospects reply.',
        bullets: [
          'Status: Messaged / Follow-up / Replied',
          'Syncs from Chrome extension in real time',
          'Auto-updates to "Replied" on reply detection',
          'Full contact history with LinkedIn profile link',
        ],
        href: '/contacts',
      },
      {
        icon: Building2,
        color: 'bg-blue-600',
        tag: 'Companies',
        title: 'Account-based view',
        description:
          'Every lead and contact is auto-linked to a Company row by domain. See live counters of leads and contacts per account, plus a rolled-up activity feed across the entire account team.',
        bullets: [
          'Auto-upserted on lead/contact creation by email domain',
          'Live aggregates: contacts, leads, last activity',
          'Per-company activity feed across every touchpoint',
          'Editable industry, size, market, tech stack, tags',
        ],
        href: '/companies',
      },
    ],
  },
  {
    id: 'email',
    label: 'Email Infrastructure',
    color: 'bg-orange-500',
    lightBg: 'bg-orange-50 dark:bg-orange-950/40',
    border: 'border-orange-100 dark:border-orange-900',
    features: [
      {
        icon: Flame,
        color: 'bg-orange-500',
        tag: 'Warmup',
        title: 'Email warmup',
        description:
          'New domain? New sending account? Warmup builds your sender reputation automatically by exchanging emails between enrolled accounts on a 3-phase ramp.',
        bullets: [
          '3-phase ramp: 3 → 8 → 15 emails/day',
          'Configurable daily target per account',
          'Pool-based — emails go to other OutreachAI accounts',
          'Live progress: day X of 30-day warmup goal',
        ],
        href: '/warmup',
      },
      {
        icon: Shield,
        color: 'bg-red-500',
        tag: 'Deliverability',
        title: 'Domain health checker',
        description:
          'Check SPF, DKIM, and DMARC records for every sending domain in seconds. Get an overall deliverability score and actionable alerts before you start sending.',
        bullets: [
          'SPF, DKIM, and DMARC record validation',
          'Per-domain deliverability score (0–100)',
          'Alerts for misconfigured or missing records',
          'Linked warmup status per domain',
        ],
        href: '/deliverability',
      },
    ],
  },
  {
    id: 'marketing',
    label: 'Marketing',
    color: 'bg-indigo-500',
    lightBg: 'bg-indigo-50 dark:bg-indigo-950/40',
    border: 'border-indigo-100 dark:border-indigo-900',
    features: [
      {
        icon: MousePointerClick,
        color: 'bg-indigo-500',
        tag: 'Broadcasts',
        title: 'Marketing broadcast emails',
        description:
          'Send full HTML marketing campaigns to your entire contact list. Design in the live editor, preview in real time, track every open and click per recipient.',
        bullets: [
          'Full HTML editor with live iframe preview',
          'Variable personalisation in broadcast HTML',
          'Per-recipient open, click, and unsubscribe tracking',
          'One-click unsubscribe footer — CAN-SPAM compliant',
        ],
        href: '/marketing/new',
      },
      {
        icon: FlaskConical,
        color: 'bg-amber-500',
        tag: 'A/B Testing',
        title: 'Subject line A/B testing',
        description:
          'Test two subject lines on a slice of your list. After your chosen window, the winner is sent automatically to the remainder. Free — Mailchimp charges for this.',
        bullets: [
          'Configurable split % and test duration',
          'Pick winner by open rate or click rate',
          'Auto-send winner to remaining recipients',
          'Real-time A/B results panel with progress bars',
        ],
        href: '/marketing/new',
      },
    ],
  },
  {
    id: 'analytics',
    label: 'Analytics & Productivity',
    color: 'bg-violet-500',
    lightBg: 'bg-violet-50 dark:bg-violet-950/40',
    border: 'border-violet-100 dark:border-violet-900',
    features: [
      {
        icon: BarChart2,
        color: 'bg-violet-500',
        tag: 'Analytics',
        title: 'Campaign analytics',
        description:
          'Per-campaign KPI cards, engagement timelines, and per-lead tracking. See exactly who opened what and when — for both outreach sequences and broadcast campaigns.',
        bullets: [
          'Sent, opened, clicked, replied, bounced per campaign',
          'Open rate and click rate calculations',
          'Per-lead engagement history and score',
          'Date range filter: last 7, 30, or 90 days',
        ],
        href: '/analytics',
      },
      {
        icon: CheckSquare,
        color: 'bg-pink-500',
        tag: 'Tasks',
        title: 'Follow-up task management',
        description:
          'Create tasks tied to leads and campaigns so nothing falls through the cracks. Mark tasks done, set due dates, and filter by status to stay on top of your outreach.',
        bullets: [
          'Create tasks linked to any lead or campaign',
          'Due date and priority per task',
          'Filter by open, in-progress, or completed',
          'Tasks visible across the whole workspace',
        ],
        href: '/tasks',
      },
      {
        icon: Activity,
        color: 'bg-fuchsia-500',
        tag: 'Activity',
        title: 'Per-lead activity timeline',
        description:
          'Every email send, open, click, reply, bounce, LinkedIn step, task, and manual note is captured on a single chronological timeline per lead — and rolled up per company. Drop in a note from the side drawer in two clicks.',
        bullets: [
          'Auto-captures email + LinkedIn + task events',
          'Side-drawer view on every lead in a list',
          'Manual note composer for offline conversations',
          'Account-level rollup on the Company detail page',
        ],
        href: '/leads',
      },
      {
        icon: Users,
        color: 'bg-pink-600',
        tag: 'Teams',
        title: 'Team workspaces',
        description:
          'Invite teammates into a shared workspace. Everyone shares the same campaigns, leads, and templates. Role-based access keeps permissions clean.',
        bullets: [
          'Roles: Owner → Admin → Member → Viewer',
          'Email invite with 7-day expiry token',
          'Workspace switcher in the top bar',
          'One workspace = one flat price (no per-seat fees)',
        ],
        href: '/settings/team',
      },
    ],
  },
]

const allFeatureCount = categories.reduce((acc, c) => acc + c.features.length, 0)

const comparison = [
  { feature: 'Cold email sequences',      outreach: true,  instantly: true,       mailchimp: false },
  { feature: 'LinkedIn outreach',         outreach: true,  instantly: false,      mailchimp: false },
  { feature: 'Marketing broadcasts',      outreach: true,  instantly: false,      mailchimp: true  },
  { feature: 'Email warmup',             outreach: true,  instantly: true,       mailchimp: false },
  { feature: 'A/B subject testing',      outreach: true,  instantly: true,       mailchimp: 'paid' },
  { feature: 'Team workspaces',          outreach: true,  instantly: 'paid',     mailchimp: 'paid' },
  { feature: 'Contact finder (BYOK)',    outreach: true,  instantly: 'paid',     mailchimp: false  },
  { feature: 'Deliverability checker',   outreach: true,  instantly: true,       mailchimp: false  },
  { feature: 'Hot lead scoring',         outreach: true,  instantly: false,      mailchimp: false  },
  { feature: 'Unified inbox (LI + Email)', outreach: true, instantly: false,     mailchimp: false },
  { feature: 'Account-based view',       outreach: true,  instantly: false,      mailchimp: false  },
  { feature: 'Per-lead activity timeline', outreach: true, instantly: false,     mailchimp: false  },
  { feature: 'Open & click tracking',    outreach: true,  instantly: true,       mailchimp: true   },
  { feature: 'Self-hosted / open source',outreach: true,  instantly: false,      mailchimp: false  },
  { feature: 'Price',                    outreach: 'Free', instantly: '$37+/mo', mailchimp: '$13+/contacts' },
]

function Cell({ value }: { value: boolean | string }) {
  if (value === true)  return <Check className="w-5 h-5 text-green-500 mx-auto" />
  if (value === false) return <span className="text-gray-300 dark:text-gray-600 text-lg mx-auto block text-center">—</span>
  return <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 block text-center">{value}</span>
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 font-sans antialiased">

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 bg-white/90 dark:bg-gray-950/90 backdrop-blur border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg shadow-sm" style={{ backgroundColor: '#0A66C2' }}>
              <span className="text-white font-black text-[13px] leading-none" style={{ fontFamily: 'Georgia, serif' }}>in</span>
            </div>
            <span className="text-lg font-extrabold text-gray-900 dark:text-white tracking-tight">
              OutReachAI<span style={{ color: '#0A66C2' }}>.in</span>
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-500 dark:text-gray-400">
            <Link href="/features" className="text-blue-600 dark:text-blue-400 font-semibold">Features</Link>
            <Link href="/#pricing" className="hover:text-gray-900 dark:hover:text-white transition-colors">Pricing</Link>
            <Link href="/login" className="hover:text-gray-900 dark:hover:text-white transition-colors">Log in</Link>
          </div>
          <Link href="/signup"
            className="text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-2 rounded-lg shadow-sm hover:from-blue-700 hover:to-violet-700 transition-all">
            Start free
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="bg-gradient-to-b from-gray-950 to-gray-900 py-24 px-6 text-center">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-blue-500/10 text-blue-400 text-xs font-bold px-4 py-2 rounded-full mb-6 border border-blue-500/20">
            <Sparkles className="w-3.5 h-3.5" />
            Everything included — no paywalls, no per-seat fees
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold text-white tracking-tight leading-[1.05] mb-6">
            {allFeatureCount} features.<br />
            <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
              Zero credit card required.
            </span>
          </h1>
          <p className="text-xl text-gray-400 leading-relaxed mb-10 max-w-2xl mx-auto">
            Cold outreach, LinkedIn automation, lead enrichment, email warmup, deliverability, marketing broadcasts, analytics, and more — all free, all in one place.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link href="/signup"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-lg">
              Get started free <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Category pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-10">
            {categories.map(c => (
              <a key={c.id} href={`#${c.id}`}
                className="text-xs font-semibold px-3 py-1.5 rounded-full bg-white/10 text-gray-300 hover:bg-white/20 border border-white/10 transition-all">
                {c.label}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── Feature sections ── */}
      <div className="py-8 px-6">
        <div className="max-w-7xl mx-auto space-y-20">
          {categories.map((cat) => (
            <section key={cat.id} id={cat.id}>
              {/* Section header */}
              <div className="flex items-center gap-3 mb-8">
                <div className={`w-2 h-8 rounded-full ${cat.color}`} />
                <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white">{cat.label}</h2>
                <span className="text-sm text-gray-400 font-medium">{cat.features.length} feature{cat.features.length !== 1 ? 's' : ''}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {cat.features.map((f) => (
                  <div key={f.tag}
                    className={`rounded-2xl border ${cat.border} ${cat.lightBg} p-7 hover:shadow-md transition-all`}>
                    {/* Header */}
                    <div className="flex items-start gap-4 mb-4">
                      <div className={`flex items-center justify-center w-10 h-10 ${f.color} rounded-xl flex-shrink-0`}>
                        <f.icon className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-0.5">
                          {f.tag}
                        </span>
                        <h3 className="text-base font-bold text-gray-900 dark:text-white leading-tight">
                          {f.title}
                        </h3>
                      </div>
                    </div>

                    <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-4">
                      {f.description}
                    </p>

                    <ul className="space-y-1.5 mb-5">
                      {f.bullets.map(b => (
                        <li key={b} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                          <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0 mt-0.5" />
                          {b}
                        </li>
                      ))}
                    </ul>

                    <Link href={f.href}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:gap-2.5 transition-all">
                      Explore <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      {/* ── BYOK callout ── */}
      <section className="bg-gray-50 dark:bg-gray-900 py-20 px-6 mt-16">
        <div className="max-w-5xl mx-auto">
          <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-3xl p-10 md:p-14">
            <div className="grid md:grid-cols-2 gap-10 items-center">
              <div>
                <div className="inline-flex items-center gap-2 bg-teal-500/10 text-teal-400 text-xs font-bold px-3 py-1.5 rounded-full mb-5 border border-teal-500/20">
                  <Zap className="w-3 h-3" /> BYOK — Bring Your Own Key
                </div>
                <h2 className="text-3xl md:text-4xl font-extrabold text-white leading-tight mb-4">
                  You own the keys.<br />We own nothing.
                </h2>
                <p className="text-gray-400 leading-relaxed mb-6">
                  OutReachAI never marks up API costs. Your emails go through your SMTP. Your AI calls go to your Anthropic or OpenAI account. Your enrichment credits go to your Apollo or Hunter plan.
                </p>
                <Link href="/settings"
                  className="inline-flex items-center gap-2 bg-teal-500 hover:bg-teal-600 text-white font-bold px-5 py-2.5 rounded-xl transition-all text-sm">
                  Configure your keys <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="space-y-3">
                {[
                  { icon: Mail,       label: 'Email sending',    detail: 'Gmail / GoDaddy / SES — your SMTP' },
                  { icon: Sparkles,   label: 'AI features',      detail: 'Anthropic / OpenAI / Gemini — your key' },
                  { icon: UserSearch, label: 'Lead enrichment',  detail: 'Apollo → Hunter auto-waterfall' },
                  { icon: Shield,     label: 'Self-hosted',      detail: 'docker compose up — your server, your data' },
                  { icon: Lock,       label: 'Encrypted storage', detail: 'Keys stored encrypted, never logged' },
                ].map(({ icon: Icon, label, detail }) => (
                  <div key={label} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                    <div className="w-8 h-8 bg-teal-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-teal-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{label}</p>
                      <p className="text-xs text-gray-400">{detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Comparison table ── */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-4">
              How we compare
            </h2>
            <p className="text-gray-500 dark:text-gray-400">
              The only free platform that does cold outreach, LinkedIn automation, <em>and</em> marketing emails.
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
                  <th className="text-left px-6 py-4 font-semibold text-gray-500 dark:text-gray-400 w-52">Feature</th>
                  <th className="px-6 py-4 text-center">
                    <span className="font-extrabold text-blue-600 dark:text-blue-400">OutReachAI</span>
                    <span className="block text-xs text-gray-400 font-normal">Free forever</span>
                  </th>
                  <th className="px-6 py-4 text-center">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">Instantly</span>
                    <span className="block text-xs text-gray-400 font-normal">$37+/month</span>
                  </th>
                  <th className="px-6 py-4 text-center">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">Mailchimp</span>
                    <span className="block text-xs text-gray-400 font-normal">$13+/contacts</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((row, i) => (
                  <tr key={row.feature}
                    className={`border-b border-gray-100 dark:border-gray-800 last:border-0 ${i % 2 === 0 ? 'bg-white dark:bg-gray-950' : 'bg-gray-50/50 dark:bg-gray-900/50'}`}>
                    <td className="px-6 py-3.5 font-medium text-gray-700 dark:text-gray-300">{row.feature}</td>
                    <td className="px-6 py-3.5 text-center">
                      {row.feature === 'Price'
                        ? <span className="font-extrabold text-green-600 dark:text-green-400">{row.outreach}</span>
                        : <Cell value={row.outreach} />}
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      {row.feature === 'Price'
                        ? <span className="text-gray-500 dark:text-gray-400 text-xs font-medium">{row.instantly}</span>
                        : <Cell value={row.instantly} />}
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      {row.feature === 'Price'
                        ? <span className="text-gray-500 dark:text-gray-400 text-xs font-medium">{row.mailchimp}</span>
                        : <Cell value={row.mailchimp} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-gray-400 text-center mt-4">
            ✓ = included free &nbsp;·&nbsp; — = not available &nbsp;·&nbsp; amber = paid add-on
          </p>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="bg-gradient-to-r from-blue-600 to-violet-600 py-20 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-4xl font-extrabold text-white mb-4">
            Replace your $200/month outreach stack — for free.
          </h2>
          <p className="text-blue-100 text-lg mb-8">Set up in 5 minutes. No credit card. No per-seat fees.</p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link href="/signup"
              className="inline-flex items-center gap-2 bg-white text-blue-600 font-bold px-8 py-3.5 rounded-xl hover:bg-blue-50 transition-all shadow-lg text-base">
              Start for free <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/download-extension"
              className="inline-flex items-center gap-2 bg-white/10 text-white font-semibold px-6 py-3.5 rounded-xl border border-white/20 hover:bg-white/20 transition-all text-base">
              <Globe className="w-4 h-4" /> Get the extension
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-gray-950 py-10 px-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg" style={{ backgroundColor: '#0A66C2' }}>
            <span className="text-white font-black text-[11px]" style={{ fontFamily: 'Georgia, serif' }}>in</span>
          </div>
          <span className="text-white font-bold text-sm">OutReachAI.in</span>
        </div>
        <p className="text-gray-600 text-xs">
          Open source · Self-hostable · Free forever ·{' '}
          <Link href="/privacy" className="hover:text-gray-400 transition-colors">Privacy</Link>{' · '}
          <Link href="/terms" className="hover:text-gray-400 transition-colors">Terms</Link>
        </p>
      </footer>

    </div>
  )
}
