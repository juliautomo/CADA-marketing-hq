'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Zap, ArrowRight, CheckCircle2, Circle, AlertCircle,
  Loader2, ExternalLink, CalendarDays, Copy, Check, Send,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Step {
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
  cta: string
}

interface Summary {
  campaignName: string
  theme: string
  startDate: string
  contentDays: ContentDay[]
  calendar: boolean
  drive: boolean
  driveUrl: string
  campaignId: string
}

// ─── Step definitions ─────────────────────────────────────────────────────────
const STEP_DEFS = [
  { n: 1, label: 'Parse campaign brief',         icon: '📋' },
  { n: 2, label: 'Research trends',              icon: '📈' },
  { n: 3, label: 'Write campaign brief',         icon: '✍️' },
  { n: 4, label: 'Generate 7-day content',       icon: '📱' },
  { n: 5, label: 'Save to post queue',           icon: '💾' },
  { n: 6, label: 'Block Google Calendar',        icon: '📅' },
  { n: 7, label: 'Export to Google Drive',       icon: '📂' },
]

const EXAMPLES = [
  'Launch our new collection on the 1st of next month targeting our core audience',
  'Run a mid-year sale campaign starting next Monday across Instagram and TikTok',
  'Promote our hero product for the Singapore market in July',
  'Create a seasonal campaign for TikTok and Instagram starting next week',
]

