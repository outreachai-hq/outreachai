'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, User, Megaphone, Inbox, MoreHorizontal } from 'lucide-react'

const BOTTOM_TABS = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/contacts', label: 'Contacts', icon: User },
  { href: '/campaigns', label: 'Campaigns', icon: Megaphone },
  { href: '/inbox', label: 'Inbox', icon: Inbox },
]

interface MobileBottomNavProps {
  onMoreClick: () => void
}

export default function MobileBottomNav({ onMoreClick }: MobileBottomNavProps) {
  const pathname = usePathname()

  return (
    // Fix 1: pb-[env(safe-area-inset-bottom)] for iPhone home bar; pb-safe was invalid
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800 flex items-center justify-around pb-[env(safe-area-inset-bottom)]">
      {BOTTOM_TABS.map(({ href, label, icon: Icon }) => {
        const isActive =
          pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/'))
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center justify-center gap-1 flex-1 h-16 transition-colors ${
              isActive
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {/* Fix 4: use strokeWidth prop instead of stroke-[2.5] className */}
            <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
            <span className="text-[10px] font-medium leading-none">{label}</span>
          </Link>
        )
      })}
      {/* Fix 8: aria-label for screen readers */}
      <button
        onClick={onMoreClick}
        aria-label="Open navigation menu"
        className="flex flex-col items-center justify-center gap-1 flex-1 h-16 transition-colors text-gray-500 dark:text-gray-400"
      >
        <MoreHorizontal className="w-5 h-5" />
        <span className="text-[10px] font-medium leading-none">More</span>
      </button>
    </nav>
  )
}
