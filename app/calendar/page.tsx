'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isSameDay, parseISO } from 'date-fns'

interface Post {
  id: string
  title: string | null
  caption: string
  platform: string
  scheduled_at: string
  status: string
  media_url: string | null
  campaign_id: string | null
}

const PLATFORM_COLORS: Record<string, string> = {
  tiktok:    'bg-zinc-900 text-white',
  instagram: 'bg-gradient-to-r from-violet-500 to-pink-500 text-white',
}

const STATUS_DOT: Record<string, string> = {
  pending_approval: 'bg-amber-400',
  generating:       'bg-blue-400',
  image_review:     'bg-violet-400',
  approved:         'bg-emerald-400',
  pending:          'bg-emerald-400',
  published:        'bg-zinc-400',
  failed:           'bg-red-400',
}

const STATUS_LABELS: Record<string, string> = {
  pending_approval: 'Awaiting approval',
  generating:       'Generating image',
  image_review:     'Review image',
  approved:         'Scheduled',
  pending:          'Scheduled',
  published:        'Published',
  failed:           'Failed',
}

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Post | null>(null)

  const loadPosts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/agents/post-queue')
      const data = await res.json()
      setPosts(data.posts ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadPosts() }, [loadPosts])

  // Build calendar grid
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const days: Date[] = []
  let day = gridStart
  while (day <= gridEnd) {
    days.push(day)
    day = addDays(day, 1)
  }

  const postsByDay = (d: Date) =>
    posts.filter(p => p.scheduled_at && isSameDay(parseISO(p.scheduled_at), d))

  const platformLabel = (platform: string) => {
    const p = platform?.toLowerCase()
    if (p?.includes('tiktok')) return 'TikTok'
    return 'Instagram'
  }

  const platformKey = (platform: string) =>
    platform?.toLowerCase().includes('tiktok') ? 'tiktok' : 'instagram'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Content Calendar</h1>
          <p className="text-sm text-zinc-500 mt-1">All scheduled posts across every campaign</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Legend */}
          <div className="hidden sm:flex items-center gap-3 mr-4 text-xs text-zinc-500">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-zinc-900 inline-block" /> TikTok</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-violet-500 inline-block" /> Instagram</span>
          </div>
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-2 rounded-xl hover:bg-zinc-100 transition-colors">
            <ChevronLeft className="w-4 h-4 text-zinc-600" />
          </button>
          <span className="text-sm font-semibold text-zinc-800 min-w-[120px] text-center">
            {format(currentMonth, 'MMMM yyyy')}
          </span>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-2 rounded-xl hover:bg-zinc-100 transition-colors">
            <ChevronRight className="w-4 h-4 text-zinc-600" />
          </button>
          <button onClick={() => setCurrentMonth(new Date())}
            className="ml-1 text-xs text-zinc-500 hover:text-zinc-800 border border-zinc-200 rounded-lg px-3 py-1.5 transition-colors">
            Today
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-6 h-6 animate-spin text-zinc-300" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-zinc-100">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
              <div key={d} className="text-center text-xs font-semibold text-zinc-400 py-3">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 divide-x divide-zinc-100">
            {days.map((d, i) => {
              const dayPosts = postsByDay(d)
              const isToday = isSameDay(d, new Date())
              const isCurrentMonth = isSameMonth(d, currentMonth)
              const isLastRow = i >= days.length - 7
              return (
                <div key={d.toISOString()}
                  className={cn(
                    'min-h-[100px] p-2 space-y-1 border-b border-zinc-100',
                    !isCurrentMonth && 'bg-zinc-50/50',
                    isLastRow && 'border-b-0'
                  )}>
                  <p className={cn(
                    'text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full',
                    isToday ? 'bg-zinc-900 text-white' : isCurrentMonth ? 'text-zinc-700' : 'text-zinc-300'
                  )}>
                    {format(d, 'd')}
                  </p>
                  {dayPosts.map(post => (
                    <button
                      key={post.id}
                      onClick={() => setSelected(post)}
                      className={cn(
                        'w-full text-left rounded-md px-1.5 py-1 text-[10px] font-medium truncate transition-opacity hover:opacity-80',
                        PLATFORM_COLORS[platformKey(post.platform)] ?? 'bg-zinc-200 text-zinc-700'
                      )}
                    >
                      <span className="flex items-center gap-1">
                        <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', STATUS_DOT[post.status] ?? 'bg-zinc-300')} />
                        <span className="truncate">{post.title ?? platformLabel(post.platform)}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Post detail drawer */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
          <div
            className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className={cn('px-5 py-4', PLATFORM_COLORS[platformKey(selected.platform)] ?? 'bg-zinc-800')}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-white/70 font-medium">{platformLabel(selected.platform)}</p>
                  <p className="text-white font-semibold">{selected.title ?? platformLabel(selected.platform)}</p>
                  <p className="text-xs text-white/70 mt-0.5">
                    {selected.scheduled_at ? format(parseISO(selected.scheduled_at), 'EEE, MMM d · h:mm a') : ''}
                  </p>
                </div>
                <span className={cn('text-[10px] bg-white/20 text-white rounded-full px-2 py-0.5 flex items-center gap-1')}>
                  <span className={cn('w-1.5 h-1.5 rounded-full', STATUS_DOT[selected.status] ?? 'bg-white')} />
                  {STATUS_LABELS[selected.status] ?? selected.status}
                </span>
              </div>
            </div>

            <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
              {selected.media_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selected.media_url} alt="" className="w-full rounded-xl object-cover" />
              )}
              <div>
                <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide mb-1">Caption</p>
                <p className="text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed">{selected.caption}</p>
              </div>
            </div>

            <div className="border-t border-zinc-100 px-5 py-3 flex justify-end">
              <button onClick={() => setSelected(null)}
                className="text-sm text-zinc-500 hover:text-zinc-800 transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && posts.length === 0 && (
        <div className="text-center py-20 text-zinc-400">
          <p className="text-sm">No posts scheduled yet — run a content plan to get started.</p>
        </div>
      )}
    </div>
  )
}
