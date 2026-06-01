'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Sparkles, TrendingUp, CalendarDays, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'

// Map string icon names to components — avoids passing functions from Server → Client
const iconMap = {
  Sparkles,
  TrendingUp,
  CalendarDays,
  BarChart3,
} as const

export type AgentIconName = keyof typeof iconMap

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
    >
      <Link href={href}>
        <Card className="group hover:shadow-md transition-all duration-200 cursor-pointer hover:-translate-y-0.5">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between mb-4">
              <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center', color)}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <Badge variant="info" className="text-xs">AI Agent</Badge>
            </div>
            <h3 className="font-semibold text-zinc-900 mb-1.5">{title}</h3>
            <p className="text-sm text-zinc-500 mb-4 leading-relaxed">{description}</p>
            <div className="flex flex-wrap gap-1.5">
              {capabilities.map((cap) => (
                <span key={cap} className="text-xs bg-zinc-50 text-zinc-600 px-2 py-1 rounded-md border border-zinc-100">
                  {cap}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  )
}
