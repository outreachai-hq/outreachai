'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { useState, useEffect, useRef } from 'react'
import {
  ChevronLeft, ChevronRight, ChevronDown, X,
  Bell, Moon, Sun, ExternalLink,
  Home, Bot, Users, User,
  Megaphone, CheckSquare, Inbox, CalendarDays, Calendar,
  BarChart2, Shield, Flame, Activity,
  Settings, LogOut, Download, UserSearch, Bug, Newspaper, ShieldCheck,
  TrendingUp, Zap, Building2, GitBranch, Phone, ListChecks,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────
interface Notification {
  id: string
  type: 'followup' | 'reply'
  title: string
  body: string
  href: string
  at: string | null
}

// Fix 3: added 'live' badge kind for the Extension link
type Badge = { kind: 'beta' } | { kind: 'soon' } | { kind: 'live' } | null

interface NavItemDef {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: Badge
  disabled?: boolean
  // Fix 2: exact=true forces pathname === href matching (prevents /settings matching /settings/team)
  exact?: boolean
}

// ── Nav structure ─────────────────────────────────────────────────────────────
const NAV_TOP: NavItemDef[] = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/agent', label: 'OutReach Agent', icon: Bot, badge: { kind: 'beta' } },
]

const NAV_FIND: NavItemDef[] = [
  { href: '/contacts', label: 'Contacts', icon: User },
  { href: '/leads', label: 'Lead Lists', icon: Users },
  { href: '/companies', label: 'Companies', icon: Building2 },
  { href: '/pipeline', label: 'CRM Pipeline', icon: TrendingUp },
  { href: '/hot-leads', label: 'Hot Leads', icon: Flame },
]

const NAV_ENGAGE: NavItemDef[] = [
  { href: '/campaigns', label: 'Campaigns', icon: Megaphone },
  { href: '/sequences', label: 'Sequences', icon: GitBranch },
  { href: '/inbox', label: 'Inbox', icon: Inbox },
  { href: '/outreach-queue', label: 'Outreach Queue', icon: ListChecks },
  { href: '/tasks', label: 'Tasks', icon: CheckSquare },
  { href: '/workflows', label: 'Workflows', icon: Zap },
  { href: '/bookings', label: 'Bookings', icon: Calendar },
]

const NAV_GROW: NavItemDef[] = [
  { href: '/marketing', label: 'Marketing', icon: Megaphone },
  { href: '/warmup', label: 'Email Warmup', icon: Flame },
  { href: '/captured-posts', label: 'Captured Posts', icon: Newspaper },
]

const NAV_ANALYZE: NavItemDef[] = [
  { href: '/analytics', label: 'Reports', icon: BarChart2 },
  { href: '/dashboards', label: 'Dashboards', icon: BarChart2 },
  { href: '/insights', label: 'Insights', icon: Activity },
  { href: '/deliverability', label: 'Deliverability', icon: Shield },
]

const NAV_COMING_SOON: NavItemDef[] = [
  { href: '/signals', label: 'Signal Agents', icon: Zap, badge: { kind: 'soon' }, disabled: true },
  { href: '/calls', label: 'Calls (VOIP)', icon: Phone, badge: { kind: 'soon' }, disabled: true },
  { href: '/enrichment', label: 'Lead Finder', icon: UserSearch, badge: { kind: 'soon' }, disabled: true },
]

// ── Small sub-components ──────────────────────────────────────────────────────

function BadgeLabel({ badge, collapsed }: { badge: Badge; collapsed: boolean }) {
  if (!badge || collapsed) return null
  if (badge.kind === 'beta') {
    return (
      <span className="rounded-full text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 font-semibold leading-none border border-blue-200 dark:border-blue-800/40">
        Beta
      </span>
    )
  }
  if (badge.kind === 'live') {
    return (
      <span className="rounded-full text-[10px] px-1.5 py-0.5 bg-emerald-50 text-emerald-700 font-medium leading-none border border-emerald-200 dark:bg-emerald-900 dark:text-emerald-200 dark:border-emerald-600">
        Live
      </span>
    )
  }
  return (
    <span className="rounded-full text-[10px] px-2 py-0.5 bg-gray-100 text-gray-500 dark:bg-gray-800/50 dark:text-gray-400 font-semibold leading-none border border-gray-200 dark:border-gray-700/40">
      Soon
    </span>
  )
}

