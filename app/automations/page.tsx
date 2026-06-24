'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Zap, Clock, PlayCircle, CheckCircle2, XCircle,
  Calendar, TrendingUp, FileText, RefreshCw, Info,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { formatRelativeTime } from '@/lib/utils'
import type { AgentRun } from '@/types'

interface Automation {
  id: string
  name: string
  description: string
  schedule: string
  scheduleHuman: string
  endpoint: string
  icon: typeof Clock
  color: string
  level: string
  lastRun?: AgentRun
}

const AUTOMATIONS: Automation[] = [
  {
    id: 'monday-trend',
    name: 'Monday Trend Brief',
    description: 'Every Monday at 8am WIB: researches latest modest fashion trends for Indonesia & Singapore, saves report to DB and Google Drive.',
    schedule: '0 1 * * 1',
    scheduleHuman: 'Every Monday at 8:00 AM WIB',
    endpoint: '/api/scheduled/monday-trend',
    icon: TrendingUp,
    color: 'bg-emerald-500',
    level: 'Level 1 — Scheduled',
  },
  {
    id: 'daily-content',
    name: 'Daily Content Queue',
    description: 'Every day at 9am WIB: generates 3 ready-to-post content ideas for CADA\'s top products. Saves to content library and creates Todoist tasks.',
    schedule: '0 2 * * *',
    scheduleHuman: 'Every day at 9:00 AM WIB',
    endpoint: '/api/scheduled/daily-content',
    icon: FileText,
    color: 'bg-violet-500',
    level: 'Level 1 — Scheduled',
  },
]

