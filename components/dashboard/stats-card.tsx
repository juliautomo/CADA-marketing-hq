'use client'

import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Image, FileText, TrendingUp, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'

const iconMap = { Image, FileText, TrendingUp, Layers } as const
export type StatsIconName = keyof typeof iconMap

interface StatsCardProps {
  label: string
  value: string | number
  sub?: string
  iconName: StatsIconName
  color: string
  index?: number
}

export function StatsCard({ label, value, sub, iconName, color, index = 0 }: StatsCardProps) {
  const Icon = iconMap[iconName]

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.07 }}
    >
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-500">{label}</p>
            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', color)}>
              <Icon className="w-4 h-4 text-white" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-zinc-900">{value}</p>
          {sub && <p className="mt-1 text-xs text-zinc-400">{sub}</p>}
        </CardContent>
      </Card>
    </motion.div>
  )
}
