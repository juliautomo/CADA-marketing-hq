'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Sparkles, TrendingUp, CalendarDays, BarChart3, Zap, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const iconMap = {
  Sparkles,
  TrendingUp,
  CalendarDays,
  BarChart3,
  Zap,
} as const

export type AgentIconName = keyof typeof iconMap

// gradient pairs per card
const gradients: Record<string, { bg: string; glow: string; badge: string; arrow: string }> = {
  'bg-violet-500': {
    bg: 'from-violet-500 to-purple-600',
    glow: 'group-hover:shadow-violet-200',
    badge: 'bg-violet-50 text-violet-600 border-violet-100',
    arrow: 'bg-violet-600 text-white',
  },
  'bg-pink-500': {
    bg: 'from-pink-500 to-rose-500',
    glow: 'group-hover:shadow-pink-200',
    badge: 'bg-pink-50 text-pink-600 border-pink-100',
    arrow: 'bg-pink-500 text-white',
  },
  'bg-emerald-500': {
    bg: 'from-emerald-500 to-teal-500',
    glow: 'group-hover:shadow-emerald-200',
    badge: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    arrow: 'bg-emerald-500 text-white',
  },
  'bg-amber-500': {
    bg: 'from-amber-400 to-orange-500',
    glow: 'group-hover:shadow-amber-200',
    badge: 'bg-amber-50 text-amber-600 border-amber-100',
    arrow: 'bg-amber-500 text-white',
  },
}

interface AgentCardProps {
  title: string
  description: string
  href: string
  iconName: AgentIconName
  color: string
  capabilities: string[]
  index: number
}

export function AgentCard({ title, description, href, iconName, color, capabilities, index }: AgentCardProps) {
  const Icon = iconMap[iconName]
  const g = gradients[color] ?? gradients['bg-violet-500']

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
    >
      <Link href={href} className={cn(
        'group relative flex flex-col bg-white rounded-2xl border border-zinc-100 overflow-hidden',
        'hover:shadow-xl hover:-translate-y-1 transition-all duration-300',
        g.glow,
      )}>
        {/* coloured top strip */}
        <div className={cn('h-1.5 w-full bg-gradient-to-r', g.bg)} />

        <div className="p-5 flex flex-col flex-1 gap-4">
          {/* icon + label */}
          <div className="flex items-start justify-between">
            <div className={cn('w-11 h-11 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-sm', g.bg)}>
              <Icon className="w-5 h-5 text-white" />
            </div>
            <span className={cn('text-[10px] font-semibold px-2.5 py-1 rounded-full border tracking-wide uppercase', g.badge)}>
              AI Agent
            </span>
          </div>

          {/* title + desc */}
          <div>
            <h3 className="font-bold text-zinc-900 mb-1.5 text-[15px]">{title}</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">{description}</p>
          </div>

          {/* capabilities */}
          <div className="flex flex-wrap gap-1.5 mt-auto">
            {capabilities.map((cap) => (
              <span key={cap} className="text-[10px] font-medium bg-zinc-50 text-zinc-500 px-2 py-1 rounded-lg border border-zinc-100">
                {cap}
              </span>
            ))}
          </div>

          {/* CTA */}
          <div className={cn(
            'flex items-center justify-center gap-1.5 w-full py-2 rounded-xl text-xs font-semibold transition-all duration-200',
            'opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0',
            g.arrow,
          )}>
            Open agent <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </Link>
    </motion.div>
  )
}
