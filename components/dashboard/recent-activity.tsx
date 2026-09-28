'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, XCircle, ImageIcon, Clock, ArrowRight } from 'lucide-react'
import { formatDistanceToNow, parseISO, subDays } from 'date-fns'
import { cn } from '@/lib/utils'

interface Post {
  id: string
  title: string | null
  status: string
  platform: string
  scheduled_at: string | null
  published_at: string | null
  error_message: string | null
  cada_campaigns: { name: string } | null
}

interface ActivityItem {
  id: string
  icon: React.ReactNode
  label: string
  sub: string
  time: string
  color: string
  href: string
}

function platformLabel(p: string) {
  return p?.toLowerCase().includes('tiktok') ? 'TikTok' : 'Instagram'
}

function timeAgo(dateStr: string | null) {
  if (!dateStr) return ''
  try { return formatDistanceToNow(parseISO(dateStr), { addSuffix: true }) } catch { return '' }
}

export function RecentActivity() {
  const [items, setItems] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/agents/post-queue')
      .then(r => r.json())
      .then(d => {
        const posts: Post[] = d.posts ?? []
        const cutoff = subDays(new Date(), 7)

        const activity: ActivityItem[] = []

        for (const post of posts) {
          const dateStr = post.published_at ?? post.scheduled_at
          if (!dateStr) continue
          try { if (parseISO(dateStr) < cutoff) continue } catch { continue }

          const campaign = post.cada_campaigns?.name ?? ''
          const platform = platformLabel(post.platform)
          const title = post.title ?? platform

          if (post.status === 'published') {
            activity.push({
              id: post.id,
              icon: <CheckCircle2 className="w-4 h-4" />,
              label: `Published — ${title}`,
              sub: [platform, campaign].filter(Boolean).join(' · '),
              time: timeAgo(post.published_at ?? post.scheduled_at),
              color: 'text-emerald-600 bg-emerald-50',
              href: '/history',
            })
          } else if (post.status === 'failed') {
            activity.push({
              id: post.id,
              icon: <XCircle className="w-4 h-4" />,
              label: `Failed — ${title}`,
              sub: post.error_message ?? [platform, campaign].filter(Boolean).join(' · '),
              time: timeAgo(post.scheduled_at),
              color: 'text-red-600 bg-red-50',
              href: '/posts',
            })
          } else if (post.status === 'image_review') {
            activity.push({
              id: post.id,
              icon: <ImageIcon className="w-4 h-4" />,
              label: `Image ready to review — ${title}`,
              sub: [platform, campaign].filter(Boolean).join(' · '),
              time: timeAgo(post.scheduled_at),
              color: 'text-violet-600 bg-violet-50',
              href: '/posts',
            })
          } else if (post.status === 'pending_approval') {
            activity.push({
              id: post.id,
              icon: <Clock className="w-4 h-4" />,
              label: `Awaiting approval — ${title}`,
              sub: [platform, campaign].filter(Boolean).join(' · '),
              time: timeAgo(post.scheduled_at),
              color: 'text-amber-600 bg-amber-50',
              href: '/posts',
            })
          }
        }

        // Sort newest first, cap at 8
        activity.sort((a, b) => {
          const pa = posts.find(p => p.id === a.id)
          const pb = posts.find(p => p.id === b.id)
          const da = pa?.published_at ?? pa?.scheduled_at ?? ''
          const db = pb?.published_at ?? pb?.scheduled_at ?? ''
          return db.localeCompare(da)
        })

        setItems(activity.slice(0, 8))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading || items.length === 0) return null

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-zinc-900">Latest updates</h2>
        <Link href="/history" className="text-xs text-zinc-400 hover:text-zinc-700 flex items-center gap-1 transition-colors">
          View all <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="bg-white rounded-2xl border border-zinc-100 divide-y divide-zinc-50">
        {items.map(item => (
          <Link key={item.id} href={item.href}
            className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 transition-colors first:rounded-t-2xl last:rounded-b-2xl">
            <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0', item.color)}>
              {item.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-800 truncate">{item.label}</p>
              <p className="text-xs text-zinc-400 truncate">{item.sub}</p>
            </div>
            <span className="text-xs text-zinc-400 whitespace-nowrap flex-shrink-0">{item.time}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
