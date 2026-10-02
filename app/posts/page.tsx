'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle, XCircle, Edit2, CalendarClock, ImageIcon,
  Send, RotateCcw, Clock, Play, Trash2, RefreshCw, Zap,
  ChevronDown, CheckCircle2, Circle, AlertCircle, Loader2, History, ExternalLink, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ImageRevision {
  id: string
  media_url: string
  media_urls: string[] | null
  image_model: string | null
  prompt_used: string | null
  correction_note: string | null
  created_at: string
}

interface QueuedPost {
  id: string
  title: string | null
  caption: string
  image_concept: string | null
  image_prompt_used: string | null
  platform: string
  scheduled_at: string
  status: string
  media_url: string | null
  media_urls: string[] | null
  media_type: string | null
  error_message: string | null
  campaign_id: string | null
  image_model: string | null
  prompt_model: string | null
  cada_campaigns?: { name: string; created_at: string } | null
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
  image_prompt_used: string | null
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

interface CampaignBrief {
  imageModel?: string
  imageSize?: string
  imageQuality?: string
  postFormat?: string
  promptModel?: string
  weeks?: number
  postsPerWeek?: number
  channels?: string[]
}

interface PlanHistory {
  id: string
  name: string
  description: string | null
  start_date: string
  end_date: string | null
  created_at: string
  google_drive_url: string | null
  brief?: CampaignBrief
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
  const [dismissedFailedCount, setDismissedFailedCount] = useState(() => {
    try { return parseInt(localStorage.getItem('dismissedFailedCount') ?? '0', 10) } catch { return 0 }
  })
  const [running, setRunning]           = useState(false)
  const [publishingId, setPublishingId] = useState<string | null>(null)
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null)