function NavItem({
  href,
  label,
  icon: Icon,
  badge = null,
  disabled = false,
  exact = false,
  collapsed,
}: NavItemDef & { collapsed: boolean }) {
  const pathname = usePathname()
  // Fix 2: exact=true skips the startsWith check, preventing /settings from activating on /settings/team
  const isActive = exact
    ? pathname === href
    : pathname === href || (href !== '/dashboard' && !disabled && pathname.startsWith(href + '/'))

  const baseClasses =
    'flex items-center gap-2.5 px-3 rounded-lg text-sm transition-all h-9 relative'

  const activeClasses = isActive
    ? 'bg-blue-50 text-blue-700 font-semibold dark:bg-blue-900/40 dark:text-blue-200'
    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100 font-medium'

  const disabledClasses = disabled
    ? 'opacity-60 cursor-not-allowed pointer-events-none'
    : ''

  const inner = (
    <>
      <Icon className="w-4 h-4 flex-shrink-0" />
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{label}</span>
          <BadgeLabel badge={badge} collapsed={collapsed} />
        </>
      )}
    </>
  )

  if (disabled) {
    return (
      <div
        title={collapsed ? label : undefined}
        className={`${baseClasses} ${activeClasses} ${disabledClasses}`}
      >
        {inner}
      </div>
    )
  }

  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={`${baseClasses} ${activeClasses} ${disabledClasses} ${
        isActive && !collapsed ? 'border-l-2 border-blue-600 dark:border-blue-400 pl-2.5' : ''
      }`}
    >
      {inner}
    </Link>
  )
}

function SectionLabel({
  label,
  collapsed,
  isOpen,
  onToggle,
}: {
  label: string
  collapsed: boolean
  isOpen: boolean
  onToggle: () => void
}) {
  if (collapsed) return <div className="h-px bg-gray-100 dark:bg-gray-800 my-2 mx-2" />
  return (
    <button
      onClick={onToggle}
      className="flex items-center justify-between w-full px-3 mb-1 mt-4 group"
    >
      <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors">
        {label}
      </p>
      <ChevronDown
        className={`w-3 h-3 text-gray-300 dark:text-gray-600 group-hover:text-gray-500 transition-all duration-200 ${isOpen ? '' : '-rotate-90'}`}
      />
    </button>
  )
}

