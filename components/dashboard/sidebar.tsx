'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Sparkles,
  TrendingUp,
  CalendarDays,
  BarChart3,
  Layers,
  History,
  Zap,
  Package,
} from 'lucide-react'

const nav = [
  { label: 'Dashboard',            href: '/',                    icon: LayoutDashboard },
  { label: 'Full Campaign Agent',  href: '/agents/full-campaign',icon: Zap,      highlight: true },
  { label: 'Content Creator',      href: '/agents/creator',      icon: Sparkles },
  { label: 'Trend Analyst',        href: '/agents/trend',        icon: TrendingUp },
  { label: 'Campaign Planner',     href: '/agents/campaign',     icon: CalendarDays },
  { label: 'Performance Reviewer', href: '/agents/performance',  icon: BarChart3 },
  { label: 'Product Catalog',      href: '/products',            icon: Package },
  { label: 'Automations',          href: '/automations',         icon: Zap },
  { label: 'History',              href: '/history',             icon: History },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 border-r border-zinc-200 bg-white flex flex-col z-40">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-zinc-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center">
            <Layers className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-zinc-900 leading-none">CADA</p>
            <p className="text-xs text-zinc-400 leading-none mt-0.5">Marketing HQ</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map(({ label, href, icon: Icon, highlight }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-zinc-900 text-white'
                  : highlight
                  ? 'bg-gradient-to-r from-violet-500 to-pink-500 text-white hover:opacity-90'
                  : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-zinc-100">
        <p className="text-xs text-zinc-400">Powered by Claude AI</p>
      </div>
    </aside>
  )
}