  // Planner state
  const [planOpen, setPlanOpen]   = useState(!searchParams.get('topic'))
  const [prompt, setPrompt]       = useState(searchParams.get('topic') ?? '')
  const [startDate, setStartDate] = useState(searchParams.get('startDate') ?? '')
  const [weeks, setWeeks]         = useState('1')
  const [postsPerWeek, setPostsPerWeek] = useState('7')
  const [platforms, setPlatforms] = useState<string[]>(['TikTok', 'Instagram'])
  const [planning, setPlanning]   = useState(false)
  const [planSteps, setPlanSteps] = useState<PlanStep[]>([])
  const planAbortRef = useRef<AbortController | null>(null)
  const [planSummary, setPlanSummary] = useState<PlanSummary | null>(null)
  const [planError, setPlanError] = useState<string | null>(null)
  const [planDone, setPlanDone]   = useState(false)
  const [summaryPosts, setSummaryPosts] = useState<QueuedPost[]>([])
  const [approvingId, setApprovingId]   = useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [imageModel, setImageModel]     = useState<'gpt-image-1' | 'dall-e-3' | 'gemini-nano-banana-2' | 'gemini-nano-banana-2-lite' | 'gemini-nano-banana-pro'>('gpt-image-1')
  const [promptModel, setPromptModel]   = useState<'claude' | 'gpt-4o' | 'gpt-4o-mini'>('claude')
  const [imageSize, setImageSize]       = useState<'1:1' | '4:5' | '9:16' | '16:9'>('4:5')
  const [imageQuality, setImageQuality] = useState<'low' | 'medium' | 'high'>('medium')
  const [postFormat, setPostFormat]     = useState<'auto' | 'single' | 'carousel'>('auto')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Past plans
  const [plans, setPlans]           = useState<PlanHistory[]>([])
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null)
  const [pastPlansOpen, setPastPlansOpen] = useState(false)
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set())

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

  async function handleAction(id: string, action: 'approve' | 'reject' | 'schedule' | 'unapprove') {
    if (action === 'approve') {
      // Fire-and-forget: route returns immediately after setting status=generating,
      // actual image generation runs via after() on the server.
      setGeneratingId(id)
      // Route handles generation with maxDuration=120; reload posts when it resolves
      fetch('/api/agents/post-queue/approve-and-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      }).then(async res => {
        if (!res.ok) {
          const json = await res.json().catch(() => ({}))
          console.error('approve-and-generate error:', res.status, json)
        }
        await loadPosts()
      }).catch(err => { console.error('approve-and-generate fetch failed:', err); loadPosts() })
      // Also poll every 8s in case the response comes back before we reload
      const poll = setInterval(async () => {
        await loadPosts()
        setPosts(prev => {
          const p = prev.find(x => x.id === id)
          const done = !p || ['image_review', 'failed', 'published', 'pending', 'approved'].includes(p.status)
          if (done) { clearInterval(poll); setGeneratingId(null) }
          return prev
        })
      }, 8000)
      // Safety: clear after 3 minutes
      setTimeout(() => { clearInterval(poll); setGeneratingId(null) }, 3 * 60 * 1000)
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

  async function regenerateImage(id: string, imageModel?: string, fixNote?: string) {
    setRegeneratingId(id)
    try {
      await fetch('/api/agents/post-queue/approve-and-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...(imageModel ? { imageModel } : {}), ...(fixNote ? { correctionNote: fixNote } : {}) }),
      })
      await loadPosts()
    } finally { setRegeneratingId(null) }
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

  function stopPlan() {
    planAbortRef.current?.abort()
  }

  async function handlePlan() {
    if (!prompt.trim() || planning) return
    setPlanning(true)
    setPlanSteps([])
    setPlanSummary(null)
    setPlanError(null)
    setPlanDone(false)

    const abort = new AbortController()
    planAbortRef.current = abort

    try {
      const isOneDay = weeks === '1day'
      const numPosts = isOneDay ? 1 : Math.min(parseInt(weeks) * parseInt(postsPerWeek), 14)
      const weeksNum = isOneDay ? 0 : parseInt(weeks)
      const res = await fetch('/api/agents/full-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, startDate: startDate || undefined, numPosts, weeks: weeksNum, platforms: platforms.length > 0 ? platforms : ['TikTok', 'Instagram'], imageSize, imageQuality, postFormat, imageModel, promptModel }),
        signal: abort.signal,
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
      if (e instanceof Error && e.name === 'AbortError') {
        setPlanSteps(prev => prev.map(s => s.status === 'running' ? { ...s, status: 'skipped' } : s))
      } else {
        setPlanError(e instanceof Error ? e.message : 'Something went wrong')
      }
    } finally {
      setPlanning(false)
      planAbortRef.current = null
    }
  }

  function resetPlanner() {
    setPlanSteps([]); setPlanSummary(null); setPlanError(null); setPlanDone(false); setPrompt(''); setStartDate(''); setWeeks('1'); setPostsPerWeek('7'); setPlatforms(['TikTok', 'Instagram']); setSummaryPosts([]); setShowAdvanced(false); setImageSize('4:5'); setImageQuality('medium'); setPostFormat('auto')
  }

  const contentReviewPosts = posts.filter(p => ['draft', 'pending_approval'].includes(p.status))
  const generatingPosts    = posts.filter(p => p.status === 'generating')
  const imageReviewPosts   = posts.filter(p => p.status === 'image_review')
  const scheduledPosts     = posts.filter(p => ['approved', 'pending'].includes(p.status))
  const donePosts          = posts.filter(p => ['published', 'failed'].includes(p.status))
  const failedPosts        = posts.filter(p => p.status === 'failed')
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

      {/* Failed posts alert */}
      {failedPosts.length > dismissedFailedCount && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-center gap-3">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700 flex-1">
            <span className="font-semibold">{failedPosts.length} post{failedPosts.length > 1 ? 's' : ''} failed to publish.</span>
            {' '}Check History for details.
          </p>
          <button onClick={() => { const n = failedPosts.length; setDismissedFailedCount(n); try { localStorage.setItem('dismissedFailedCount', String(n)) } catch {} }} className="text-red-400 hover:text-red-600 transition-colors flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
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
                          <option value="1day">1 day</option>
                          <option value="1">1 week</option>
                          <option value="2">2 weeks</option>
                          <option value="4">4 weeks</option>
                        </select>
                      </div>
                      {weeks !== '1day' && (
                        <div>
                          <label className="text-xs font-medium text-zinc-500 block mb-1.5">Frequency</label>
                          <select value={postsPerWeek} onChange={e => setPostsPerWeek(e.target.value)}
                            className="w-full text-sm bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500">
                            <option value="3">3× / week</option>
                            <option value="5">5× / week</option>
                            <option value="7">Daily</option>
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Platform selector */}
                    <div>
                      <label className="text-xs font-medium text-zinc-500 block mb-1.5">Platforms</label>
                      <div className="flex gap-4">
                        {['TikTok', 'Instagram'].map(p => {
                          const checked = platforms.includes(p)
                          return (
                            <label key={p} className="flex items-center gap-2 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => setPlatforms(prev =>
                                  prev.includes(p)
                                    ? prev.filter(x => x !== p).length > 0 ? prev.filter(x => x !== p) : prev
                                    : [...prev, p]
                                )}
                                className="w-4 h-4 rounded accent-violet-600 cursor-pointer"
                              />
                              <span className="text-sm text-zinc-700">{p}</span>
                            </label>
                          )
                        })}
                      </div>
                    </div>

                    {/* Advanced options */}
                    <div>
                      <button
                        type="button"
                        onClick={() => setShowAdvanced(v => !v)}
                        className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
                      >
                        <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', showAdvanced && 'rotate-180')} />
                        Advanced options
                      </button>
                      {showAdvanced && (
                        <div className="mt-3 grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-medium text-zinc-500 block mb-1.5">Image model</label>
                            <select value={imageModel} onChange={e => {
                              const m = e.target.value as typeof imageModel
                              setImageModel(m)
                              // Reset size to a valid default for the new model
                              setImageSize(m === 'dall-e-3' ? '1:1' : '4:5')
                            }}
                              className="w-full text-sm bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500">
                              <option value="gpt-image-1">GPT Image 1 (default)</option>
                              <option value="dall-e-3">DALL·E 3</option>
                              <option value="gemini-nano-banana-2">Nano Banana 2 (Gemini)</option>
                              <option value="gemini-nano-banana-2-lite">Nano Banana 2 Lite (Gemini, fastest)</option>
                              <option value="gemini-nano-banana-pro">Nano Banana Pro (Gemini, best quality)</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-zinc-500 block mb-1.5">Post size</label>
                            <select value={imageSize} onChange={e => setImageSize(e.target.value as typeof imageSize)}
                              className="w-full text-sm bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500">
                              {imageModel === 'dall-e-3' ? (
                                <>
                                  <option value="1:1">1:1 Square</option>
                                  <option value="16:9">16:9 Landscape</option>
                                  <option value="9:16">9:16 Portrait</option>
                                </>
                              ) : (
                                <>
                                  <option value="1:1">1:1 Square</option>
                                  <option value="4:5">4:5 Portrait (default)</option>
                                  <option value="9:16">9:16 Stories</option>
                                </>
                              )}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-zinc-500 block mb-1.5">Image quality</label>
                            <select value={imageQuality} onChange={e => setImageQuality(e.target.value as typeof imageQuality)}
                              className="w-full text-sm bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500">
                              {imageModel === 'dall-e-3' ? (
                                <>
                                  <option value="medium">Standard</option>
                                  <option value="high">HD (slower)</option>
                                </>
                              ) : (
                                <>
                                  <option value="low">Low (faster)</option>
                                  <option value="medium">Medium</option>
                                  <option value="high">High (slower)</option>
                                </>
                              )}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-zinc-500 block mb-1.5">Post format</label>
                            <select value={postFormat} onChange={e => setPostFormat(e.target.value as typeof postFormat)}
                              className="w-full text-sm bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500">
                              <option value="auto">Auto (AI decides)</option>
                              <option value="single">Single image</option>
                              <option value="carousel">Carousel</option>
                            </select>
                          </div>
                          <div className="col-span-2">
                            <label className="text-xs font-medium text-zinc-500 block mb-1.5">Prompt writing model</label>
                            <select value={promptModel} onChange={e => setPromptModel(e.target.value as typeof promptModel)}
                              className="w-full text-sm bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500">
                              <option value="claude">Claude (default)</option>
                              <option value="gpt-4o">GPT-4o</option>
                              <option value="gpt-4o-mini">GPT-4o mini (faster)</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>

                    <Button onClick={handlePlan} disabled={!prompt.trim()} className="w-full bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700 text-white border-0">
                      <Zap className="w-4 h-4" /> Plan my content
                    </Button>
                  </>
                )}

                {/* Progress steps */}
                {(planning || planSteps.length > 0) && (
                  <div className="space-y-2">
                    {planning && (
                      <div className="flex justify-end mb-1">
                        <button onClick={stopPlan} className="text-xs text-zinc-400 hover:text-red-500 border border-zinc-200 hover:border-red-200 rounded-lg px-3 py-1 transition-colors flex items-center gap-1">
                          <X className="w-3 h-3" /> Stop
                        </button>
                      </div>
                    )}
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

                {/* Plan complete — scroll to queue */}
                {planSummary && allStepsDone && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-emerald-700">
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                      <span><span className="font-semibold">{planSummary.campaignName}</span> — {planSummary.contentDays.length} posts ready to review below</span>
                    </div>
                    <button onClick={resetPlanner} className="text-xs text-zinc-400 hover:text-zinc-600 underline whitespace-nowrap ml-4">Plan again</button>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Section divider ── */}
      <div className="flex items-center gap-3 pt-2">
        <div className="flex-1 h-px bg-zinc-200" />
        <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">Your content queue</span>
        <div className="flex-1 h-px bg-zinc-200" />
      </div>

      {/* ── Post Queue — grouped by campaign ── */}
      {(() => {
        const activePosts = posts.filter(p => !['published', 'rejected'].includes(p.status))

        // Group by campaign_id (null = no campaign)
        const campaignMap = new Map<string, { name: string; createdAt: string | null; brief?: CampaignBrief; startDate?: string; endDate?: string; posts: QueuedPost[] }>()
        for (const post of activePosts) {
          const key = post.campaign_id ?? '__none__'
          if (!campaignMap.has(key)) {
            const plan = plans.find(p => p.id === post.campaign_id)
            campaignMap.set(key, {
              name: post.cada_campaigns?.name ?? (post.campaign_id ? 'Campaign' : 'Unplanned posts'),
              createdAt: post.cada_campaigns?.created_at ?? plan?.created_at ?? null,
              brief: plan?.brief,
              startDate: plan?.start_date,
              endDate: plan?.end_date ?? undefined,
              posts: [],
            })
          }
          campaignMap.get(key)!.posts.push(post)
        }

        // Sort campaigns newest-first
        const sortedCampaignEntries = Array.from(campaignMap.entries()).sort(([, a], [, b]) => {
          if (!a.createdAt) return 1
          if (!b.createdAt) return -1
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        })

        if (campaignMap.size === 0 && !loading && !planning) {
          return <p className="text-center text-sm text-zinc-400 py-12">No posts yet — plan your content above to get started.</p>
        }

        return sortedCampaignEntries.map(([key, group]) => {
          const reviewPosts    = group.posts.filter(p => ['draft', 'pending_approval'].includes(p.status))
          const generatingP    = group.posts.filter(p => p.status === 'generating')
          const imageP         = group.posts.filter(p => p.status === 'image_review')
          const scheduledP     = group.posts.filter(p => ['approved', 'pending'].includes(p.status))
          const failedP        = group.posts.filter(p => p.status === 'failed')
          const isCollapsed    = !expandedCampaigns.has(key)
          const toggleCollapse = () => setExpandedCampaigns(prev => {
            const next = new Set(prev)
            if (next.has(key)) next.delete(key); else next.add(key)
            return next
          })

          // Status summary for collapsed view
          const pendingCount   = reviewPosts.length + imageP.length + generatingP.length + failedP.length
          const scheduledCount = scheduledP.length

          return (
            <section key={key} ref={key === Array.from(campaignMap.keys())[0] ? queueRef : undefined} className="space-y-4">
              {/* Campaign header — collapsible */}
              <button onClick={toggleCollapse} className="w-full bg-zinc-900 rounded-2xl px-5 py-3.5 flex items-center justify-between hover:bg-zinc-800 transition-colors">
                <div className="text-left flex-1 min-w-0">
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-0.5">Campaign</p>
                  <p className="text-sm font-bold text-white">{group.name}</p>
                  {(group.startDate || group.createdAt) && (
                    <p className="text-[10px] text-zinc-500 mt-0.5">
                      {group.startDate && group.endDate
                        ? `${new Date(group.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(group.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                        : group.createdAt
                          ? `Generated ${new Date(group.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                          : ''}
                    </p>
                  )}
                  {group.brief && (
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
                      {group.brief.channels?.length && <span className="text-[10px] text-zinc-400">{group.brief.channels.join(' · ')}</span>}
                      {group.brief.imageModel && <span className="text-[10px] text-zinc-500">Model: {group.brief.imageModel}</span>}
                      {group.brief.imageSize && <span className="text-[10px] text-zinc-500">Size: {group.brief.imageSize}</span>}
                      {group.brief.imageQuality && <span className="text-[10px] text-zinc-500">Quality: {group.brief.imageQuality}</span>}
                      {group.brief.postFormat && group.brief.postFormat !== 'auto' && <span className="text-[10px] text-zinc-500">Format: {group.brief.postFormat}</span>}
                      {group.brief.weeks != null && <span className="text-[10px] text-zinc-500">{group.brief.weeks}w · {group.brief.postsPerWeek} posts/wk</span>}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {isCollapsed && (
                    <div className="flex items-center gap-2">
                      {pendingCount > 0 && <span className="text-[10px] font-semibold bg-amber-500 text-white px-2 py-0.5 rounded-full">{pendingCount} pending</span>}
                      {scheduledCount > 0 && <span className="text-[10px] font-semibold bg-emerald-600 text-white px-2 py-0.5 rounded-full">{scheduledCount} scheduled</span>}
                    </div>
                  )}
                  <ChevronDown className={cn('w-4 h-4 text-zinc-400 transition-transform', isCollapsed && '-rotate-90')} />
                </div>
              </button>

              {!isCollapsed && (
                <div className="space-y-4">
                  {reviewPosts.length > 0 && (
                    <div className="space-y-3">
                      <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Step 1 — Review content ({reviewPosts.length})</span>
                      {reviewPosts.map(post => (
                        <PostCard key={post.id} post={post} saving={saving === post.id} editingId={editingId}
                          editCaption={editCaption} editConcept={editConcept} editDate={editDate}
                          setEditCaption={setEditCaption} setEditConcept={setEditConcept} setEditDate={setEditDate}
                          onApprove={() => handleAction(post.id, 'approve')}
                          generatingImage={generatingId === post.id}
                          onRemove={() => handleDelete(post.id)}
                          onEdit={() => startEdit(post)} onSaveEdit={() => saveEdit(post.id)} onCancelEdit={() => setEditingId(null)} />
                      ))}
                    </div>
                  )}

                  {generatingP.length > 0 && (
                    <div className="space-y-3">
                      <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Generating images ({generatingP.length})</span>
                      {generatingP.map(post => (
                        <PostCard key={post.id} post={post} saving={false} editingId={editingId}
                          editCaption={editCaption} editConcept={editConcept} editDate={editDate}
                          setEditCaption={setEditCaption} setEditConcept={setEditConcept} setEditDate={setEditDate} />
                      ))}
                    </div>
                  )}

                  {imageP.length > 0 && (
                    <div className="space-y-3">
                      <span className="text-xs font-semibold text-violet-600 uppercase tracking-wider">Step 2 — Review image ({imageP.length})</span>
                      {imageP.map(post => (
                        <PostCard key={post.id} post={post} saving={saving === post.id} editingId={editingId}
                          editCaption={editCaption} editConcept={editConcept} editDate={editDate}
                          setEditCaption={setEditCaption} setEditConcept={setEditConcept} setEditDate={setEditDate}
                          onSchedule={() => handleAction(post.id, 'schedule')}
                          onRegenerate={(model, fixNote) => regenerateImage(post.id, model, fixNote)} regenerating={regeneratingId === post.id}
                          onReject={() => handleAction(post.id, 'reject')}
                          onEdit={() => startEdit(post)} onSaveEdit={() => saveEdit(post.id)} onCancelEdit={() => setEditingId(null)}
                          onRefresh={loadPosts} />
                      ))}
                    </div>
                  )}

                  {scheduledP.length > 0 && (
                    <div className="space-y-3">
                      <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Scheduled ({scheduledP.length})</span>
                      {scheduledP.map(post => (
                        <PostCard key={post.id} post={post} saving={saving === post.id} editingId={editingId}
                          editCaption={editCaption} editConcept={editConcept} editDate={editDate}
                          setEditCaption={setEditCaption} setEditConcept={setEditConcept} setEditDate={setEditDate}
                          onEdit={() => startEdit(post)}
                          onSaveEdit={() => saveEdit(post.id)} onCancelEdit={() => setEditingId(null)}
                          onUnapprove={post.status === 'approved' ? () => handleAction(post.id, 'unapprove') : undefined}
                          onPublishNow={post.status === 'pending' ? () => publishNow(post.id) : undefined}
                          onRemove={post.status === 'pending' ? () => handleDelete(post.id) : undefined}
                          publishingNow={publishingId === post.id} />
                      ))}
                    </div>
                  )}

                  {failedP.length > 0 && (
                    <div className="space-y-3">
                      <span className="text-xs font-semibold text-red-500 uppercase tracking-wider">Failed — tap to retry ({failedP.length})</span>
                      {failedP.map(post => (
                        <PostCard key={post.id} post={post} saving={saving === post.id} editingId={editingId}
                          editCaption={editCaption} editConcept={editConcept} editDate={editDate}
                          setEditCaption={setEditCaption} setEditConcept={setEditConcept} setEditDate={setEditDate}
                          onRegenerate={(model, fixNote) => regenerateImage(post.id, model, fixNote)} regenerating={regeneratingId === post.id}
                          onRemove={() => handleDelete(post.id)}
                          onEdit={() => startEdit(post)} onSaveEdit={() => saveEdit(post.id)} onCancelEdit={() => setEditingId(null)}
                          onRefresh={loadPosts} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          )
        })
      })()}


      {loading && <p className="text-center text-sm text-zinc-400 py-8">Loading…</p>}

      {/* ── Past Plans — exclude campaigns still active in the queue ── */}
      {(() => {
        const activeCampaignIds = new Set(posts.filter(p => !['published', 'rejected'].includes(p.status)).map(p => p.campaign_id).filter(Boolean))
        const pastPlans = plans.filter(p => !activeCampaignIds.has(p.id))
        if (pastPlans.length === 0) return null
        return (
        <section className="space-y-3 pt-2">
          <button
            type="button"
            onClick={() => setPastPlansOpen(v => !v)}
            className="flex items-center gap-2 w-full text-left group"
          >
            <History className="w-4 h-4 text-zinc-400" />
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex-1">Past plans ({pastPlans.length})</h2>
            <ChevronDown className={cn('w-3.5 h-3.5 text-zinc-400 transition-transform', pastPlansOpen && 'rotate-180')} />
          </button>
          {pastPlansOpen && <div className="space-y-2">
            {pastPlans.map(plan => {
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
                                    <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide mb-1">Image concept</p>
                                    <p className="text-xs text-zinc-500 italic">{post.image_concept}</p>
                                  </div>
                                )}
                                {post.image_prompt_used && (
                                  <div>
                                    <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide mb-1">Prompt sent to AI ↗</p>
                                    <p className="text-xs text-zinc-500 whitespace-pre-wrap font-mono">{post.image_prompt_used}</p>
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
          </div>}
        </section>
        )
      })()}
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
                          <p className="text-xs font-medium text-zinc-800 leading-snug">{report.title}</p>
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
  onApprove, generatingImage, onSchedule, onRegenerate, regenerating, onReject, onUnapprove, onRemove, onEdit, onSaveEdit, onCancelEdit, onPublishNow, publishingNow, onRefresh,
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
  onRegenerate?: (model: string, fixNote?: string) => void
  regenerating?: boolean
  onReject?: () => void
  onUnapprove?: () => void
  onRemove?: () => void
  onEdit?: () => void
  onSaveEdit?: () => void
  onCancelEdit?: () => void
  onPublishNow?: () => void
  publishingNow?: boolean
  onRefresh?: () => void
}) {
  const [captionExpanded, setCaptionExpanded] = useState(false)
  const [conceptExpanded, setConceptExpanded] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [regenModel, setRegenModel] = useState<string>(() => (post.image_model as string) ?? 'gpt-image-1')
  const [fixNote, setFixNote] = useState('')
  const prevRegenerating = useRef(false)
  useEffect(() => {
    if (prevRegenerating.current && !regenerating) setFixNote('')
    prevRegenerating.current = regenerating ?? false
  }, [regenerating])
  const [showRevisions, setShowRevisions] = useState(false)
  const [revisions, setRevisions] = useState<ImageRevision[] | null>(null)
  const [loadingRevisions, setLoadingRevisions] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const isEditing = editingId === post.id

  async function loadRevisions() {
    if (revisions !== null) { setShowRevisions(v => !v); return }
    setLoadingRevisions(true)
    setShowRevisions(true)
    try {
      const res = await fetch(`/api/agents/post-queue/revisions?post_id=${post.id}`)
      const json = await res.json()
      setRevisions(json.revisions ?? [])
    } finally {
      setLoadingRevisions(false)
    }
  }

  async function restoreRevision(revisionId: string) {
    setRestoringId(revisionId)
    try {
      const res = await fetch('/api/agents/post-queue/revisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: post.id, revision_id: revisionId }),
      })
      if (res.ok) {
        setShowRevisions(false)
        onRefresh?.()
      }
    } finally {
      setRestoringId(null)
    }
  }
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

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setLightbox(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="" className="max-h-[90vh] max-w-[90vw] rounded-2xl shadow-2xl object-contain" onClick={e => e.stopPropagation()} />
          <button onClick={() => setLightbox(null)} className="absolute top-4 right-4 text-white/70 hover:text-white text-2xl font-light">✕</button>
        </div>
      )}

      {/* Images for image_review — show all slides if multi */}
      {isImageReview && (post.media_urls?.length ?? 0) > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {post.media_urls!.map((url, i) => (
            <button key={i} onClick={() => setLightbox(url)} className="flex-shrink-0 group relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Slide ${i + 1}`} className="h-48 w-32 rounded-xl object-cover border border-zinc-100 group-hover:opacity-90 transition-opacity" />
              <span className="absolute bottom-1.5 left-1.5 text-[10px] bg-black/50 text-white rounded-md px-1.5 py-0.5">Slide {i + 1}</span>
              <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="bg-black/50 rounded-full p-1.5"><ImageIcon className="w-4 h-4 text-white" /></span>
              </span>
            </button>
          ))}
        </div>
      ) : isImageReview && post.media_url ? (
        <button onClick={() => setLightbox(post.media_url!)} className="w-full group relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.media_url} alt="Generated image" className="w-full rounded-xl object-cover border border-zinc-100 max-h-80 group-hover:opacity-90 transition-opacity" />
          <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="bg-black/50 rounded-full p-2"><ImageIcon className="w-5 h-5 text-white" /></span>
          </span>
        </button>
      ) : null}

      {isEditing ? (
        <div className="space-y-2">
          <div>
            <label className="text-xs text-zinc-500 font-medium">Caption</label>
            <textarea value={editCaption} onChange={e => setEditCaption(e.target.value)} rows={7}
              className="w-full mt-1 text-xs text-zinc-700 bg-zinc-50 border border-zinc-200 rounded-lg p-2 resize-none focus:outline-none focus:ring-1 focus:ring-zinc-400" />
          </div>
          <div>
            <label className="text-xs text-zinc-500 font-medium flex items-center gap-1"><ImageIcon className="w-3 h-3" /> Image prompt</label>
            <textarea value={editConcept} onChange={e => setEditConcept(e.target.value)} rows={5}
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
            <div className="flex items-start gap-1">
              <ImageIcon className="w-3 h-3 mt-0.5 flex-shrink-0 text-zinc-400" />
              <div className="min-w-0">
                <p className={cn('text-xs text-zinc-400 italic', !conceptExpanded && 'line-clamp-2')}>{post.image_concept}</p>
                <button onClick={() => setConceptExpanded(v => !v)} className="text-[10px] text-zinc-400 hover:text-zinc-600 transition-colors mt-0.5">
                  {conceptExpanded ? '▲ Show less' : '▼ Show full prompt'}
                </button>
              </div>
            </div>
          )}

          {post.image_prompt_used && (
            <div className="bg-zinc-50 rounded-xl p-3 border border-zinc-100">
              <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">Prompt sent to AI</p>
              <p className={cn('text-[11px] text-zinc-500 font-mono whitespace-pre-wrap', !conceptExpanded && 'line-clamp-4')}>{post.image_prompt_used}</p>
              <button onClick={() => setConceptExpanded(v => !v)} className="text-[10px] text-zinc-400 hover:text-zinc-600 transition-colors mt-1">
                {conceptExpanded ? '▲ Show less' : '▼ Show full prompt'}
              </button>
            </div>
          )}

          {/* Small thumbnail for non-image-review posts that have an image */}
          {!isImageReview && post.media_url && (
            <button onClick={() => setLightbox(post.media_url!)} className="group relative flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={post.media_url} alt="" className="w-14 h-14 rounded-xl object-cover border border-zinc-100 group-hover:opacity-80 transition-opacity" />
              <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100">
                <ImageIcon className="w-4 h-4 text-white drop-shadow" />
              </span>
            </button>
          )}

          {post.error_message && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <XCircle className="w-3 h-3" /> {post.error_message}
            </p>
          )}

          {(onApprove || onSchedule || onRegenerate || onReject || onUnapprove || onRemove || onEdit || onPublishNow) && (
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
              {onRegenerate && (
                <div className="flex flex-col gap-1.5 w-full">
                  <input
                    value={fixNote}
                    onChange={e => setFixNote(e.target.value)}
                    disabled={regenerating}
                    placeholder='Optional: describe what to fix, e.g. "fix typo: cepatdan → cepat dan"'
                    className="w-full text-xs border border-zinc-200 rounded-xl px-3 py-2 text-zinc-700 placeholder:text-zinc-400 bg-zinc-50 focus:outline-none focus:ring-1 focus:ring-violet-300 disabled:opacity-40"
                  />
                  <div className="flex gap-1.5 items-center">
                    <select
                      value={regenModel}
                      onChange={e => setRegenModel(e.target.value)}
                      disabled={regenerating}
                      className="text-xs border border-violet-200 rounded-xl px-2 py-2 text-violet-700 bg-white focus:outline-none focus:ring-1 focus:ring-violet-300 disabled:opacity-40"
                    >
                      <option value="gpt-image-1">GPT Image 1</option>
                      <option value="dall-e-3">DALL·E 3</option>
                      <option value="gemini-nano-banana-2">Nano Banana 2 (Gemini)</option>
                      <option value="gemini-nano-banana-2-lite">Nano Banana 2 Lite (Gemini)</option>
                      <option value="gemini-nano-banana-pro">Nano Banana Pro (Gemini)</option>
                    </select>
                    <button onClick={() => { onRegenerate(regenModel, fixNote.trim() || undefined) }} disabled={regenerating}
                      className="flex items-center justify-center gap-1.5 px-3 text-xs text-violet-600 border border-violet-200 rounded-xl py-2 hover:bg-violet-50 disabled:opacity-40 transition-colors whitespace-nowrap">
                      {regenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                      {regenerating ? 'Generating…' : post.status === 'failed' ? 'Retry' : 'Regenerate'}
                    </button>
                  </div>
                </div>
              )}
              {onUnapprove && (
                <button onClick={onUnapprove} disabled={saving}
                  className="flex items-center justify-center gap-1.5 px-3 text-xs text-zinc-500 border border-zinc-200 rounded-xl py-2 hover:bg-zinc-50 disabled:opacity-40 transition-colors">
                  <RotateCcw className="w-3 h-3" /> Undo approve
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
              {(post.media_url || post.status === 'image_review') && (
                <button onClick={loadRevisions}
                  className="flex items-center justify-center gap-1.5 px-3 text-xs text-zinc-400 border border-zinc-200 rounded-xl py-2 hover:bg-zinc-50 transition-colors">
                  <History className="w-3 h-3" /> History
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

      {/* ── Revision history panel ── */}
      {showRevisions && (
        <div className="border-t border-zinc-100 pt-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide flex items-center gap-1">
              <History className="w-3 h-3" /> Image history
            </p>
            <button onClick={() => setShowRevisions(false)} className="text-zinc-400 hover:text-zinc-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {loadingRevisions && <p className="text-xs text-zinc-400">Loading…</p>}
          {revisions && revisions.length === 0 && (
            <p className="text-xs text-zinc-400 italic">No history yet — generate an image first.</p>
          )}
          {revisions && revisions.length > 0 && (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {revisions.map((rev, i) => (
                <div key={rev.id} className="flex gap-2 items-start bg-zinc-50 rounded-xl p-2">
                  <button onClick={() => setLightbox(rev.media_url)} className="flex-shrink-0 group relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={rev.media_url} alt="" className="w-14 h-14 rounded-lg object-cover border border-zinc-200 group-hover:opacity-80 transition-opacity" />
                    <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <ExternalLink className="w-3 h-3 text-white drop-shadow" />
                    </span>
                  </button>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {i === 0 && <span className="text-[10px] bg-violet-100 text-violet-600 rounded-full px-2 py-0.5 font-medium">Latest</span>}
                      {rev.image_model && <span className="text-[10px] text-zinc-400">{rev.image_model}</span>}
                      <span className="text-[10px] text-zinc-300">{format(parseISO(rev.created_at), 'MMM d, h:mm a')}</span>
                    </div>
                    {rev.correction_note && (
                      <p className="text-[11px] text-zinc-500 italic line-clamp-2">&ldquo;{rev.correction_note}&rdquo;</p>
                    )}
                    {i > 0 && (
                      <button
                        onClick={() => restoreRevision(rev.id)}
                        disabled={restoringId === rev.id}
                        className="text-[11px] text-violet-600 hover:underline disabled:opacity-40"
                      >
                        {restoringId === rev.id ? 'Restoring…' : 'Restore this version'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