// ── NotificationBell ──────────────────────────────────────────────────────────
function NotificationBell({ collapsed }: { collapsed: boolean }) {
  const [open, setOpen] = useState(false)
  const [notifs, setNotifs] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/notifications')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return
        setNotifs(d.notifications ?? [])
        setUnread(d.unreadCount ?? 0)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Notifications"
        className="relative flex items-center gap-2.5 px-3 h-9 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100 w-full transition-colors"
      >
        <div className="relative flex-shrink-0">
          <Bell className="w-4 h-4" />
          {unread > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </div>
        {!collapsed && <span className="truncate">Notifications</span>}
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-80 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Notifications
            </span>
            {unread > 0 && (
              <span className="text-xs bg-rose-50 text-rose-600 px-2 py-0.5 rounded-full font-medium">
                {unread} new
              </span>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifs.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-400">
                All caught up! 🎉
              </div>
            ) : (
              notifs.map((n) => (
                <a
                  key={n.id}
                  href={n.href}
                  target={n.href.startsWith('http') ? '_blank' : undefined}
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-50 dark:border-gray-800 last:border-0 transition-colors"
                >
                  <span className="text-lg flex-shrink-0 mt-0.5">
                    {n.type === 'followup' ? '⏰' : '💬'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {n.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                      {n.body}
                    </p>
                  </div>
                  {n.href.startsWith('http') && (
                    <ExternalLink className="w-3 h-3 text-gray-300 flex-shrink-0 mt-1" />
                  )}
                </a>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── DarkModeToggle ────────────────────────────────────────────────────────────
function DarkModeToggle({ collapsed }: { collapsed: boolean }) {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const isDark = stored === 'dark' || (!stored && prefersDark)
    setDark(isDark)
    document.documentElement.classList.toggle('dark', isDark)
  }, [])

  function toggle() {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }

  return (
    <button
      onClick={toggle}
      title={dark ? 'Light mode' : 'Dark mode'}
      className="flex items-center gap-2.5 px-3 h-9 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100 w-full transition-colors"
    >
      <span className="flex-shrink-0">
        {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </span>
      {!collapsed && <span>{dark ? 'Light mode' : 'Dark mode'}</span>}
    </button>
  )
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
export default function Sidebar({
  mobileOpen = false,
  onClose,
}: {
  mobileOpen?: boolean
  onClose?: () => void
} = {}) {
  const { data: session } = useSession()
  const [collapsed, setCollapsed] = useState(false)
  const [closedSections, setClosedSections] = useState<Set<string>>(new Set(['coming-soon']))

  function toggleSection(key: string) {
    setClosedSections(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const userEmail = session?.user?.email ?? ''
  const userName = (session?.user?.name ?? '').trim() || userEmail
  const userInitials =
    userName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w: string) => w[0].toUpperCase())
      .join('') || (userEmail[0] ?? '?').toUpperCase()
  const plan: string = (session?.user as { plan?: string })?.plan ?? 'free'

  return (
    <aside
      className={`flex flex-col bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 h-screen flex-shrink-0
        fixed inset-y-0 left-0 z-50 transition-transform duration-200
        md:static md:z-auto md:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} ${
        collapsed ? 'w-[260px] md:w-16' : 'w-[260px]'
      }`}
    >
      {/* ── Logo ── */}
      {collapsed ? (
        <div className="flex flex-col items-center gap-2 px-2 py-3 border-b border-gray-100 dark:border-gray-800">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: '#0A66C2' }}
          >
            <span
              className="text-white font-black text-[13px] leading-none"
              style={{ fontFamily: 'Georgia, serif' }}
            >
              in
            </span>
          </div>
          <button
            onClick={() => setCollapsed(false)}
            className="text-gray-400 hover:text-gray-600 p-1 rounded"
            title="Expand"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center"
              style={{ backgroundColor: '#0A66C2' }}
            >
              <span
                className="text-white font-black text-[13px] leading-none"
                style={{ fontFamily: 'Georgia, serif' }}
              >
                in
              </span>
            </div>
            <span className="text-base font-extrabold text-gray-900 tracking-tight whitespace-nowrap">
              OutReachAI
              <span className="text-blue-600 dark:text-blue-400">.in</span>
            </span>
          </div>
          <button
            onClick={() => setCollapsed(true)}
            className="hidden md:block text-gray-400 hover:text-gray-600 p-1 rounded"
            title="Collapse"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="md:hidden text-gray-400 hover:text-gray-600 p-1 rounded"
            title="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* ── Nav ── */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto">
        {/* Home + OutReach Agent */}
        <div className="space-y-0.5">
          {NAV_TOP.map((item) => (
            <NavItem key={item.href} {...item} collapsed={collapsed} />
          ))}
        </div>

        {/* Divider */}
        <div className="h-px bg-gray-100 dark:bg-gray-800 my-3 mx-1" />

        {/* FIND & MANAGE */}
        <SectionLabel
          label="Find & Manage"
          collapsed={collapsed}
          isOpen={!closedSections.has('find')}
          onToggle={() => toggleSection('find')}
        />
        {/* Fix 7: overflow-hidden + max-h transition animates collapse instead of instant snap */}
        <div className={`overflow-hidden transition-all duration-200 ease-in-out ${closedSections.has('find') ? 'max-h-0 opacity-0' : 'max-h-64 opacity-100'}`}>
          <div className="space-y-0.5">
            {NAV_FIND.map((item) => (
              <NavItem key={item.href} {...item} collapsed={collapsed} />
            ))}
          </div>
        </div>

        {/* ENGAGE */}
        <SectionLabel
          label="Engage"
          collapsed={collapsed}
          isOpen={!closedSections.has('engage')}
          onToggle={() => toggleSection('engage')}
        />
        <div className={`overflow-hidden transition-all duration-200 ease-in-out ${closedSections.has('engage') ? 'max-h-0 opacity-0' : 'max-h-80 opacity-100'}`}>
          <div className="space-y-0.5">
            {NAV_ENGAGE.map((item) => (
              <NavItem key={item.href} {...item} collapsed={collapsed} />
            ))}
          </div>
        </div>

        {/* GROW */}
        <SectionLabel
          label="Grow"
          collapsed={collapsed}
          isOpen={!closedSections.has('grow')}
          onToggle={() => toggleSection('grow')}
        />
        <div className={`overflow-hidden transition-all duration-200 ease-in-out ${closedSections.has('grow') ? 'max-h-0 opacity-0' : 'max-h-40 opacity-100'}`}>
          <div className="space-y-0.5">
            {NAV_GROW.map((item) => (
              <NavItem key={item.href} {...item} collapsed={collapsed} />
            ))}
          </div>
        </div>

        {/* ANALYZE */}
        <SectionLabel
          label="Analyze"
          collapsed={collapsed}
          isOpen={!closedSections.has('analyze')}
          onToggle={() => toggleSection('analyze')}
        />
        <div className={`overflow-hidden transition-all duration-200 ease-in-out ${closedSections.has('analyze') ? 'max-h-0 opacity-0' : 'max-h-52 opacity-100'}`}>
          <div className="space-y-0.5">
            {NAV_ANALYZE.map((item) => (
              <NavItem key={item.href} {...item} collapsed={collapsed} />
            ))}
          </div>
        </div>

        {/* COMING SOON */}
        <SectionLabel
          label="Coming Soon"
          collapsed={collapsed}
          isOpen={!closedSections.has('coming-soon')}
          onToggle={() => toggleSection('coming-soon')}
        />
        <div className={`overflow-hidden transition-all duration-200 ease-in-out ${closedSections.has('coming-soon') ? 'max-h-0 opacity-0' : 'max-h-40 opacity-100'}`}>
          <div className="space-y-0.5">
            {NAV_COMING_SOON.map((item) => (
              <NavItem key={item.href} {...item} collapsed={collapsed} />
            ))}
          </div>
        </div>

        {/* Utility row */}
        <div className="mt-4 space-y-0.5">
          <NotificationBell collapsed={collapsed} />
          <DarkModeToggle collapsed={collapsed} />
          <NavItem
            href="/download-extension"
            label="Extension"
            icon={Download}
            badge={{ kind: 'live' }}
            collapsed={collapsed}
          />
          <NavItem href="/settings/team" label="Team" icon={Users} collapsed={collapsed} />
          {/* Fix 2: exact=true so /settings doesn't activate when on /settings/team */}
          <NavItem href="/settings" label="Settings" icon={Settings} exact collapsed={collapsed} />
          {session?.user?.isAdmin && (
            <NavItem href="/admin/users" label="Admin · Users" icon={ShieldCheck} collapsed={collapsed} />
          )}
          <Link
            href="/report-issue"
            title={collapsed ? 'Report issue' : undefined}
            className="flex items-center gap-2.5 px-3 h-9 rounded-lg text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 dark:text-gray-500 dark:hover:bg-red-950 dark:hover:text-red-400 transition-colors"
          >
            <Bug className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Report issue</span>}
          </Link>
        </div>
      </nav>

      {/* ── Footer ── */}
      <div className="px-3 py-3 border-t border-gray-100 dark:border-gray-800 space-y-2">
        {/* Plan badge */}
        {!collapsed && (
          <div className="flex items-center gap-2 px-1">
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 capitalize">
              {plan} plan
            </span>
          </div>
        )}

        {/* User row */}
        {userEmail ? (
          collapsed ? (
            <div className="flex justify-center">
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-xs font-bold text-blue-700 dark:text-blue-200">
                {userInitials}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-blue-700 dark:text-blue-200">
                {userInitials}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate"
                  title={userName}
                >
                  {userName}
                </p>
                <p className="text-[10px] text-gray-500 truncate" title={userEmail}>
                  {userEmail}
                </p>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                title="Sign out"
                className="flex-shrink-0 text-gray-400 hover:text-red-500 transition-colors p-1 rounded"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )
        ) : null}
      </div>
    </aside>
  )
}
