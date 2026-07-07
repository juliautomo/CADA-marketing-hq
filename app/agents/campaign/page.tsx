'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { CalendarDays, ArrowRight, CheckCircle2, Circle, ExternalLink, Plus, X, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import type { Campaign } from '@/types'

const channelOptions = ['Instagram', 'TikTok', 'Email', 'Pinterest', 'Facebook Ads', 'Google Ads', 'SMS', 'Influencer']

export default function CampaignPage() {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [theme, setTheme] = useState('')
  const [budget, setBudget] = useState('')
  const [channels, setChannels] = useState<string[]>(['Instagram', 'Email', 'TikTok'])
  const [loading, setLoading] = useState(false)
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [briefText, setBriefText] = useState<string>('')
  const [integrations, setIntegrations] = useState<{ calendar: boolean; drive: boolean; driveError?: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  function toggleChannel(ch: string) {
    setChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
    )
  }

  async function handlePlan() {
    if (!name || !description || !startDate) return
    setLoading(true)
    setCampaign(null)
    setError(null)
    try {
      const res = await fetch('/api/agents/campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, startDate, theme, budget, channels }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error ?? 'Failed')
      setCampaign(data.campaign)
      setBriefText(data.briefText ?? '')
      setIntegrations({ calendar: data.calendarOk, drive: data.driveOk, driveError: data.driveError })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  // Parse brief — try DB brief first, fall back to parsing briefText
  const brief = ((): Record<string, unknown> => {
    const dbBrief = campaign?.brief as Record<string, unknown> | undefined
    if (dbBrief && Object.keys(dbBrief).length > 0) return dbBrief
    if (!briefText) return {}
    try {
      const clean = briefText.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim()
      const match = clean.match(/\{[\s\S]*\}/)
      return match ? JSON.parse(match[0]) : {}
    } catch { return {} }
  })()

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
              <CalendarDays className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-zinc-900">Campaign Planner</h1>
          </div>
          <p className="text-sm text-zinc-500">Build 4-week campaigns with Google Calendar events and Drive briefs</p>
        </div>
        <Badge variant="info">Google APIs</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Campaign Details</CardTitle>
              <CardDescription>We&apos;ll build a full 4-week plan from this</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1.5">Campaign Name *</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Summer Solstice Drop" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1.5">Description *</label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is this campaign about? What products, goals, audience?"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1.5">Start Date *</label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1.5">Campaign Theme <span className="text-zinc-400">(optional)</span></label>
                <Input value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="e.g. Coastal summer, Quiet luxury" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1.5">Budget <span className="text-zinc-400">(optional)</span></label>
                <Input value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="e.g. $5,000" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-2">Channels</label>
                <div className="flex flex-wrap gap-1.5">
                  {channelOptions.map((ch) => (
                    <button
                      key={ch}
                      onClick={() => toggleChannel(ch)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                        channels.includes(ch)
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'
                      }`}
                    >
                      {channels.includes(ch) ? <X className="w-2.5 h-2.5" /> : <Plus className="w-2.5 h-2.5" />}
                      {ch}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                onClick={handlePlan}
                loading={loading}
                disabled={!name || !description || !startDate}
                className="w-full"
                size="lg"
              >
                {loading ? 'Building campaign…' : <>Build Campaign <ArrowRight className="w-4 h-4" /></>}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Results */}
        <div className="lg:col-span-2 space-y-5">
          {loading && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <div className="text-center">
                  <p className="text-sm text-zinc-700 font-medium">Building your campaign…</p>
                  <p className="text-xs text-zinc-400 mt-1">Creating Calendar events and Drive brief…</p>
                </div>
              </CardContent>
            </Card>
          )}

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-100 p-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {campaign && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {/* Overview */}
              <Card className="border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50">
                <CardContent className="pt-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="font-bold text-zinc-900 text-lg">{campaign.name}</h2>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {formatDate(campaign.start_date)} → {formatDate(campaign.end_date)}
                      </p>
                    </div>
                    <Badge variant="info">{campaign.status}</Badge>
                  </div>
                  {typeof brief?.summary === 'string' && (
                    <p className="text-sm text-zinc-700 leading-relaxed">{brief.summary}</p>
                  )}
                  {typeof brief?.objective === 'string' && (
                    <div className="rounded-lg bg-white/70 border border-blue-100 px-3 py-2">
                      <p className="text-xs font-semibold text-blue-700 mb-0.5">🎯 Objective</p>
                      <p className="text-sm text-zinc-700">{brief.objective}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Integrations */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Calendar */}
                <Card className={`p-4 flex items-center gap-3 ${integrations?.calendar ? '' : 'opacity-50'}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${integrations?.calendar ? 'bg-blue-500' : 'bg-zinc-300'}`}>
                    <CalendarDays className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-zinc-700">Google Calendar</p>
                    <p className="text-xs text-zinc-400">{integrations?.calendar ? `${campaign.calendar_event_ids?.length ?? 4} events added ✓` : 'Not connected'}</p>
                  </div>
                </Card>

                {/* Drive */}
                {campaign.google_drive_url ? (
                  <a href={campaign.google_drive_url} target="_blank" rel="noopener noreferrer">
                    <Card className="p-4 flex items-center gap-3 hover:shadow-md transition-shadow cursor-pointer">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center flex-shrink-0">
                        <ExternalLink className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-zinc-700">Google Drive</p>
                        <p className="text-xs text-zinc-400">View brief →</p>
                      </div>
                    </Card>
                  </a>
                ) : (
                  <Card className="p-4 flex items-center gap-3 opacity-50">
                    <div className="w-8 h-8 rounded-lg bg-zinc-300 flex items-center justify-center flex-shrink-0">
                      <ExternalLink className="w-4 h-4 text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-zinc-700">Google Drive</p>
                      <p className="text-xs text-zinc-400 truncate">{integrations?.driveError ? integrations.driveError.slice(0, 40) : 'Not connected'}</p>
                    </div>
                  </Card>
                )}
              </div>

              {/* KPIs */}
              {Array.isArray(brief?.kpis) && (brief.kpis as string[]).length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-sm">KPIs</CardTitle></CardHeader>
                  <CardContent>
                    <ul className="space-y-1.5">
                      {(brief.kpis as string[]).map((kpi, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm text-zinc-700">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                          {kpi}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Week plan */}
              {Array.isArray(brief?.weeks) && (brief.weeks as unknown[]).length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-sm">📅 4-Week Plan</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {(brief.weeks as Array<{
                        week: number; theme: string
                        milestones: Array<{ title: string; day_offset: number; description?: string }>
                      }>).map((week) => (
                        <div key={week.week} className="rounded-xl border border-zinc-100 overflow-hidden">
                          <div className="flex items-center gap-3 px-4 py-2.5 bg-zinc-50 border-b border-zinc-100">
                            <span className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                              {week.week}
                            </span>
                            <span className="text-sm font-semibold text-zinc-800">{week.theme}</span>
                          </div>
                          <div className="px-4 py-3 space-y-2">
                            {week.milestones.map((m, mi) => {
                              const globalIndex = (week.week - 1) * 10 + mi
                              const params = new URLSearchParams({
                                campaign_id: campaign!.id,
                                milestone_index: String(globalIndex),
                                campaign_name: campaign!.name,
                                milestone_title: m.title,
                                week_theme: week.theme,
                              })
                              return (
                              <div key={mi} className="space-y-0.5">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-start gap-2 min-w-0">
                                    <Circle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-blue-300" />
                                    <span className="text-sm font-medium text-zinc-700">{m.title}</span>
                                  </div>
                                  <a
                                    href={`/agents/creator?${params.toString()}`}
                                    className="flex-shrink-0 flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-800 border border-violet-200 hover:border-violet-400 rounded-lg px-2 py-1 bg-violet-50 hover:bg-violet-100 transition-colors"
                                  >
                                    <Sparkles className="w-3 h-3" /> Generate
                                  </a>
                                </div>
                                {m.description && (
                                  <p className="text-xs text-zinc-400 ml-5 leading-relaxed">{m.description}</p>
                                )}
                              </div>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          )}

          {!loading && !campaign && !error && (
            <div className="flex flex-col items-center justify-center py-24 text-zinc-400">
              <CalendarDays className="w-10 h-10 mb-3 opacity-20" />
              <p className="text-sm">Fill in campaign details and click Build Campaign</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