export default function AutomationsPage() {
  const [runs, setRuns] = useState<AgentRun[]>([])
  const [triggering, setTriggering] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, { success: boolean; message: string }>>({})
  const [isVercel, setIsVercel] = useState<boolean | null>(null)
  const [enabled, setEnabled] = useState<Record<string, boolean>>({ 'monday-trend': true, 'daily-content': true })

  const fetchRuns = useCallback(async () => {
    try {
      const res = await fetch('/api/agent-runs')
      const data = await res.json()
      setRuns(data.runs ?? [])
    } catch { /* silently fail */ }
  }, [])

  const fetchEnabled = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/automations')
      const data = await res.json()
      setEnabled(data)
    } catch { /* silently fail */ }
  }, [])

  useEffect(() => {
    fetchRuns()
    fetchEnabled()
    setIsVercel(window.location.hostname !== 'localhost')
  }, [fetchRuns, fetchEnabled])

  async function toggleEnabled(id: string, value: boolean) {
    setEnabled((prev) => ({ ...prev, [id]: value }))
    fetch('/api/settings/automations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, enabled: value }),
    }).catch(() => {
      // Rollback on network failure
      setEnabled((prev) => ({ ...prev, [id]: !value }))
    })
  }

  async function triggerAutomation(automation: Automation) {
    setTriggering(automation.id)
    setResults((prev) => ({ ...prev, [automation.id]: { success: false, message: 'Running…' } }))

    try {
      const res = await fetch(automation.endpoint)
      const data = await res.json()
      setResults((prev) => ({
        ...prev,
        [automation.id]: {
          success: data.success,
          message: data.message ?? (data.success ? 'Completed successfully' : data.error ?? 'Failed'),
        },
      }))
      await fetchRuns()
    } catch (e) {
      setResults((prev) => ({
        ...prev,
        [automation.id]: { success: false, message: e instanceof Error ? e.message : 'Network error' },
      }))
    } finally {
      setTriggering(null)
    }
  }

  function getLastRun(automationId: string): AgentRun | undefined {
    const agentMap: Record<string, string> = {
      'monday-trend': 'trend_analyst',
      'daily-content': 'daily_content',
    }
    const agentName = agentMap[automationId]
    return runs.find((r) => r.agent === agentName)
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900">Automations</h1>
        </div>
        <p className="text-sm text-zinc-500">Scheduled agents that run automatically — no clicking required</p>
      </div>

      {/* Vercel deploy notice */}
      {isVercel === false && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">Running locally</p>
            <p className="text-sm text-amber-700 mt-0.5">
              Cron schedules only activate after deploying to Vercel. You can still <strong>trigger agents manually</strong> below to test them. Deploy when ready: <code className="bg-amber-100 px-1 rounded text-xs">npx vercel</code>
            </p>
          </div>
        </div>
      )}

      {/* Level 1 Scheduled Agents */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs font-bold bg-zinc-900 text-white px-2.5 py-1 rounded-full">LEVEL 1</span>
          <h2 className="text-sm font-semibold text-zinc-700">Scheduled Agents</h2>
          <span className="text-xs text-zinc-400">Run automatically on a timer — no clicking required</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {AUTOMATIONS.map((auto, i) => {
            const lastRun = getLastRun(auto.id)
            const result = results[auto.id]
            const isRunning = triggering === auto.id
            const isEnabled = enabled[auto.id] ?? true
            const Icon = auto.icon

            return (
              <motion.div key={auto.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                <Card className={`h-full transition-opacity ${!isEnabled ? 'opacity-60' : ''}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${auto.color}`}>
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{auto.name}</CardTitle>
                          <Badge variant="default" className="mt-1 text-xs">{auto.level}</Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500">{isEnabled ? 'On' : 'Off'}</span>
                        <Switch
                          checked={isEnabled}
                          onCheckedChange={(val) => toggleEnabled(auto.id, val)}
                        />
                      </div>
                    </div>
                    <CardDescription className="mt-3 text-sm leading-relaxed">
                      {auto.description}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Schedule */}
                    <div className="flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2.5 border border-zinc-100">
                      <Clock className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-zinc-700">{auto.scheduleHuman}</p>
                        <p className="text-xs text-zinc-400 font-mono">cron: {auto.schedule}</p>
                      </div>
                    </div>

                    {/* Last run */}
                    {lastRun && (
                      <div className="flex items-center justify-between text-xs text-zinc-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          Last run: {formatRelativeTime(lastRun.created_at)}
                        </span>
                        <Badge variant={lastRun.status === 'completed' ? 'success' : lastRun.status === 'failed' ? 'error' : 'default'}>
                          {lastRun.status}
                        </Badge>
                      </div>
                    )}

                    {/* Result feedback */}
                    {result && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className={`rounded-lg p-3 flex items-start gap-2 ${result.success ? 'bg-emerald-50 border border-emerald-100' : 'bg-red-50 border border-red-100'}`}>
                        {result.success
                          ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                          : <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                        }
                        <p className={`text-xs ${result.success ? 'text-emerald-700' : 'text-red-700'}`}>
                          {result.message}
                        </p>
                      </motion.div>
                    )}

                    {/* Trigger button */}
                    <Button
                      onClick={() => triggerAutomation(auto)}
                      loading={isRunning}
                      variant="secondary"
                      className="w-full"
                    >
                      {isRunning ? (
                        <><RefreshCw className="w-4 h-4 animate-spin" /> Running…</>
                      ) : (
                        <><PlayCircle className="w-4 h-4" /> Run Now</>
                      )}
                    </Button>
                    <p className="text-xs text-zinc-400 text-center -mt-2">
                      Trigger manually to test · Runs automatically on schedule after Vercel deploy
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Level 2 Coming Soon */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs font-bold bg-zinc-300 text-zinc-600 px-2.5 py-1 rounded-full">LEVEL 2</span>
          <h2 className="text-sm font-semibold text-zinc-400">Trigger-Based Agents</h2>
          <span className="text-xs text-zinc-400">Coming soon — reacts to events automatically</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { name: 'New Product Agent', desc: 'Add a product → auto-generates caption, description & promo email', icon: '🛍️' },
            { name: 'Low Engagement Alert', desc: 'Post underperforms → agent automatically suggests improvements', icon: '📉' },
          ].map((item) => (
            <Card key={item.name} className="opacity-50">
              <CardContent className="pt-5 flex items-start gap-3">
                <span className="text-2xl">{item.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-zinc-700">{item.name}</p>
                  <p className="text-xs text-zinc-400 mt-1">{item.desc}</p>
                  <Badge variant="default" className="mt-2 text-xs">Coming soon</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Level 3 Coming Soon */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs font-bold bg-gradient-to-r from-violet-500 to-pink-500 text-white px-2.5 py-1 rounded-full">LEVEL 3</span>
          <h2 className="text-sm font-semibold text-zinc-400">Multi-Step Agents</h2>
          <span className="text-xs text-zinc-400">Chains multiple tasks together</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { name: 'Full Campaign Agent ⚡', desc: 'One sentence triggers trend research, brief, 7-day content, Todoist, Calendar & Drive', icon: '🚀', live: true, href: '/agents/full-campaign' },
            { name: 'Performance → Content Loop', desc: 'Reviews last week\'s data → identifies top content → generates more in that style', icon: '🔄', live: false },
          ].map((item) => (
            <Card key={item.name} className={item.live ? '' : 'opacity-50'}>
              <CardContent className="pt-5 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{item.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-zinc-700">{item.name}</p>
                    <p className="text-xs text-zinc-400 mt-1">{item.desc}</p>
                    <Badge variant={item.live ? 'success' : 'default'} className="mt-2 text-xs">
                      {item.live ? 'Live' : 'Coming soon'}
                    </Badge>
                  </div>
                </div>
                {item.live && item.href && (
                  <a href={item.href}>
                    <Button size="sm" variant="secondary">Open →</Button>
                  </a>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Deploy to Vercel CTA */}
      {isVercel === false && (
        <Card className="border-zinc-200 bg-zinc-50">
          <CardContent className="pt-5 flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center flex-shrink-0">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-zinc-900">Ready to activate scheduled agents?</p>
              <p className="text-sm text-zinc-500 mt-1">
                Deploy to Vercel to activate cron jobs. Monday briefs and daily queues will run automatically.
              </p>
              <div className="mt-3 bg-zinc-900 rounded-lg p-3 font-mono text-xs text-emerald-400">
                <span className="text-zinc-500">$ </span>npx vercel --prod
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
