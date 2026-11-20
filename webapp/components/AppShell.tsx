'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import TopBar from '@/components/TopBar'
import NavTour from '@/components/NavTour'
import MobileBottomNav from '@/components/MobileBottomNav'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileNavOpen(false)
  }, [pathname])

  return (
    <div className="h-dvh w-screen overflow-hidden flex bg-gray-50 dark:bg-gray-950">
      <Sidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <NavTour />

      {/* Mobile backdrop */}
      {mobileNavOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <TopBar activePath={pathname} onMenuClick={() => setMobileNavOpen(true)} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden pb-16 md:pb-0">{children}</main>
        {/* Fix 6: inside the layout container so z-stacking stays within the same context */}
        <MobileBottomNav onMoreClick={() => setMobileNavOpen(true)} />
      </div>
    </div>
  )
}
