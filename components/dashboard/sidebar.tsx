'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
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
  Settings,
  CalendarClock,
  LogOut,
} from 'lucide-react'

const SECTIONS = [
  {
    label: 'Agents',
    items: [
      { label: 'Dashboard',            href: '/',                     icon: LayoutDashboard },
      { label: 'Content Creator',      href: '/agents/creator',       icon: Sparkles },
      { label: 'Trend Analyst',        href: '/agents/trend',         icon: TrendingUp },
      { label: 'Campaign Planner',     href: '/agents/campaign',      icon: CalendarDays },
      { label: 'Performance Reviewer', href: '/agents/performance',   icon: BarChart3 },
    ],
  },
  {
    label: 'Manage',
    items: [
      { label: 'Product Catalog',  href: '/products',   icon: Package },
      { label: 'Post Scheduler',   href: '/scheduler',  icon: CalendarClock },
      { label: 'Automations',      href: '/automations', icon: Zap },
      { label: 'History',          href: '/history',    icon: History },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'Settings',  href: '/settings',  icon: Settings },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [brandName, setBrandName] = useState('')

  useEffect(() => {
    fetch('/api/settings/brand')
      .then(r => r.json())
      .then(d => { if (d.brand_name) setBrandName(d.brand_name) })
      .catch(() => {})
  }, [])

  async function handleSwitchClient() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 border-r border-zinc-200 bg-white flex flex-col z-40">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-zinc-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center">
            <Layers className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-zinc-900 leading-none">{brandName || 'Marketing HQ'}</p>
            <p className="text-xs text-zinc-400 leading-none mt-0.5">{brandName ? 'Marketing HQ' : 'Configure in Settings'}</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-5">
        {SECTIONS.map(({ label, items }) => (
          <div key={label}>
            <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">{label}</p>
            <div className="space-y-0.5">
              {items.map(({ label: itemLabel, href, icon: Icon }) => {
                const active = pathname === href
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                      active
                        ? 'bg-zinc-900 text-white'
                        : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
                    )}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {itemLabel}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-zinc-100 space-y-1">
        <button onClick={handleSwitchClient}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-zinc-500 hover:bg-red-50 hover:text-red-600 transition-colors">
          <LogOut className="w-3.5 h-3.5" /> Sign out
        </button>
        <p className="text-xs text-zinc-400 px-3">Powered by Claude AI</p>
      </div>
    </aside>
  )
}
