'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Zap, ArrowRight, CheckCircle2, Circle, AlertCircle,
  Loader2, ExternalLink, CalendarDays, Hash, Copy, Check,
} from 'lucide-react'
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
  todoist: boolean
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
  { n: 5, label: 'Save to database',             icon: '💾' },
  { n: 6, label: 'Create Todoist tasks',         icon: '✅' },
  { n: 7, label: 'Block Google Calendar',        icon: '📅' },
  { n: 8, label: 'Export to Google Drive',       icon: '📂' },
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
            One sentence → trends + brief + 7-day content + Todoist + Calendar + Drive. Fully automated.
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
                  placeholder='e.g. "Launch our Eid collection on June 1st targeting Indonesian Muslim women"'
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
              <div className="grid grid-cols-3 gap-3">
                <div className={cn('rounded-xl p-3 text-center', summary.todoist ? 'bg-white' : 'bg-zinc-100 opacity-50')}>
                  <p className="text-lg">✅</p>
                  <p className="text-xs font-medium text-zinc-700 mt-1">Todoist</p>
                  <p className="text-xs text-zinc-400">{summary.todoist ? 'Tasks created' : 'Not connected'}</p>
                </div>
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

          {/* 7-day content calendar */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-zinc-800">
                📱 7-Day Content Calendar
              </h3>
              <Badge variant="default">{summary.contentDays.length} posts ready</Badge>
            </div>

            <div className="space-y-3">
              {summary.contentDays.map((day) => (
                <motion.div
                  key={day.day}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: day.day * 0.06 }}
                >
                  <Card className="hover:shadow-sm transition-shadow">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          {/* Day badge */}
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 text-white flex flex-col items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold leading-none">D{day.day}</span>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className={cn(
                                'text-xs font-bold px-2 py-0.5 rounded-full',
                                day.platform?.toLowerCase() === 'tiktok' ? 'bg-zinc-900 text-white' : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                              )}>
                                {day.platform}
                              </span>
                              <span className="text-xs text-zinc-400">{day.date}</span>
                              <span className="text-xs text-zinc-400">· {day.contentType}</span>
                            </div>

                            {day.hook && (
                              <p className="text-xs font-medium text-violet-700 mb-1">
                                🎬 Hook: {day.hook}
                              </p>
                            )}

                            <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap line-clamp-3">
                              {day.caption}
                            </p>

                            {day.cta && (
                              <p className="text-xs text-zinc-500 mt-1.5 flex items-center gap-1">
                                <Hash className="w-3 h-3" /> CTA: {day.cta}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Copy button */}
                        <button
                          onClick={() => copyCaption(day.caption, day.day)}
                          className="flex-shrink-0 p-2 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors"
                          title="Copy caption"
                        >
                          {copied === day.day
                            ? <Check className="w-4 h-4 text-emerald-500" />
                            : <Copy className="w-4 h-4" />
                          }
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Run again */}
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => { setSteps([]); setSummary(null); setPrompt('') }} className="flex-1">
              ← Start New Campaign
            </Button>
            <Button variant="secondary" onClick={() => window.open('/history', '_self')} className="flex-1">
              View in History →
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  )
}