export default function FullCampaignPage() {
  const [prompt, setPrompt] = useState('')
  const [running, setRunning] = useState(false)
  const [steps, setSteps] = useState<Step[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [duration, setDuration] = useState<number | null>(null)
  const [copied, setCopied] = useState<number | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const router = useRouter()

  function updateStep(incoming: Step) {
    setSteps((prev) => {
      const idx = prev.findIndex((s) => s.step === incoming.step)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = incoming
        return next
      }
      return [...prev, incoming]
    })
  }

  async function handleLaunch() {
    if (!prompt.trim() || running) return
    setRunning(true)
    setSteps([])
    setSummary(null)
    setError(null)
    setDuration(null)

    try {
      const res = await fetch('/api/agents/full-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })

      if (!res.body) throw new Error('No response stream')
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
            if (event.error) { setError(event.error); break }
            updateStep(event as Step)
            if (event.complete) {
              setSummary(event.summary as Summary)
              setDuration(event.duration as number)
            }
          } catch { /* malformed chunk */ }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setRunning(false)
    }
  }

  function copyCaption(caption: string, day: number) {
    navigator.clipboard.writeText(caption)
    setCopied(day)
    setTimeout(() => setCopied(null), 2000)
  }

  const allDone = steps.length > 0 && steps.every((s) => s.status === 'done' || s.status === 'skipped')

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-zinc-900">Full Campaign Agent</h1>
            <Badge variant="info">Level 3 · Multi-Step</Badge>
          </div>
          <p className="text-sm text-zinc-500">
            One sentence → trends + brief + 7-day calendar + post queue + Google Calendar + Drive.
          </p>
        </div>
      </div>

      {/* Input */}
      {!running && !allDone && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-violet-100">
            <CardContent className="pt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-2">
                  Describe your campaign in one sentence
                </label>
                <textarea
                  ref={textareaRef}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleLaunch() } }}
                  rows={3}
                  placeholder='e.g. "Launch our new collection on June 1st targeting our core audience"'
                  className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Example prompts */}
              <div>
                <p className="text-xs text-zinc-400 mb-2">Try an example:</p>
                <div className="flex flex-wrap gap-2">
                  {EXAMPLES.map((ex) => (
                    <button key={ex} onClick={() => setPrompt(ex)}
                      className="text-xs px-3 py-1.5 rounded-full border border-zinc-200 text-zinc-600 hover:border-violet-300 hover:text-violet-700 hover:bg-violet-50 transition-colors text-left">
                      {ex}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                onClick={handleLaunch}
                disabled={!prompt.trim()}
                size="lg"
                className="w-full bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700 text-white border-0"
              >
                <Zap className="w-4 h-4" /> Launch Campaign Agent <ArrowRight className="w-4 h-4" />
              </Button>

              <p className="text-xs text-zinc-400 text-center">
                Press Enter or click Launch · Takes ~30–60 seconds · Chains 8 AI steps automatically
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Progress Steps */}
      <AnimatePresence>
        {(running || steps.length > 0) && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Zap className="w-4 h-4 text-violet-500" />
                    Agent Running
                  </CardTitle>
                  {duration && (
                    <Badge variant="success">Completed in {duration}s</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {STEP_DEFS.map((def) => {
                    const step = steps.find((s) => s.step === def.n)
                    const status = step?.status ?? 'pending'

                    return (
                      <motion.div
                        key={def.n}
                        initial={{ opacity: 0.4 }}
                        animate={{ opacity: status === 'pending' ? 0.4 : 1 }}
                        className="flex items-center gap-3"
                      >
                        {/* Icon */}
                        <div className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm',
                          status === 'done' && 'bg-emerald-100',
                          status === 'running' && 'bg-violet-100',
                          status === 'skipped' && 'bg-zinc-100',
                          status === 'error' && 'bg-red-100',
                          status === 'pending' && 'bg-zinc-50',
                        )}>
                          {status === 'done' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                          {status === 'running' && <Loader2 className="w-4 h-4 text-violet-500 animate-spin" />}
                          {status === 'skipped' && <Circle className="w-4 h-4 text-zinc-300" />}
                          {status === 'error' && <AlertCircle className="w-4 h-4 text-red-500" />}
                          {status === 'pending' && <span className="text-zinc-300 text-xs font-bold">{def.n}</span>}
                        </div>

                        {/* Label */}
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            'text-sm font-medium',
                            status === 'done' && 'text-zinc-800',
                            status === 'running' && 'text-violet-700',
                            status === 'skipped' && 'text-zinc-400',
                            status === 'pending' && 'text-zinc-400',
                          )}>
                            {def.icon} {step?.label ?? def.label}
                          </p>
                          {typeof step?.data?.trends === 'string' ? (
                            <p className="text-xs text-zinc-400 mt-0.5 line-clamp-1">{step.data.trends}</p>
                          ) : null}
                          {typeof step?.data?.name === 'string' ? (
                            <p className="text-xs text-zinc-500 mt-0.5">{step.data.name} · {String(step.data.theme ?? '')}</p>
                          ) : null}
                        </div>

                        {/* Status badge */}
                        {status !== 'pending' && (
                          <Badge variant={
                            status === 'done' ? 'success' :
                            status === 'running' ? 'info' :
                            status === 'skipped' ? 'default' : 'error'
                          }>
                            {status}
                          </Badge>
                        )}
                      </motion.div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-100 p-4">
          <p className="text-sm text-red-700 font-medium">Agent failed</p>
          <p className="text-xs text-red-500 mt-1">{error}</p>
          <button onClick={() => { setError(null); setSteps([]); setSummary(null) }}
            className="mt-2 text-xs text-red-600 underline">Try again</button>
        </div>
      )}

      {/* Summary */}
      {summary && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">

          {/* Campaign card */}
          <Card className="border-violet-200 bg-gradient-to-br from-violet-50 to-pink-50">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-zinc-900">{summary.campaignName}</h2>
                  <p className="text-sm text-zinc-600 mt-0.5">{summary.theme}</p>
                  <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1">
                    <CalendarDays className="w-3 h-3" /> Starts {summary.startDate}
                  </p>
                </div>
                <Badge variant="success" className="text-sm px-3 py-1">✨ Launched</Badge>
              </div>

              {/* Integration status */}
              <div className="grid grid-cols-2 gap-3">
                <div className={cn('rounded-xl p-3 text-center', summary.calendar ? 'bg-white' : 'bg-zinc-100 opacity-50')}>
                  <p className="text-lg">📅</p>
                  <p className="text-xs font-medium text-zinc-700 mt-1">Calendar</p>
                  <p className="text-xs text-zinc-400">{summary.calendar ? '4 weeks blocked' : 'Not connected'}</p>
                </div>
                <div className={cn('rounded-xl p-3 text-center', summary.drive ? 'bg-white' : 'bg-zinc-100 opacity-50')}>
                  <p className="text-lg">📂</p>
                  <p className="text-xs font-medium text-zinc-700 mt-1">Drive</p>
                  <p className="text-xs text-zinc-400">{summary.drive ? 'Brief exported' : 'Not connected'}</p>
                </div>
              </div>

              {summary.driveUrl && (
                <a href={summary.driveUrl} target="_blank" rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-sm text-violet-600 hover:underline">
                  <ExternalLink className="w-3.5 h-3.5" /> View full brief in Google Drive
                </a>
              )}
            </CardContent>
          </Card>

          {/* 7-day content calendar — grid view */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-zinc-800">📅 7-Day Content Calendar</h3>
              <Badge variant="default">{summary.contentDays.length} posts ready</Badge>
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {summary.contentDays.map((day) => {
                const dateObj = new Date(day.date + 'T00:00:00')
                const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' })
                const dayNum = dateObj.getDate()
                const monthName = dateObj.toLocaleDateString('en-US', { month: 'short' })
                const isTikTok = day.platform?.toLowerCase().includes('tiktok')
                return (
                  <motion.div
                    key={day.day}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: day.day * 0.04 }}
                    className="group relative"
                  >
                    <div className="rounded-xl border border-zinc-100 bg-white hover:border-violet-200 hover:shadow-sm transition-all cursor-default overflow-hidden">
                      {/* Date header */}
                      <div className={cn(
                        'px-2 py-1.5 text-center border-b border-zinc-100',
                        isTikTok ? 'bg-zinc-900' : 'bg-gradient-to-br from-violet-500 to-pink-500'
                      )}>
                        <p className="text-xs text-white/70 font-medium leading-none">{dayName}</p>
                        <p className="text-lg font-bold text-white leading-tight">{dayNum}</p>
                        <p className="text-xs text-white/70 leading-none">{monthName}</p>
                      </div>

                      {/* Content */}
                      <div className="p-2">
                        <span className={cn(
                          'text-xs font-semibold px-1.5 py-0.5 rounded-full mb-1.5 inline-block',
                          isTikTok ? 'bg-zinc-100 text-zinc-700' : 'bg-purple-50 text-purple-700'
                        )}>
                          {day.platform}
                        </span>
                        <p className="text-xs text-zinc-500 leading-snug mb-1">{day.contentType}</p>
                        {day.hook && (
                          <p className="text-xs text-violet-700 font-medium line-clamp-2 leading-snug">
                            {day.hook}
                          </p>
                        )}
                        <p className="text-xs text-zinc-600 line-clamp-3 leading-snug mt-1">
                          {day.caption.slice(0, 120)}
                        </p>
                      </div>

                      {/* Copy button */}
                      <button
                        onClick={() => copyCaption(day.caption, day.day)}
                        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-1 rounded bg-white/90 text-zinc-400 hover:text-zinc-700 transition-all"
                        title="Copy caption"
                      >
                        {copied === day.day
                          ? <Check className="w-3 h-3 text-emerald-500" />
                          : <Copy className="w-3 h-3" />
                        }
                      </button>
                    </div>
                  </motion.div>
                )
              })}
            </div>

            <p className="text-xs text-zinc-400 mt-2 text-center">
              All 7 posts added to your Post Queue — go there to approve and schedule them.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 flex-wrap">
            <Button
              onClick={() => {
                const params = new URLSearchParams({
                  topic: summary.campaignName + (summary.theme ? ' — ' + summary.theme : ''),
                  startDate: summary.startDate,
                })
                router.push('/posts?' + params.toString())
              }}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white border-0 gap-2"
            >
              <Send className="w-4 h-4" /> Schedule these posts →
            </Button>
            <Button variant="secondary" onClick={() => { setSteps([]); setSummary(null); setPrompt('') }} className="flex-1">
              ← New Campaign
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  )
}
