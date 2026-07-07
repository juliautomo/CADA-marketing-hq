'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { CalendarDays, ArrowRight, CheckCircle2, Circle, ExternalLink, Plus, X, Sparkles, Pencil, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import type { Campaign } from '@/types'

const channelOptions = ['Instagram', 'TikTok', 'Email', 'Pinterest', 'Facebook Ads', 'Google Ads', 'SMS', 'Influencer']

const DURATION_OPTIONS = [
  { value: 1, label: '1 week' },
  { value: 2, label: '2 weeks' },
  { value: 4, label: '4 weeks' },
  { value: 6, label: '6 weeks' },
  { value: 8, label: '8 weeks' },
]

const FREQUENCY_OPTIONS = [
  { value: 3,  label: '3×/week',   sub: 'Mon · Wed · Fri' },
  { value: 5,  label: '5×/week',   sub: 'Weekdays' },
  { value: 7,  label: 'Daily',     sub: '7×/week' },
  { value: 14, label: '2× daily',  sub: '14×/week' },
]

type EditableWeek = {
  week: number
  theme: string
  milestones: Array<{ title: string; day_offset: number; description?: string }>
}

export default function CampaignPage() {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [theme, setTheme] = useState('')
  const [budget, setBudget] = useState('')
  const [channels, setChannels] = useState<string[]>(['Instagram', 'Email', 'TikTok'])
  const [durationWeeks, setDurationWeeks] = useState(4)
  const [postsPerWeek, setPostsPerWeek] = useState(5)

  // Two-step state
  const [step, setStep] = useState<'form' | 'previewing' | 'preview' | 'approving' | 'done'>('form')
  const [editableWeeks, setEditableWeeks] = useState<EditableWeek[]>([])
  const [editableSummary, setEditableSummary] = useState('')
  const [editableObjective, setEditableObjective] = useState('')
  const [editingMilestone, setEditingMilestone] = useState<{ wi: number; mi: number } | null>(null)
  const [editingWeekTheme, setEditingWeekTheme] = useState<number | null>(null)
  const [brief, setBrief] = useState<Record<string, unknown>>({})

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [integrations, setIntegrations] = useState<{ calendar: boolean; drive: boolean; driveError?: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  function toggleChannel(ch: string) {
    setChannels((prev) => prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch])
  }

  async function handlePreview() {
    if (!name || !description || !startDate) return
    setStep('previewing')
    setError(null)
    try {
      const res = await fetch('/api/agents/campaign/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, startDate, theme, budget, channels, durationWeeks, postsPerWeek }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error ?? 'Failed')
      const b = data.brief as Record<string, unknown>
      setBrief(b)
      setEditableSummary(typeof b.summary === 'string' ? b.summary : '')
      setEditableObjective(typeof b.objective === 'string' ? b.objective : '')
      setEditableWeeks(Array.isArray(b.weeks) ? (b.weeks as EditableWeek[]) : [])
      setStep('preview')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setStep('form')
    }
  }

  async function handleApprove() {
    setStep('approving')
    setError(null)
    // Merge edits back into brief
    const approvedBrief = {
      ...brief,
      summary: editableSummary,
      objective: editableObjective,
      weeks: editableWeeks,
    }
    try {
      const res = await fetch('/api/agents/campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, startDate, theme, budget, channels, durationWeeks, postsPerWeek, brief: approvedBrief }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error ?? 'Failed')
      setCampaign(data.campaign)
      setIntegrations({ calendar: data.calendarOk, drive: data.driveOk, driveError: data.driveError })
      setStep('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setStep('preview')
    }
  }

  function updateMilestoneTitle(wi: number, mi: number, value: string) {
    setEditableWeeks(weeks => weeks.map((w, i) =>
      i !== wi ? w : { ...w, milestones: w.milestones.map((m, j) => j !== mi ? m : { ...m, title: value }) }
    ))
  }

  function updateWeekTheme(wi: number, value: string) {
    setEditableWeeks(weeks => weeks.map((w, i) => i !== wi ? w : { ...w, theme: value }))
  }

  const formValid = !!(name && description && startDate)

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
          <p className="text-sm text-zinc-500">Build campaigns with Google Calendar events and Drive briefs</p>
        </div>
        <Badge variant="info">Google APIs</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls — always visible */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Campaign Details</CardTitle>
              <CardDescription>Fill in the details to generate your plan</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1.5">Campaign Name *</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Summer Solstice Drop" disabled={step !== 'form'} />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1.5">Description *</label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is this campaign about? Products, goals, audience?" rows={3} disabled={step !== 'form'} />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1.5">Start Date *</label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={step !== 'form'} />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1.5">Campaign Theme <span className="text-zinc-400">(optional)</span></label>
                <Input value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="e.g. Coastal summer, Quiet luxury" disabled={step !== 'form'} />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1.5">Budget <span className="text-zinc-400">(optional)</span></label>
                <Input value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="e.g. $5,000" disabled={step !== 'form'} />
              </div>

              {/* Duration */}
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-2">Duration</label>
                <div className="flex flex-wrap gap-1.5">
                  {DURATION_OPTIONS.map((d) => (
                    <button key={d.value} onClick={() => setDurationWeeks(d.value)} disabled={step !== 'form'}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        durationWeeks === d.value ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'
                      }`}>
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Posting frequency */}
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-2">Posting Frequency</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {FREQUENCY_OPTIONS.map((f) => (
                    <button key={f.value} onClick={() => setPostsPerWeek(f.value)} disabled={step !== 'form'}
                      className={`px-2.5 py-2 rounded-lg text-left border transition-colors ${
                        postsPerWeek === f.value ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'
                      }`}>
                      <p className={`text-xs font-semibold ${postsPerWeek === f.value ? 'text-white' : 'text-zinc-800'}`}>{f.label}</p>
                      <p className={`text-[11px] ${postsPerWeek === f.value ? 'text-white/70' : 'text-zinc-400'}`}>{f.sub}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Channels */}
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-2">Channels</label>
                <div className="flex flex-wrap gap-1.5">
                  {channelOptions.map((ch) => (
                    <button key={ch} onClick={() => toggleChannel(ch)} disabled={step !== 'form'}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                        channels.includes(ch) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'
                      }`}>
                      {channels.includes(ch) ? <X className="w-2.5 h-2.5" /> : <Plus className="w-2.5 h-2.5" />}
                      {ch}
                    </button>
                  ))}
                </div>
              </div>

              {step === 'form' && (
                <Button onClick={handlePreview} disabled={!formValid} className="w-full" size="lg">
                  Preview Plan <ArrowRight className="w-4 h-4" />
                </Button>
              )}
              {step === 'preview' && (
                <Button onClick={() => setStep('form')} variant="outline" className="w-full" size="sm">
                  ← Edit Details
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Results */}
        <div className="lg:col-span-2 space-y-5">

          {/* Loading states */}
          {(step === 'previewing' || step === 'approving') && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <div className="text-center">
                  <p className="text-sm text-zinc-700 font-medium">
                    {step === 'previewing' ? 'Generating your campaign plan…' : 'Creating Calendar events and Drive brief…'}
                  </p>
                  <p className="text-xs text-zinc-400 mt-1">
                    {step === 'previewing' ? 'AI is building your week-by-week plan' : 'Almost done…'}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-100 p-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Preview — review & edit */}
          {step === 'preview' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-amber-800">Review your plan</p>
                  <p className="text-xs text-amber-600 mt-0.5">Click any milestone title or week theme to edit. Approve when ready to create Calendar events and Drive brief.</p>
                </div>
                <Button onClick={handleApprove} size="sm" className="flex-shrink-0 bg-blue-600 hover:bg-blue-700 text-white">
                  Approve & Create <Check className="w-3.5 h-3.5" />
                </Button>
              </div>

              {/* Overview */}
              <Card>
                <CardContent className="pt-5 space-y-3">
                  <h2 className="font-bold text-zinc-900 text-lg">{name}</h2>
                  <div>
                    <p className="text-xs font-semibold text-zinc-400 mb-1">Summary</p>
                    <Textarea value={editableSummary} onChange={e => setEditableSummary(e.target.value)} rows={2}
                      className="text-sm text-zinc-700 resize-none" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-zinc-400 mb-1">Objective</p>
                    <Input value={editableObjective} onChange={e => setEditableObjective(e.target.value)}
                      className="text-sm text-zinc-700" />
                  </div>
                  {Array.isArray(brief?.kpis) && (brief.kpis as string[]).length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-zinc-400 mb-1.5">KPIs</p>
                      <ul className="space-y-1">
                        {(brief.kpis as string[]).map((kpi, i) => (
                          <li key={i} className="flex items-center gap-2 text-sm text-zinc-600">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" /> {kpi}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Editable week plan */}
              <Card>
                <CardHeader><CardTitle className="text-sm">📅 {durationWeeks}-Week Plan <span className="text-zinc-400 font-normal ml-1">· {postsPerWeek}×/week</span></CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {editableWeeks.map((week, wi) => (
                      <div key={wi} className="rounded-xl border border-zinc-100 overflow-hidden">
                        {/* Week header — editable theme */}
                        <div className="flex items-center gap-3 px-4 py-2.5 bg-zinc-50 border-b border-zinc-100">
                          <span className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                            {week.week}
                          </span>
                          {editingWeekTheme === wi ? (
                            <input
                              autoFocus
                              value={week.theme}
                              onChange={e => updateWeekTheme(wi, e.target.value)}
                              onBlur={() => setEditingWeekTheme(null)}
                              onKeyDown={e => e.key === 'Enter' && setEditingWeekTheme(null)}
                              className="flex-1 text-sm font-semibold text-zinc-800 bg-white border border-blue-300 rounded px-2 py-0.5 outline-none"
                            />
                          ) : (
                            <button onClick={() => setEditingWeekTheme(wi)}
                              className="flex-1 text-left text-sm font-semibold text-zinc-800 hover:text-blue-600 flex items-center gap-1.5 group">
                              {week.theme}
                              <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-40 transition-opacity" />
                            </button>
                          )}
                        </div>
                        {/* Milestones */}
                        <div className="px-4 py-3 space-y-2">
                          {week.milestones.map((m, mi) => {
                            const globalIndex = wi * 10 + mi
                            const isEditing = editingMilestone?.wi === wi && editingMilestone?.mi === mi
                            const params = new URLSearchParams({
                              campaign_id: campaign?.id ?? 'pending',
                              milestone_index: String(globalIndex),
                              campaign_name: name,
                              milestone_title: m.title,
                              week_theme: week.theme,
                            })
                            return (
                              <div key={mi} className="space-y-0.5">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-start gap-2 min-w-0 flex-1">
                                    <Circle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-blue-300" />
                                    {isEditing ? (
                                      <input
                                        autoFocus
                                        value={m.title}
                                        onChange={e => updateMilestoneTitle(wi, mi, e.target.value)}
                                        onBlur={() => setEditingMilestone(null)}
                                        onKeyDown={e => e.key === 'Enter' && setEditingMilestone(null)}
                                        className="flex-1 text-sm font-medium text-zinc-700 bg-white border border-blue-300 rounded px-2 py-0.5 outline-none"
                                      />
                                    ) : (
                                      <button onClick={() => setEditingMilestone({ wi, mi })}
                                        className="text-left text-sm font-medium text-zinc-700 hover:text-blue-600 flex items-center gap-1.5 group">
                                        {m.title}
                                        <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-40 transition-opacity flex-shrink-0" />
                                      </button>
                                    )}
                                  </div>
                                  <a href={`/agents/creator?${params.toString()}`}
                                    className="flex-shrink-0 flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-800 border border-violet-200 hover:border-violet-400 rounded-lg px-2 py-1 bg-violet-50 hover:bg-violet-100 transition-colors">
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

              <Button onClick={handleApprove} className="w-full bg-blue-600 hover:bg-blue-700 text-white" size="lg">
                Approve & Create Calendar + Drive Brief <ArrowRight className="w-4 h-4" />
              </Button>
            </motion.div>
          )}

          {/* Done — approved campaign */}
          {step === 'done' && campaign && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <Card className="border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50">
                <CardContent className="pt-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="font-bold text-zinc-900 text-lg">{campaign.name}</h2>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {formatDate(campaign.start_date)} → {formatDate(campaign.end_date)}
                      </p>
                    </div>
                    <Badge variant="info">Created ✓</Badge>
                  </div>
                  {editableSummary && <p className="text-sm text-zinc-700 leading-relaxed">{editableSummary}</p>}
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Card className={`p-4 flex items-center gap-3 ${integrations?.calendar ? '' : 'opacity-50'}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${integrations?.calendar ? 'bg-blue-500' : 'bg-zinc-300'}`}>
                    <CalendarDays className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-zinc-700">Google Calendar</p>
                    <p className="text-xs text-zinc-400">{integrations?.calendar ? `${campaign.calendar_event_ids?.length ?? durationWeeks} events added ✓` : 'Not connected'}</p>
                  </div>
                </Card>

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

              {/* Final week plan — read-only */}
              <Card>
                <CardHeader><CardTitle className="text-sm">📅 {durationWeeks}-Week Plan</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {editableWeeks.map((week, wi) => (
                      <div key={wi} className="rounded-xl border border-zinc-100 overflow-hidden">
                        <div className="flex items-center gap-3 px-4 py-2.5 bg-zinc-50 border-b border-zinc-100">
                          <span className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                            {week.week}
                          </span>
                          <span className="text-sm font-semibold text-zinc-800">{week.theme}</span>
                        </div>
                        <div className="px-4 py-3 space-y-2">
                          {week.milestones.map((m, mi) => {
                            const globalIndex = wi * 10 + mi
                            const params = new URLSearchParams({
                              campaign_id: campaign.id,
                              milestone_index: String(globalIndex),
                              campaign_name: campaign.name,
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
                                  <a href={`/agents/creator?${params.toString()}`}
                                    className="flex-shrink-0 flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-800 border border-violet-200 hover:border-violet-400 rounded-lg px-2 py-1 bg-violet-50 hover:bg-violet-100 transition-colors">
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
            </motion.div>
          )}

          {step === 'form' && (
            <div className="flex flex-col items-center justify-center py-24 text-zinc-400">
              <CalendarDays className="w-10 h-10 mb-3 opacity-20" />
              <p className="text-sm">Fill in campaign details and click Preview Plan</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
