'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle, XCircle, Edit2, CalendarClock, ImageIcon,
  Send, RotateCcw, Clock, Play, Trash2, RefreshCw, Zap,
  ChevronDown, CheckCircle2, Circle, AlertCircle, Loader2, Copy, Check, History, ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface QueuedPost {
  id: string
  title: string | null
  caption: string
  image_concept: string | null
  platform: string
  scheduled_at: string
  status: string
  media_url: string | null
  media_type: string | null
  error_message: string | null
}

interface PlanStep {
  step: number
  status: 'pending' | 'running' | 'done' | 'skipped' | 'error'
  label: string
  data?: Record<string, unknown>
}

interface ContentDay {
  day: number
  date: string
  platform: string
  caption: string
  contentType: string
  hook: string
  imagePrompt?: string
  cta?: string
}

interface HistoryPost {
  id: string
  title: string | null
  caption: string
  platform: string
  scheduled_at: string
  status: string
  image_concept: string | null
  media_url: string | null
}

interface TrendReport {
  id: string
  title: string
  summary: string
  colors: string[]
  styles: string[]
  trending_hashtags: { tag: string; platform: string; description: string }[]
  trending_creators: { handle: string; platform: string; followers: string; reason: string; url: string }[]
  trending_content: { format: string; idea: string; why: string }[]
  created_at: string
}

interface PlanHistory {
  id: string
  name: string
  description: string | null
  start_date: string
  end_date: string | null
  created_at: string
  google_drive_url: string | null
  posts: HistoryPost[]
}

interface PlanSummary {
  campaignId?: string
  campaignName: string
  theme: string
  startDate: string
  contentDays: ContentDay[]
  calendar: boolean
  drive: boolean
  driveUrl: string
}

const STATUS_COLORS: Record<string, string> = {
  draft:            'bg-amber-50 text-amber-700 border-amber-200',
  pending_approval: 'bg-amber-50 text-amber-700 border-amber-200',
  generating:       'bg-blue-50 text-blue-700 border-blue-200',
  image_review:     'bg-violet-50 text-violet-700 border-violet-200',
  approved:         'bg-emerald-50 text-emerald-700 border-emerald-200',
  pending:          'bg-emerald-50 text-emerald-700 border-emerald-200',
  published:        'bg-zinc-100 text-zinc-500 border-zinc-200',
  failed:           'bg-red-50 text-red-700 border-red-200',
}

const STATUS_LABELS: Record<string, string> = {
  pending_approval: 'Review content',
  generating:       'Generating image…',
  image_review:     'Review image',
  approved:         'Scheduled',
  pending:          'Scheduled',
  published:        'Published',
  failed:           'Failed',
  draft:            'Draft',
}

const STEP_DEFS = [
  { n: 1, label: 'Parse content plan',     icon: '📋' },
  { n: 2, label: 'Research trends',        icon: '📈' },
  { n: 3, label: 'Generate content',        icon: '📱' },
  { n: 4, label: 'Save to post queue',     icon: '💾' },
  { n: 5, label: 'Google Calendar',        icon: '📅' },
  { n: 6, label: 'Google Drive export',    icon: '📂' },
]

const EXAMPLES = [
  'Post about our new linen collection starting next Monday',
  'Plan 7 days of content for our mid-year sale next week',
  'Promote our hero product across Instagram and TikTok starting October 1st',
]

// ─── Main page ────────────────────────────────────────────────────────────────

