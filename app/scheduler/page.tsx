'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Clock, Trash2, CheckCircle2, XCircle, RefreshCw, CalendarClock, Play, Zap } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface ScheduledPost {
  id: string
  platform: 'instagram' | 'tiktok'
  media_url: string
  media_type: 'IMAGE' | 'REELS'
  caption: string
  scheduled_at: string
  status: 'pending' | 'published' | 'failed'
  post_id: string | null
  error_message: string | null
  created_at: string
  published_at: string | null
}

function PlatformBadge({ platform }: { platform: string }) {
  if (platform === 'instagram') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-violet-100 to-pink-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700">
        <span className="text-[10px] font-bold bg-gradient-to-r from-violet-600 to-pink-600 text-transparent bg-clip-text">IG</span>
        Instagram
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-700">
      <span className="text-[10px] font-bold">TT</span>
      TikTok
    </span>
  )
}

function StatusBadge({ status }: { status: ScheduledPost['status'] }) {
  if (status === 'published') return (
    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1">
      <CheckCircle2 className="w-3 h-3" /> Published
    </Badge>
  )
  if (status === 'failed') return (
    <Badge className="bg-red-100 text-red-700 border-red-200 gap-1">
      <XCircle className="w-3 h-3" /> Failed
    </Badge>
  )
  return (
    <Badge className="bg-amber-100 text-amber-700 border-amber-200 gap-1">
      <Clock className="w-3 h-3" /> Scheduled
    </Badge>
  )
}

export default function SchedulerPage() {
  const [posts, setPosts] = useState<ScheduledPost[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState<string | null>(null)
  const [publishingId, setPublishingId] = useState<string | null>(null)

  const fetchPosts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/scheduled-posts')
      const data = await res.json()
      setPosts(data.posts ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchPosts() }, [fetchPosts])

  async function deletePost(id: string) {
    setDeleting(id)
    await fetch(`/api/scheduled-posts/${id}`, { method: 'DELETE' })
    setPosts(p => p.filter(x => x.id !== id))
    setDeleting(null)
  }

  async function runScheduler() {
    setRunning(true)
    setRunResult(null)
    const res = await fetch('/api/scheduled/publish-posts?force=true')
    const data = await res.json()
    if (data.published === 0) {
      setRunResult('No pending posts to publish.')
    } else {
      setRunResult(`Published ${data.published} post${data.published !== 1 ? 's' : ''} successfully!`)
    }
    setRunning(false)
    fetchPosts()
  }

  async function publishNow(id: string) {
    setPublishingId(id)
    const res = await fetch(`/api/scheduled/publish-posts?post_id=${id}`)
    const data = await res.json()
    if (data.results?.[0]?.ok) {
      setRunResult('Post published successfully!')
    } else {
      setRunResult(`Failed: ${data.results?.[0]?.error ?? 'Unknown error'}`)
    }
    setPublishingId(null)
    fetchPosts()
  }

  const pending = posts.filter(p => p.status === 'pending')
  const done = posts.filter(p => p.status !== 'pending')

  return (
    <div className="space-y-6">
      <div className="max-w-3xl space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-200">
              <CalendarClock className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-zinc-900">Post Scheduler</h1>
              <p className="text-sm text-zinc-500">Publishes at 9am, 12pm, 3pm, 6pm, or 9pm WIB</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={fetchPosts} disabled={loading} className="gap-2">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button size="sm" onClick={runScheduler} disabled={running} className="gap-2">
              <Zap className="w-3.5 h-3.5" />
              {running ? 'Running…' : 'Run Scheduler Now'}
            </Button>
          </div>
        </div>

        {runResult && (
          <div className={`rounded-xl px-4 py-3 text-sm font-medium ${runResult.includes('Failed') || runResult.includes('No pending') ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
            {runResult}
          </div>
        )}

        {/* Pending queue */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              Upcoming ({pending.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-zinc-400 text-center py-6">Loading…</p>
            ) : pending.length === 0 ? (
              <p className="text-sm text-zinc-400 text-center py-6">No scheduled posts. Use the Content Creator to schedule one.</p>
            ) : (
              <div className="space-y-3">
                {pending.map(post => (
                  <motion.div
                    key={post.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-3 rounded-xl border border-zinc-100 bg-zinc-50 p-3"
                  >
                    {/* Thumbnail */}
                    {post.media_type === 'IMAGE' ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={post.media_url} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0 border border-zinc-200" />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-zinc-200 shrink-0 flex items-center justify-center text-zinc-400 text-xs font-medium border border-zinc-200">
                        VIDEO
                      </div>
                    )}

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <PlatformBadge platform={post.platform} />
                        <StatusBadge status={post.status} />
                      </div>
                      <p className="text-xs text-zinc-500 font-medium">
                        {new Date(post.scheduled_at).toLocaleString(undefined, {
                          weekday: 'short', month: 'short', day: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                      {post.caption && (
                        <p className="text-xs text-zinc-600 line-clamp-2">{post.caption}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => publishNow(post.id)}
                        disabled={publishingId === post.id}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
                        title="Publish now"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deletePost(post.id)}
                        disabled={deleting === post.id}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Cancel"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* History */}
        {done.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                History ({done.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {done.map(post => (
                  <div
                    key={post.id}
                    className="flex items-start gap-3 rounded-xl border border-zinc-100 p-3 opacity-70"
                  >
                    {post.media_type === 'IMAGE' ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={post.media_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0 border border-zinc-200" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-zinc-200 shrink-0 flex items-center justify-center text-zinc-400 text-xs border border-zinc-200">
                        VIDEO
                      </div>
                    )}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <PlatformBadge platform={post.platform} />
                        <StatusBadge status={post.status} />
                      </div>
                      <p className="text-xs text-zinc-400">
                        Scheduled: {new Date(post.scheduled_at).toLocaleString()}
                      </p>
                      {post.published_at && (
                        <p className="text-xs text-emerald-600">
                          Published: {new Date(post.published_at).toLocaleString()}
                        </p>
                      )}
                      {post.error_message && (
                        <p className="text-xs text-red-500">{post.error_message}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
