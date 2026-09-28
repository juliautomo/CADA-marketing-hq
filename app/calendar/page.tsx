'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronLeft, ChevronRight, Loader2, AlertCircle, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isSameDay, parseISO, setHours, setMinutes, setSeconds } from 'date-fns'

interface Post {
  id: string
  title: string | null
  caption: string
  platform: string
  scheduled_at: string
  status: string
  media_url: string | null
  campaign_id: string | null
  error_message: string | null
  cada_campaigns: { name: string } | null
}

const CAMPAIGN_PALETTE = [
  'bg-violet-500 text-white',
  'bg-sky-500 text-white',
  'bg-emerald-500 text-white',
  'bg-amber-500 text-white',
  'bg-rose-500 text-white',
  'bg-indigo-500 text-white',
  'bg-teal-500 text-white',
  'bg-orange-500 text-white',
]
const NO_CAMPAIGN_COLOR = 'bg-zinc-400 text-white'

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
  const [dragPostId, setDragPostId] = useState<string | null>(null)
  const [dragOverDay, setDragOverDay] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const dragCounter = useRef<Record<string, number>>({})

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

  async function handleDelete(id: string) {
    setDeleting(true)
    try {
      const res = await fetch('/api/agents/post-queue', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        alert(json.error ?? 'Failed to delete post')
        return
      }
      setPosts(prev => prev.filter(p => p.id !== id))
      setSelected(null)
    } finally {
      setDeleting(false)
    }
  }

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

  // Build stable campaign → color index from all loaded posts
  const campaignColorMap: Record<string, string> = {}
  let colorIdx = 0
  for (const p of posts) {
    if (p.campaign_id && !(p.campaign_id in campaignColorMap)) {
      campaignColorMap[p.campaign_id] = CAMPAIGN_PALETTE[colorIdx % CAMPAIGN_PALETTE.length]
      colorIdx++
    }
  }
  const chipColor = (post: Post) =>
    post.campaign_id ? (campaignColorMap[post.campaign_id] ?? NO_CAMPAIGN_COLOR) : NO_CAMPAIGN_COLOR

  // Unique campaigns for legend
  const campaignLegend = posts.reduce<{ id: string; name: string; color: string }[]>((acc, p) => {
    if (p.campaign_id && !acc.find(c => c.id === p.campaign_id)) {
      acc.push({ id: p.campaign_id, name: p.cada_campaigns?.name ?? 'Campaign', color: campaignColorMap[p.campaign_id] })
    }
    return acc
  }, [])

  const platformLabel = (platform: string) => {
    const p = platform?.toLowerCase()
    if (p?.includes('tiktok')) return 'TikTok'
    return 'Instagram'
  }

  const canReschedule = (status: string) =>
    ['draft', 'pending_approval', 'approved', 'pending', 'failed'].includes(status)

  async function handleDrop(targetDay: Date) {
    if (!dragPostId) return
    const post = posts.find(p => p.id === dragPostId)
    if (!post || !post.scheduled_at) return
    const orig = parseISO(post.scheduled_at)
    // Keep original time, change date
    const newDate = setSeconds(setMinutes(setHours(targetDay, orig.getHours()), orig.getMinutes()), orig.getSeconds())
    if (isSameDay(newDate, orig)) return // dropped on same day

    setSaving(true)
    try {
      await fetch('/api/agents/post-queue', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: dragPostId, action: 'edit', scheduled_at: newDate.toISOString() }),
      })
      setPosts(prev => prev.map(p =>
        p.id === dragPostId ? { ...p, scheduled_at: newDate.toISOString() } : p
      ))
      if (selected?.id === dragPostId) {
        setSelected(s => s ? { ...s, scheduled_at: newDate.toISOString() } : s)
      }
    } finally {
      setSaving(false)
      setDragPostId(null)
      setDragOverDay(null)
      dragCounter.current = {}
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Content Calendar</h1>
          <p className="text-sm text-zinc-500 mt-1">Drag posts to reschedule · click to view details</p>
        </div>
        <div className="flex items-center gap-2">
          {campaignLegend.length > 0 && (
            <div className="hidden sm:flex items-center gap-3 mr-4 text-xs text-zinc-500 flex-wrap max-w-xs justify-end">
              {campaignLegend.map(c => (
                <span key={c.id} className="flex items-center gap-1 whitespace-nowrap">
                  <span className={cn('w-2.5 h-2.5 rounded-sm inline-block', c.color.split(' ')[0])} />
                  {c.name}
                </span>
              ))}
            </div>
          )}
          {saving && <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />}
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
              const dayKey = d.toISOString()
              const isDragTarget = dragOverDay === dayKey && dragPostId !== null

              return (
                <div key={dayKey}
                  className={cn(
                    'min-h-[100px] p-2 space-y-1 border-b border-zinc-100 transition-colors',
                    !isCurrentMonth && 'bg-zinc-50/50',
                    isLastRow && 'border-b-0',
                    isDragTarget && 'bg-violet-50 ring-1 ring-inset ring-violet-200',
                  )}
                  onDragOver={e => { e.preventDefault() }}
                  onDragEnter={e => {
                    e.preventDefault()
                    dragCounter.current[dayKey] = (dragCounter.current[dayKey] ?? 0) + 1
                    setDragOverDay(dayKey)
                  }}
                  onDragLeave={() => {
                    dragCounter.current[dayKey] = (dragCounter.current[dayKey] ?? 1) - 1
                    if ((dragCounter.current[dayKey] ?? 0) <= 0) {
                      setDragOverDay(prev => prev === dayKey ? null : prev)
                    }
                  }}
                  onDrop={e => { e.preventDefault(); handleDrop(d) }}
                >
                  <p className={cn(
                    'text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full',
                    isToday ? 'bg-zinc-900 text-white' : isCurrentMonth ? 'text-zinc-700' : 'text-zinc-300'
                  )}>
                    {format(d, 'd')}
                  </p>
                  {dayPosts.map(post => {
                    const draggable = canReschedule(post.status)
                    return (
                      <div
                        key={post.id}
                        draggable={draggable}
                        onDragStart={e => {
                          if (!draggable) { e.preventDefault(); return }
                          setDragPostId(post.id)
                          e.dataTransfer.effectAllowed = 'move'
                        }}
                        onDragEnd={() => {
                          setDragPostId(null)
                          setDragOverDay(null)
                          dragCounter.current = {}
                        }}
                        onClick={() => setSelected(post)}
                        className={cn(
                          'w-full text-left rounded-md px-1.5 py-1 text-[10px] font-medium transition-opacity',
                          chipColor(post),
                          draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
                          dragPostId === post.id && 'opacity-40',
                          'hover:opacity-80',
                        )}
                      >
                        <span className="flex items-center gap-1">
                          <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', STATUS_DOT[post.status] ?? 'bg-zinc-300')} />
                          <span className="truncate">{post.title ?? platformLabel(post.platform)}</span>
                        </span>
                        {post.cada_campaigns?.name && (
                          <span className="text-[9px] opacity-60 pl-2.5 truncate block">{post.cada_campaigns.name}</span>
                        )}
                        <span className="text-[9px] opacity-70 pl-2.5 flex items-center gap-1.5">
                          {post.scheduled_at ? format(parseISO(post.scheduled_at), 'h:mm a') : ''}
                          <span className="opacity-60">·</span>
                          {STATUS_LABELS[post.status] ?? post.status}
                        </span>
                      </div>
                    )
                  })}
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
            <div className={cn('px-5 py-4', selected.status === 'failed' ? 'bg-red-600' : chipColor(selected).replace(' text-white', ''))}>
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
              {/* Failed error */}
              {selected.status === 'failed' && selected.error_message && (
                <div className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-xl p-3">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-red-700 mb-0.5">Publish failed</p>
                    <p className="text-xs text-red-600">{selected.error_message}</p>
                  </div>
                </div>
              )}

              {selected.media_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selected.media_url} alt="" className="w-full rounded-xl object-cover" />
              )}
              <div>
                <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide mb-1">Caption</p>
                <p className="text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed">{selected.caption}</p>
              </div>
            </div>

            <div className="border-t border-zinc-100 px-5 py-3 flex items-center justify-between">
              <button
                onClick={() => handleDelete(selected.id)}
                disabled={deleting}
                className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
              >
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Delete
              </button>
              <button onClick={() => setSelected(null)}
                className="text-sm text-zinc-500 hover:text-zinc-800 transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {!loading && posts.length === 0 && (
        <div className="text-center py-20 text-zinc-400">
          <p className="text-sm">No posts scheduled yet — run a content plan to get started.</p>
        </div>
      )}
    </div>
  )
}