function PostsPageInner() {
  const searchParams = useSearchParams()

  // Queue state
  const [posts, setPosts]               = useState<QueuedPost[]>([])
  const [loading, setLoading]           = useState(true)
  const [editingId, setEditingId]       = useState<string | null>(null)
  const [editCaption, setEditCaption]   = useState('')
  const [editConcept, setEditConcept]   = useState('')
  const [editDate, setEditDate]         = useState('')
  const [saving, setSaving]             = useState<string | null>(null)
  const [generatingId, setGeneratingId] = useState<string | null>(null)
  const [runResult, setRunResult]       = useState<string | null>(null)
  const [running, setRunning]           = useState(false)
  const [publishingId, setPublishingId] = useState<string | null>(null)

  // Planner state
  const [planOpen, setPlanOpen]   = useState(!searchParams.get('topic'))
  const [prompt, setPrompt]       = useState(searchParams.get('topic') ?? '')
  const [startDate, setStartDate] = useState(searchParams.get('startDate') ?? '')
  const [weeks, setWeeks]         = useState('1')
  const [postsPerWeek, setPostsPerWeek] = useState('7')
  const [planning, setPlanning]   = useState(false)
  const [planSteps, setPlanSteps] = useState<PlanStep[]>([])
  const [planSummary, setPlanSummary] = useState<PlanSummary | null>(null)
  const [planError, setPlanError] = useState<string | null>(null)
  const [planDone, setPlanDone]   = useState(false)
  const [copied, setCopied]       = useState<number | null>(null)
  const [summaryPosts, setSummaryPosts] = useState<QueuedPost[]>([])
  const [approvingId, setApprovingId]   = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Past plans
  const [plans, setPlans]           = useState<PlanHistory[]>([])
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null)

  // Trend research
  const [trendReports, setTrendReports] = useState<TrendReport[]>([])
  const [trendFocus, setTrendFocus]     = useState('')
  const [trendRunning, setTrendRunning] = useState(false)
  const [trendError, setTrendError]     = useState<string | null>(null)
  const [expandedReport, setExpandedReport] = useState<string | null>(null)

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

  const loadTrendReports = useCallback(async () => {
    const res = await fetch('/api/agents/trend/reports')
    const data = await res.json()
    setTrendReports(data.reports ?? [])
  }, [])

  useEffect(() => {
    loadPosts()
    fetch('/api/agents/plan-history')
      .then(r => r.json())
      .then(d => setPlans(d.plans ?? []))
      .catch(() => {})
    loadTrendReports()
  }, [loadPosts, loadTrendReports])

  async function runTrendResearch() {
    if (trendRunning) return
    setTrendRunning(true)
    setTrendError(null)
    try {
      const res = await fetch('/api/agents/trend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ focus: trendFocus.trim() || undefined }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error ?? 'Trend research failed')
      await loadTrendReports()
      setExpandedReport(data.report?.id ?? null)
      setTrendFocus('')
    } catch (e) {
      setTrendError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setTrendRunning(false)
    }
  }

  // ── Queue actions ──────────────────────────────────────────────────────────

  async function handleAction(id: string, action: 'approve' | 'reject' | 'schedule') {
    if (action === 'approve') {
      // Step 1: approve content → triggers image generation → lands in image_review
      setGeneratingId(id)
      try {
        await fetch('/api/agents/post-queue/approve-and-generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        })
        await loadPosts()
        setTimeout(() => loadPosts(), 2000)
      } finally { setGeneratingId(null) }
      return
    }
    if (action === 'schedule') {
      // Step 2: approve image → schedule post
      setSaving(id)
      try {
        await fetch('/api/agents/post-queue', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, action: 'approve' }),
        })
        await loadPosts()
      } finally { setSaving(null) }
      return
    }
    setSaving(id)
    try {
      await fetch('/api/agents/post-queue', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      })
      await loadPosts()
    } finally { setSaving(null) }
  }

  async function handleDelete(id: string) {
    setSaving(id)
    try {
      await fetch('/api/agents/post-queue', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      await loadPosts()
    } finally { setSaving(null) }
  }

  async function publishNow(id: string) {
    setPublishingId(id); setRunResult(null)
    try {
      const res = await fetch(`/api/scheduled/publish-posts?post_id=${id}`)
      const data = await res.json()
      setRunResult(data.results?.[0]?.ok ? 'Post published!' : `Failed: ${data.results?.[0]?.error ?? 'Unknown error'}`)
      await loadPosts()
    } finally { setPublishingId(null) }
  }

  async function runScheduler() {
    setRunning(true); setRunResult(null)
    try {
      const res = await fetch('/api/scheduled/publish-posts?force=true')
      const data = await res.json()
      setRunResult(data.published === 0 ? 'No pending posts to publish.' : `Published ${data.published} post${data.published !== 1 ? 's' : ''}!`)
      await loadPosts()
    } finally { setRunning(false) }
  }

  function startEdit(post: QueuedPost) {
    setEditingId(post.id)
    setEditCaption(post.caption)
    setEditConcept(post.image_concept ?? '')
    setEditDate(post.scheduled_at ? post.scheduled_at.slice(0, 16) : '')
  }

  async function saveEdit(id: string) {
    setSaving(id)
    try {
      await fetch('/api/agents/post-queue', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'edit', caption: editCaption, image_concept: editConcept, scheduled_at: editDate ? new Date(editDate).toISOString() : undefined }),
      })
      setEditingId(null)
      await loadPosts()
    } finally { setSaving(null) }
  }

  // ── Content Planner ────────────────────────────────────────────────────────

  function updateStep(incoming: PlanStep) {
    setPlanSteps(prev => {
      const idx = prev.findIndex(s => s.step === incoming.step)
      if (idx >= 0) { const next = [...prev]; next[idx] = incoming; return next }
      return [...prev, incoming]
    })
  }

  async function handlePlan() {
    if (!prompt.trim() || planning) return
    setPlanning(true)
    setPlanSteps([])
    setPlanSummary(null)
    setPlanError(null)
    setPlanDone(false)

    try {
      const numPosts = Math.min(parseInt(weeks) * parseInt(postsPerWeek), 14)
      const res = await fetch('/api/agents/full-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, startDate: startDate || undefined, numPosts, weeks: parseInt(weeks) }),
      })
      if (!res.body) throw new Error('No stream')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))
            if (event.error) { setPlanError(event.error); break }
            updateStep(event as PlanStep)
            if (event.complete) {
              const summary = event.summary as PlanSummary
              setPlanSummary(summary)
              setPlanDone(true)
              await loadPosts()
              setTimeout(() => loadPosts(), 2000)
              setTimeout(() => loadPosts(), 5000)
              // Load posts for this campaign for inline approval
              if (summary.campaignId) {
                setTimeout(async () => {
                  const r = await fetch(`/api/agents/post-queue?campaign_id=${summary.campaignId}`)
                  const d = await r.json()
                  setSummaryPosts(d.posts ?? [])
                }, 2000)
              }
            }
          } catch { /* malformed chunk */ }
        }
      }
    } catch (e) {
      setPlanError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setPlanning(false)
    }
  }

  function copyCaption(caption: string, day: number) {
    navigator.clipboard.writeText(caption)
    setCopied(day)
    setTimeout(() => setCopied(null), 2000)
  }

  function resetPlanner() {
    setPlanSteps([]); setPlanSummary(null); setPlanError(null); setPlanDone(false); setPrompt(''); setStartDate(''); setWeeks('1'); setPostsPerWeek('7'); setSummaryPosts([])
  }

  const contentReviewPosts = posts.filter(p => ['draft', 'pending_approval'].includes(p.status))
  const generatingPosts    = posts.filter(p => p.status === 'generating')
  const imageReviewPosts   = posts.filter(p => p.status === 'image_review')
  const scheduledPosts     = posts.filter(p => ['approved', 'pending'].includes(p.status))
  const donePosts          = posts.filter(p => ['published', 'failed'].includes(p.status))
  const allStepsDone    = planSteps.length > 0 && planSteps.every(s => s.status === 'done' || s.status === 'skipped')
  const queueRef = useRef<HTMLElement>(null)

  return (
    <div className="max-w-6xl mx-auto">
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Content Planner</h1>
          <p className="text-sm text-zinc-500 mt-1">Plan → approve content → approve image → publish.</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={loadPosts} disabled={loading} title="Refresh" className="p-2 rounded-xl border border-zinc-200 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 transition-colors">
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
          {scheduledPosts.some(p => p.status === 'pending') && (
            <Button size="sm" onClick={runScheduler} disabled={running} className="gap-1.5">
              <Zap className="w-3.5 h-3.5" /> {running ? 'Publishing…' : 'Publish now'}
            </Button>
          )}
        </div>
      </div>

      {runResult && (
        <div className={cn('rounded-xl px-4 py-3 text-sm font-medium border', runResult.includes('Failed') || runResult.includes('No pending') ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200')}>
          {runResult}
        </div>
      )}

      {/* ── Content Planner ── */}
      <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">

        {/* Collapse toggle */}
        <button
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-zinc-50 transition-colors"
          onClick={() => { if (!planning) setPlanOpen(v => !v) }}
        >
          <span className="text-sm font-semibold text-zinc-800 flex items-center gap-2">
            <Zap className="w-4 h-4 text-violet-500" />
            {planDone ? 'Content planned ✓' : 'Plan content with AI'}
          </span>
          {!planning && (
            <ChevronDown className={cn('w-4 h-4 text-zinc-400 transition-transform', planOpen && 'rotate-180')} />
          )}
        </button>

        <AnimatePresence>
          {planOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-zinc-100"
            >
              <div className="px-5 py-5 space-y-4">

                {/* Input — hide once planning starts */}
                {!planning && !planDone && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-2">
                        What do you want to post about?
                      </label>
                      <textarea
                        ref={textareaRef}
                        value={prompt}
                        onChange={e => setPrompt(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePlan() } }}
                        rows={2}
                        placeholder='e.g. "Post about our new linen collection starting next Monday"'
                        className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none"
                      />
                    </div>

                    {/* Period & frequency */}
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs font-medium text-zinc-500 block mb-1.5">Start date</label>
                        <input
                          type="date"
                          value={startDate}
                          onChange={e => setStartDate(e.target.value)}
                          className="w-full text-sm bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-zinc-500 block mb-1.5">Duration</label>
                        <select value={weeks} onChange={e => setWeeks(e.target.value)}
                          className="w-full text-sm bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500">
                          <option value="1">1 week</option>
                          <option value="2">2 weeks</option>
                          <option value="4">4 weeks</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-zinc-500 block mb-1.5">Frequency</label>
                        <select value={postsPerWeek} onChange={e => setPostsPerWeek(e.target.value)}
                          className="w-full text-sm bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500">
                          <option value="3">3× / week</option>
                          <option value="5">5× / week</option>
                          <option value="7">Daily</option>
                        </select>
                      </div>
                    </div>

                    <Button onClick={handlePlan} disabled={!prompt.trim()} className="w-full bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700 text-white border-0">
                      <Zap className="w-4 h-4" /> Plan my content
                    </Button>
                  </>
                )}

                {/* Progress steps */}
                {(planning || planSteps.length > 0) && (
                  <div className="space-y-2">
                    {STEP_DEFS.map(def => {
                      const step = planSteps.find(s => s.step === def.n)
                      const status = step?.status ?? 'pending'
                      return (
                        <div key={def.n} className={cn('flex items-center gap-3 transition-opacity', status === 'pending' && 'opacity-40')}>
                          <div className={cn('w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs',
                            status === 'done'    && 'bg-emerald-100',
                            status === 'running' && 'bg-violet-100',
                            status === 'skipped' && 'bg-zinc-100',
                            status === 'error'   && 'bg-red-100',
                            status === 'pending' && 'bg-zinc-50',
                          )}>
                            {status === 'done'    && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                            {status === 'running' && <Loader2 className="w-3.5 h-3.5 text-violet-500 animate-spin" />}
                            {status === 'skipped' && <Circle className="w-3.5 h-3.5 text-zinc-300" />}
                            {status === 'error'   && <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
                            {status === 'pending' && <span className="text-zinc-300 font-bold">{def.n}</span>}
                          </div>
                          <p className={cn('text-sm',
                            status === 'done'    && 'text-zinc-700',
                            status === 'running' && 'text-violet-700 font-medium',
                            status === 'skipped' && 'text-zinc-400',
                            status === 'pending' && 'text-zinc-400',
                          )}>
                            {def.icon} {step?.label ?? def.label}
                          </p>
                          {status !== 'pending' && (
                            <Badge variant={status === 'done' ? 'success' : status === 'running' ? 'info' : status === 'skipped' ? 'default' : 'error'} className="ml-auto text-xs">
                              {status}
                            </Badge>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {planError && (
                  <div className="rounded-xl bg-red-50 border border-red-100 p-3">
                    <p className="text-sm text-red-700">{planError}</p>
                    <button onClick={resetPlanner} className="text-xs text-red-500 underline mt-1">Try again</button>
                  </div>
                )}

                {/* Post preview after planning */}
                {planSummary && allStepsDone && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-zinc-800">📅 {planSummary.campaignName}</p>
                      <button onClick={resetPlanner} className="text-xs text-zinc-400 hover:text-zinc-600 underline">Plan again</button>
                    </div>

                    <div className="space-y-3">
                      {planSummary.contentDays.map((day, idx) => {
                        const dateObj = new Date(day.date + 'T00:00:00')
                        const isTikTok = day.platform?.toLowerCase().includes('tiktok')
                        // Match to saved post by index (posts are inserted in order)
                        const savedPost = summaryPosts[idx]
                        const isApproved = savedPost?.status !== 'pending_approval' && savedPost?.status !== undefined
                        const isApproving = approvingId === savedPost?.id
                        return (
                          <div key={day.day} className="rounded-xl border border-zinc-200 bg-zinc-50 overflow-hidden">
                            {/* Date + platform header */}
                            <div className={cn('flex items-center gap-3 px-4 py-2.5', isTikTok ? 'bg-zinc-900' : 'bg-gradient-to-r from-violet-500 to-pink-500')}>
                              <div className="text-center min-w-[2.5rem]">
                                <p className="text-[10px] text-white/70 leading-none uppercase">{dateObj.toLocaleDateString('en-US', { weekday: 'short' })}</p>
                                <p className="text-lg font-bold text-white leading-tight">{dateObj.getDate()}</p>
                                <p className="text-[10px] text-white/70 leading-none">{dateObj.toLocaleDateString('en-US', { month: 'short' })}</p>
                              </div>
                              <div className="flex-1">
                                <p className="text-xs font-semibold text-white">{day.platform} · {day.contentType}</p>
                                {day.hook && <p className="text-xs text-white/80 mt-0.5 italic">&ldquo;{day.hook}&rdquo;</p>}
                              </div>
                              <button
                                onClick={() => copyCaption(day.caption, day.day)}
                                className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors"
                                title="Copy caption"
                              >
                                {copied === day.day ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>

                            {/* Caption */}
                            <div className="px-4 py-3 space-y-2.5">
                              <div>
                                <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide mb-1">Caption</p>
                                <p className="text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed">{day.caption}</p>
                              </div>

                              {day.imagePrompt && (
                                <div>
                                  <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide mb-1">Image prompt</p>
                                  <p className="text-xs text-zinc-500 italic">{day.imagePrompt}</p>
                                </div>
                              )}

                              {day.cta && (
                                <div className="flex items-center gap-1.5">
                                  <Send className="w-3 h-3 text-zinc-400 flex-shrink-0" />
                                  <p className="text-xs text-zinc-500">{day.cta}</p>
                                </div>
                              )}

                              {/* Inline approve button */}
                              {savedPost && (
                                <div className="pt-1">
                                  {isApproved ? (
                                    <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                                      <CheckCircle2 className="w-3.5 h-3.5" /> Content approved — image generating
                                    </div>
                                  ) : (
                                    <button
                                      disabled={isApproving}
                                      onClick={async () => {
                                        setApprovingId(savedPost.id)
                                        try {
                                          await fetch('/api/agents/post-queue/approve-and-generate', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ id: savedPost.id }),
                                          })
                                          setSummaryPosts(prev => prev.map(p => p.id === savedPost.id ? { ...p, status: 'generating' } : p))
                                          await loadPosts()
                                        } finally {
                                          setApprovingId(null)
                                        }
                                      }}
                                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium py-2.5 transition-colors disabled:opacity-60"
                                    >
                                      {isApproving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Approving…</> : <><CheckCircle className="w-3.5 h-3.5" /> Approve content</>}
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Post Queue ── */}

      {/* Step 1: Review content */}
      {contentReviewPosts.length > 0 && (
        <section ref={queueRef} className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Step 1 — Review content ({contentReviewPosts.length})</span>
          </div>
          {contentReviewPosts.map(post => (
            <PostCard key={post.id} post={post} saving={saving === post.id} editingId={editingId}
              editCaption={editCaption} editConcept={editConcept} editDate={editDate}
              setEditCaption={setEditCaption} setEditConcept={setEditConcept} setEditDate={setEditDate}
              onApprove={() => handleAction(post.id, 'approve')}
              generatingImage={generatingId === post.id}
              onRemove={() => handleDelete(post.id)}
              onEdit={() => startEdit(post)} onSaveEdit={() => saveEdit(post.id)} onCancelEdit={() => setEditingId(null)} />
          ))}
        </section>
      )}

      {/* Generating images */}
      {generatingPosts.length > 0 && (
        <section className="space-y-3">
          <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Generating images ({generatingPosts.length})</span>
          {generatingPosts.map(post => (
            <PostCard key={post.id} post={post} saving={false} editingId={editingId}
              editCaption={editCaption} editConcept={editConcept} editDate={editDate}
              setEditCaption={setEditCaption} setEditConcept={setEditConcept} setEditDate={setEditDate} />
          ))}
        </section>
      )}

      {/* Step 2: Review image */}
      {imageReviewPosts.length > 0 && (
        <section className="space-y-3">
          <span className="text-xs font-semibold text-violet-600 uppercase tracking-wider">Step 2 — Review image ({imageReviewPosts.length})</span>
          {imageReviewPosts.map(post => (
            <PostCard key={post.id} post={post} saving={saving === post.id} editingId={editingId}
              editCaption={editCaption} editConcept={editConcept} editDate={editDate}
              setEditCaption={setEditCaption} setEditConcept={setEditConcept} setEditDate={setEditDate}
              onSchedule={() => handleAction(post.id, 'schedule')}
              onReject={() => handleAction(post.id, 'reject')}
              onEdit={() => startEdit(post)} onSaveEdit={() => saveEdit(post.id)} onCancelEdit={() => setEditingId(null)} />
          ))}
        </section>
      )}

      {/* Scheduled */}
      {scheduledPosts.length > 0 && (
        <section className="space-y-3">
          <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Scheduled ({scheduledPosts.length})</span>
          {scheduledPosts.map(post => (
            <PostCard key={post.id} post={post} saving={saving === post.id} editingId={editingId}
              editCaption={editCaption} editConcept={editConcept} editDate={editDate}
              setEditCaption={setEditCaption} setEditConcept={setEditConcept} setEditDate={setEditDate}
              onEdit={() => startEdit(post)}
              onSaveEdit={() => saveEdit(post.id)} onCancelEdit={() => setEditingId(null)}
              onPublishNow={post.status === 'pending' ? () => publishNow(post.id) : undefined}
              onRemove={post.status === 'pending' ? () => handleDelete(post.id) : undefined}
              publishingNow={publishingId === post.id} />
          ))}
        </section>
      )}

      {/* Done */}
      {donePosts.length > 0 && (
        <section className="space-y-3">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Done ({donePosts.length})</span>
          {donePosts.map(post => (
            <PostCard key={post.id} post={post} saving={false} editingId={editingId}
              editCaption={editCaption} editConcept={editConcept} editDate={editDate}
              setEditCaption={setEditCaption} setEditConcept={setEditConcept} setEditDate={setEditDate}
              onRemove={post.status === 'failed' ? () => handleDelete(post.id) : undefined} />
          ))}
        </section>
      )}

      {!loading && posts.length === 0 && !planning && (
        <p className="text-center text-sm text-zinc-400 py-12">No posts yet — plan your content above to get started.</p>
      )}
      {loading && <p className="text-center text-sm text-zinc-400 py-8">Loading…</p>}

      {/* ── Past Plans ── */}
      {plans.length > 0 && (
        <section className="space-y-3 pt-2">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-zinc-400" />
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Past plans ({plans.length})</h2>
          </div>
          <div className="space-y-2">
            {plans.map(plan => {
              const isOpen = expandedPlan === plan.id
              const approved = plan.posts.filter(p => ['approved','generating','pending','published'].includes(p.status)).length
              const pending  = plan.posts.filter(p => ['draft','pending_approval'].includes(p.status)).length
              return (
                <div key={plan.id} className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
                  <button
                    onClick={() => setExpandedPlan(isOpen ? null : plan.id)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-zinc-50 transition-colors text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-zinc-800 truncate">{plan.name}</p>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        {new Date(plan.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        {plan.start_date && ` · starts ${new Date(plan.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                        {' · '}{plan.posts.length} posts
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {pending > 0 && <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">{pending} pending</span>}
                      {approved > 0 && <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5">{approved} approved</span>}
                      {plan.google_drive_url && (
                        <a href={plan.google_drive_url} target="_blank" rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="text-zinc-400 hover:text-blue-500 transition-colors">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <ChevronDown className={cn('w-4 h-4 text-zinc-400 transition-transform', isOpen && 'rotate-180')} />
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-zinc-100 divide-y divide-zinc-100">
                      {plan.posts.length === 0 && (
                        <p className="text-xs text-zinc-400 px-4 py-3">No posts saved for this plan.</p>
                      )}
                      {plan.posts.map(post => {
                        const isTikTok = post.platform?.toLowerCase().includes('tiktok')
                        const dateObj = post.scheduled_at ? new Date(post.scheduled_at) : null
                        return (
                          <div key={post.id} className="rounded-xl border border-zinc-200 bg-zinc-50 overflow-hidden mx-4 my-3">
                            {/* Header */}
                            <div className={cn('flex items-center gap-3 px-4 py-2.5', isTikTok ? 'bg-zinc-900' : 'bg-gradient-to-r from-violet-500 to-pink-500')}>
                              {dateObj && (
                                <div className="text-center min-w-[2.5rem]">
                                  <p className="text-[10px] text-white/70 leading-none uppercase">{dateObj.toLocaleDateString('en-US', { weekday: 'short' })}</p>
                                  <p className="text-lg font-bold text-white leading-tight">{dateObj.getDate()}</p>
                                  <p className="text-[10px] text-white/70 leading-none">{dateObj.toLocaleDateString('en-US', { month: 'short' })}</p>
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-white">{post.platform}</p>
                                {post.title && <p className="text-xs text-white/70 truncate">{post.title}</p>}
                              </div>
                              <span className={cn('text-xs border rounded-full px-2 py-0.5 flex-shrink-0', STATUS_COLORS[post.status] ?? 'bg-white/20 text-white border-white/30')}>
                                {STATUS_LABELS[post.status] ?? post.status}
                              </span>
                            </div>

                            <div className="flex gap-3 p-4">
                              {post.media_url && (
                                <img src={post.media_url} alt="" className="w-20 h-20 rounded-xl object-cover flex-shrink-0 border border-zinc-200" />
                              )}
                              <div className="flex-1 min-w-0 space-y-2.5">
                                <div>
                                  <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide mb-1">Caption</p>
                                  <p className="text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed">{post.caption}</p>
                                </div>
                                {post.image_concept && (
                                  <div>
                                    <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide mb-1">Image prompt</p>
                                    <p className="text-xs text-zinc-500 italic">{post.image_concept}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>

      {/* ── Right sidebar: Trend Analyst ── */}
      <div className="hidden lg:block">
        <div className="sticky top-6 bg-white rounded-2xl border border-zinc-200 overflow-hidden max-h-[calc(100vh-3rem)] flex flex-col">
          {/* Header */}
          <div className="px-5 py-4 border-b border-zinc-100 flex-shrink-0">
            <h2 className="text-sm font-semibold text-zinc-800 flex items-center gap-2">
              <span className="text-base">📈</span>
              Trend Analyst
              {trendReports.length > 0 && (
                <span className="text-xs font-normal text-zinc-400">· {trendReports.length}</span>
              )}
            </h2>
          </div>

          {/* Scrollable content */}
          <div className="overflow-y-auto flex-1">
            <div className="px-4 py-4 space-y-4">
              {/* Run new research */}
              <div className="space-y-2">
                <input
                  value={trendFocus}
                  onChange={e => setTrendFocus(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') runTrendResearch() }}
                  placeholder='e.g. "linen dresses", "quiet luxury"'
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
                <Button onClick={runTrendResearch} disabled={trendRunning} size="sm" className="w-full gap-1.5">
                  {trendRunning ? <><Loader2 className="w-3 h-3 animate-spin" /> Researching…</> : <><Zap className="w-3 h-3" /> Run Research</>}
                </Button>
                {trendError && <p className="text-xs text-red-500">{trendError}</p>}
              </div>

              {/* Saved reports */}
              {trendReports.length === 0 && !trendRunning && (
                <p className="text-xs text-zinc-400 text-center py-4">No reports yet — run research above.</p>
              )}

              <div className="space-y-2">
                {trendReports.map(report => {
                  const isOpen = expandedReport === report.id
                  return (
                    <div key={report.id} className="rounded-xl border border-zinc-200 overflow-hidden">
                      <button
                        onClick={() => setExpandedReport(isOpen ? null : report.id)}
                        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-zinc-50 transition-colors text-left"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-zinc-800 truncate">{report.title}</p>
                          <p className="text-[10px] text-zinc-400 mt-0.5">
                            {new Date(report.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        </div>
                        <ChevronDown className={cn('w-3.5 h-3.5 text-zinc-400 flex-shrink-0 transition-transform', isOpen && 'rotate-180')} />
                      </button>

                      {isOpen && (
                        <div className="border-t border-zinc-100 px-3 py-3 space-y-3">
                          {report.colors?.length > 0 && (
                            <div>
                              <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">Colors</p>
                              <div className="flex flex-wrap gap-1">
                                {report.colors.map(c => (
                                  <span key={c} className="text-[10px] bg-zinc-100 text-zinc-600 rounded-full px-2 py-0.5">{c}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {report.styles?.length > 0 && (
                            <div>
                              <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">Styles</p>
                              <div className="flex flex-wrap gap-1">
                                {report.styles.map(s => (
                                  <span key={s} className="text-[10px] bg-violet-50 text-violet-700 rounded-full px-2 py-0.5">{s}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {report.trending_hashtags?.length > 0 && (
                            <div>
                              <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">Hashtags</p>
                              <div className="flex flex-wrap gap-1">
                                {report.trending_hashtags.map(h => (
                                  <a key={h.tag}
                                    href={h.platform === 'tiktok' ? `https://www.tiktok.com/tag/${h.tag}` : `https://www.instagram.com/explore/tags/${h.tag}`}
                                    target="_blank" rel="noopener noreferrer"
                                    className="text-[10px] bg-blue-50 text-blue-600 rounded-full px-2 py-0.5 hover:bg-blue-100 transition-colors flex items-center gap-0.5">
                                    #{h.tag}
                                    <ExternalLink className="w-2 h-2" />
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                          {report.trending_content?.length > 0 && (
                            <div>
                              <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">Content Ideas</p>
                              <div className="space-y-1">
                                {report.trending_content.map((c, i) => (
                                  <div key={i} className="text-[10px] text-zinc-600 bg-zinc-50 rounded-lg px-2.5 py-1.5">
                                    <span className="font-medium text-zinc-800">{c.format}</span>
                                    {c.idea && <> — {c.idea}</>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {report.summary && (
                            <div>
                              <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">Analysis</p>
                              <p className="text-[10px] text-zinc-600 leading-relaxed">{report.summary}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
    </div>
  )
}

export default function PostsPage() {
  return (
    <Suspense>
      <PostsPageInner />
    </Suspense>
  )
}

// ─── PostCard ─────────────────────────────────────────────────────────────────

function PostCard({
  post, saving, editingId,
  editCaption, editConcept, editDate,
  setEditCaption, setEditConcept, setEditDate,
  onApprove, generatingImage, onSchedule, onReject, onRemove, onEdit, onSaveEdit, onCancelEdit, onPublishNow, publishingNow,
}: {
  post: QueuedPost
  saving: boolean
  editingId: string | null
  editCaption: string
  editConcept: string
  editDate: string
  setEditCaption: (v: string) => void
  setEditConcept: (v: string) => void
  setEditDate: (v: string) => void
  onApprove?: () => void
  generatingImage?: boolean
  onSchedule?: () => void
  onReject?: () => void
  onRemove?: () => void
  onEdit?: () => void
  onSaveEdit?: () => void
  onCancelEdit?: () => void
  onPublishNow?: () => void
  publishingNow?: boolean
}) {
  const [captionExpanded, setCaptionExpanded] = useState(false)
  const isEditing = editingId === post.id
  const statusCls = STATUS_COLORS[post.status] ?? 'bg-zinc-100 text-zinc-500 border-zinc-200'
  const statusLabel = STATUS_LABELS[post.status] ?? post.status
  const isImageReview = post.status === 'image_review'

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-zinc-800 truncate">{post.title ?? 'Untitled post'}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`inline-flex items-center gap-1 text-xs border rounded-full px-2 py-0.5 ${statusCls}`}>
              {post.status === 'generating'   && <RotateCcw className="w-3 h-3 animate-spin" />}
              {post.status === 'published'    && <CheckCircle className="w-3 h-3" />}
              {post.status === 'failed'       && <XCircle className="w-3 h-3" />}
              {post.status === 'approved'     && <CheckCircle className="w-3 h-3" />}
              {post.status === 'pending'      && <Clock className="w-3 h-3" />}
              {statusLabel}
            </span>
            <span className="text-xs text-zinc-400 flex items-center gap-1">
              <CalendarClock className="w-3 h-3" />
              {post.scheduled_at ? format(parseISO(post.scheduled_at), 'MMM d, h:mm a') : '—'}
            </span>
            <span className="text-xs text-zinc-400 capitalize">{post.platform}</span>
          </div>
        </div>
      </div>

      {/* Image shown prominently for image_review step */}
      {isImageReview && post.media_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.media_url} alt="Generated image" className="w-full rounded-xl object-cover border border-zinc-100 max-h-80" />
      )}

      {isEditing ? (
        <div className="space-y-2">
          <div>
            <label className="text-xs text-zinc-500 font-medium">Caption</label>
            <textarea value={editCaption} onChange={e => setEditCaption(e.target.value)} rows={4}
              className="w-full mt-1 text-xs text-zinc-700 bg-zinc-50 border border-zinc-200 rounded-lg p-2 resize-none focus:outline-none focus:ring-1 focus:ring-zinc-400" />
          </div>
          <div>
            <label className="text-xs text-zinc-500 font-medium flex items-center gap-1"><ImageIcon className="w-3 h-3" /> Image prompt</label>
            <textarea value={editConcept} onChange={e => setEditConcept(e.target.value)} rows={2}
              className="w-full mt-1 text-xs text-zinc-700 bg-zinc-50 border border-zinc-200 rounded-lg p-2 resize-none focus:outline-none focus:ring-1 focus:ring-zinc-400" />
          </div>
          <div>
            <label className="text-xs text-zinc-500 font-medium">Schedule date &amp; time</label>
            <input type="datetime-local" value={editDate} onChange={e => setEditDate(e.target.value)}
              className="w-full mt-1 text-xs bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-zinc-400" />
          </div>
          <div className="flex gap-2">
            <button onClick={onSaveEdit} disabled={saving}
              className="flex-1 text-xs font-medium bg-zinc-800 text-white rounded-xl py-2 hover:bg-zinc-700 disabled:opacity-40 transition-colors">Save</button>
            <button onClick={onCancelEdit}
              className="flex-1 text-xs text-zinc-500 border border-zinc-200 rounded-xl py-2 hover:bg-zinc-50 transition-colors">Cancel</button>
          </div>
        </div>
      ) : (
        <>
          <p className={cn('text-xs text-zinc-600 whitespace-pre-wrap', !captionExpanded && 'line-clamp-3')}>{post.caption}</p>
          <button onClick={() => setCaptionExpanded(v => !v)} className="text-[10px] text-zinc-400 hover:text-zinc-600 transition-colors">
            {captionExpanded ? '▲ Show less' : '▼ Show full caption'}
          </button>

          {post.image_concept && !post.media_url && (
            <p className="text-xs text-zinc-400 italic flex items-start gap-1">
              <ImageIcon className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span className="line-clamp-2">{post.image_concept}</span>
            </p>
          )}

          {/* Small thumbnail for non-image-review posts that have an image */}
          {!isImageReview && post.media_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.media_url} alt="" className="w-14 h-14 rounded-xl object-cover border border-zinc-100" />
          )}

          {post.error_message && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <XCircle className="w-3 h-3" /> {post.error_message}
            </p>
          )}

          {(onApprove || onSchedule || onReject || onRemove || onEdit || onPublishNow) && (
            <div className="flex gap-2 pt-1">
              {/* Step 1: approve content → generate image */}
              {onApprove && (
                <button onClick={onApprove} disabled={saving || generatingImage}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium bg-amber-500 text-white rounded-xl py-2 hover:bg-amber-400 disabled:opacity-40 transition-colors">
                  {generatingImage
                    ? <><Loader2 className="w-3 h-3 animate-spin" /> Generating image…</>
                    : <><CheckCircle2 className="w-3 h-3" /> Approve content</>
                  }
                </button>
              )}
              {/* Step 2: approve image → schedule */}
              {onSchedule && (
                <button onClick={onSchedule} disabled={saving}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium bg-emerald-600 text-white rounded-xl py-2 hover:bg-emerald-500 disabled:opacity-40 transition-colors">
                  <Send className="w-3 h-3" /> Approve &amp; schedule
                </button>
              )}
              {onReject && (
                <button onClick={onReject} disabled={saving}
                  className="flex items-center justify-center gap-1.5 px-3 text-xs text-red-500 border border-red-200 rounded-xl py-2 hover:bg-red-50 disabled:opacity-40 transition-colors">
                  <XCircle className="w-3 h-3" /> Reject
                </button>
              )}
              {onPublishNow && (
                <button onClick={onPublishNow} disabled={publishingNow}
                  className="flex items-center justify-center gap-1.5 px-3 text-xs text-violet-600 border border-violet-200 rounded-xl py-2 hover:bg-violet-50 disabled:opacity-40 transition-colors">
                  <Play className="w-3 h-3" /> {publishingNow ? 'Publishing…' : 'Publish now'}
                </button>
              )}
              {onEdit && (
                <button onClick={onEdit}
                  className="flex items-center justify-center gap-1.5 px-3 text-xs text-zinc-500 border border-zinc-200 rounded-xl py-2 hover:bg-zinc-50 transition-colors">
                  <Edit2 className="w-3 h-3" /> Edit
                </button>
              )}
              {onRemove && (
                <button onClick={onRemove} disabled={saving}
                  className="flex items-center justify-center gap-1.5 px-3 text-xs text-zinc-400 hover:text-red-500 border border-zinc-200 rounded-xl py-2 hover:bg-red-50 transition-colors">
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
