'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Sparkles, TrendingUp, CalendarDays, BarChart3, Zap, ArrowUpRight } from 'lucide-react'

const iconMap = { Sparkles, TrendingUp, CalendarDays, BarChart3, Zap } as const
export type AgentIconName = keyof typeof iconMap

const themes: Record<string, {
  glow: string
  pillBg: string
  pillText: string
  pillBorder: string
  iconGrad: string
  accentBg: string
  borderHover: string
  arrowBg: string
}> = {
  'bg-violet-500': {
    glow: '[--glow:79,70,229]',
    pillBg: 'bg-violet-500/10',
    pillText: 'text-violet-300',
    pillBorder: 'border-violet-500/25',
    iconGrad: 'from-violet-500 to-violet-700',
    accentBg: 'from-violet-500/15 via-violet-500/5 to-transparent',
    borderHover: 'group-hover:border-violet-500/50',
    arrowBg: 'bg-violet-600 group-hover:bg-violet-500',
  },
  'bg-pink-500': {
    glow: '[--glow:236,72,153]',
    pillBg: 'bg-pink-500/10',
    pillText: 'text-pink-300',
    pillBorder: 'border-pink-500/25',
    iconGrad: 'from-pink-500 to-rose-600',
    accentBg: 'from-pink-500/15 via-pink-500/5 to-transparent',
    borderHover: 'group-hover:border-pink-500/50',
    arrowBg: 'bg-pink-600 group-hover:bg-pink-500',
  },
  'bg-emerald-500': {
    glow: '[--glow:16,185,129]',
    pillBg: 'bg-emerald-500/10',
    pillText: 'text-emerald-300',
    pillBorder: 'border-emerald-500/25',
    iconGrad: 'from-emerald-400 to-teal-600',
    accentBg: 'from-emerald-500/15 via-emerald-500/5 to-transparent',
    borderHover: 'group-hover:border-emerald-500/50',
    arrowBg: 'bg-emerald-600 group-hover:bg-emerald-500',
  },
  'bg-amber-500': {
    glow: '[--glow:245,158,11]',
    pillBg: 'bg-amber-500/10',
    pillText: 'text-amber-300',
    pillBorder: 'border-amber-500/25',
    iconGrad: 'from-amber-400 to-orange-500',
    accentBg: 'from-amber-500/15 via-amber-500/5 to-transparent',
    borderHover: 'group-hover:border-amber-500/50',
    arrowBg: 'bg-amber-500 group-hover:bg-amber-400',
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
  const t = themes[color] ?? themes['bg-violet-500']

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.09, ease: [0.22, 1, 0.36, 1] }}
      className="h-full"
    >
      <Link
        href={href}
        className={[
          'group relative flex flex-col overflow-hidden rounded-2xl h-full',
          'bg-zinc-950 border border-zinc-800 transition-all duration-300',
          'hover:-translate-y-1.5',
          'hover:shadow-[0_20px_60px_-12px_rgba(var(--glow),0.35)]',
          t.glow,
          t.borderHover,
        ].join(' ')}
      >
        {/* accent glow wash — top-left corner */}
        <div className={`absolute inset-0 bg-gradient-to-br ${t.accentBg} opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none`} />

        {/* watermark icon — large, faded, bottom-right */}
        <div className="absolute -bottom-4 -right-4 opacity-[0.04] group-hover:opacity-[0.07] transition-opacity duration-500 pointer-events-none select-none">
          <Icon strokeWidth={1} className="w-36 h-36 text-white" />
        </div>

        <div className="relative z-10 flex flex-col gap-5 p-6 flex-1">
          {/* icon + arrow row */}
          <div className="flex items-start justify-between">
            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${t.iconGrad} flex items-center justify-center shadow-lg`}>
              <Icon className="w-5 h-5 text-white" strokeWidth={1.8} />
            </div>
            <span className={[
              'flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300',
              '-translate-y-1 opacity-0 group-hover:opacity-100 group-hover:translate-y-0',
              t.arrowBg,
            ].join(' ')}>
              <ArrowUpRight className="w-4 h-4 text-white" />
            </span>
          </div>

          {/* title + description */}
          <div>
            <h3 className="text-base font-bold text-white tracking-tight mb-2">{title}</h3>
            <p className="text-[13px] leading-relaxed text-zinc-400">{description}</p>
          </div>

          {/* capabilities */}
          <div className="flex flex-wrap gap-1.5 mt-auto pt-2 border-t border-zinc-800/60">
            {capabilities.map((cap) => (
              <span
                key={cap}
                className={[
                  'text-[10px] font-mono font-medium px-2 py-1 rounded-md border tracking-wide',
                  t.pillBg, t.pillText, t.pillBorder,
                ].join(' ')}
              >
                {cap}
              </span>
            ))}
          </div>
        </div>
      </Link>
    </motion.div>
  )
}
