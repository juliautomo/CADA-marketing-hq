'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { CalendarDays, ArrowRight, CheckCircle2, ExternalLink, Plus, X, Sparkles, Pencil, Check, Circle, Image, Video, Type, Mail, BookImage, Archive, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import type { Campaign, Product } from '@/types'

const channelOptions = ['Instagram', 'TikTok', 'Email', 'Pinterest', 'Facebook Ads', 'SMS', 'Influencer']

const DURATION_OPTIONS = [
  { value: 1, label: '1 week' },
  { value: 2, label: '2 weeks' },
  { value: 4, label: '4 weeks' },
  { value: 6, label: '6 weeks' },
  { value: 8, label: '8 weeks' },
]

const FREQUENCY_PRESETS = [3, 5, 7, 14]

const CONTENT_TYPES = ['image', 'video', 'caption', 'story', 'email'] as const
type ContentType = typeof CONTENT_TYPES[number]

const CONTENT_TYPE_META: Record<ContentType, { label: string; icon: React.ElementType; color: string }> = {
  image:   { label: 'Image',   icon: Image,     color: 'bg-emerald-500' },
  video:   { label: 'Video',   icon: Video,     color: 'bg-red-500' },
  caption: { label: 'Caption', icon: Type,      color: 'bg-violet-500' },
  story:   { label: 'Story',   icon: BookImage, color: 'bg-rose-500' },
  email:   { label: 'Email',   icon: Mail,      color: 'bg-amber-500' },
}

const STATUS_META = {
  not_started: { label: 'Not started', color: 'bg-zinc-100 text-zinc-500' },
  generated:   { label: 'Generated',   color: 'bg-blue-100 text-blue-700' },
  scheduled:   { label: 'Scheduled',   color: 'bg-violet-100 text-violet-700' },
  published:   { label: 'Published',   color: 'bg-emerald-100 text-emerald-700' },
}

type Post = {
  day_offset: number
  platform: string
  content_type: ContentType
  title: string
  description?: string
}

type EditableWeek = {
  week: number
  theme: string
  posts: Post[]
}

function CampaignPageInner() {
  const searchParams = useSearchParams()
  const [name, setName] = useState('')
  const [description, setDescription] = useState(() => searchParams.get('context') ?? '')
  const [startDate, setStartDate] = useState('')
  const [theme, setTheme] = useState(() => searchParams.get('theme') ?? '')
  const [budget, setBudget] = useState('')
  const [channels, setChannels] = useState<string[]>(['Instagram', 'TikTok'])
  const [durationWeeks, setDurationWeeks] = useState(4)
  const [postsPerWeek, setPostsPerWeek] = useState(5)

  const [products, setProducts] = useState<Product[]>([])
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([])

  useEffect(() => {
    fetch('/api/products').then(r => r.json()).then(d => setProducts(d.products ?? []))
  }, [])

  // Load latest active campaign on mount (skip if coming from trend handoff)
  useEffect(() => {
    if (searchParams.get('theme') || searchParams.get('context')) return
    fetch('/api/campaigns')
      .then(r => r.json())
      .then(async d => {
        const latest = (d.campaigns ?? []).find((c: Campaign) => c.status !== 'archived')
        if (!latest) return
        setCampaign(latest)
        const milRes = await fetch(`/api/campaigns/${latest.id}`)
        const milData = await milRes.json()
        setSavedMilestones(milData.milestones ?? [])
        const brief = (latest.brief ?? {}) as Record<string, unknown>
        setEditableSummary(typeof brief.summary === 'string' ? brief.summary : '')
        setEditableObjective(typeof brief.objective === 'string' ? brief.objective : '')
        // Reconstruct editableWeeks from brief so the content checklist renders
        if (Array.isArray(brief.weeks)) {
          const weeks = (brief.weeks as Array<Record<string, unknown>>).map(w => ({
            week: Number(w.week),
            theme: String(w.theme ?? ''),
            posts: (Array.isArray(w.posts) ? w.posts : []).map((p: Record<string, unknown>) => ({
              day_offset: Number(p.day_offset ?? 0),
              platform: String(p.platform ?? 'Instagram'),
              content_type: (p.content_type ?? 'image') as ContentType,
              title: String(p.title ?? ''),
              description: p.description ? String(p.description) : undefined,
            })),
          }))
          setEditableWeeks(weeks)
        }
        setIntegrations({
          calendar: (latest.calendar_event_ids?.length ?? 0) > 0,
          drive: !!latest.google_drive_url,
        })
        setStep('done')
      })
      .catch(() => { /* stay on form */ })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggleProduct(id: string) {
    setSelectedProductIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id])
  }

  const selectedProducts = products.filter(p => selectedProductIds.includes(p.id))

  const [step, setStep] = useState<'form' | 'previewing' | 'preview' | 'approving' | 'done'>('form')
  const [editableWeeks, setEditableWeeks] = useState<EditableWeek[]>([])
  const [editableSummary, setEditableSummary] = useState('')
  const [editableObjective, setEditableObjective] = useState('')
  const [editingCell, setEditingCell] = useState<{ wi: number; pi: number; field: string } | null>(null)
  const [brief, setBrief] = useState<Record<string, unknown>>({})

  const [isEditingDone, setIsEditingDone] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [savedMilestones, setSavedMilestones] = useState<Array<{
    id: string; title: string; due_date: string; platform?: string; content_type?: string;
    week_number: number; computed_status?: string; linked_content?: Array<{ id: string; image_url?: string }>
  }>>([])
  const [integrations, setIntegrations] = useState<{ calendar: boolean; drive: boolean; driveError?: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  function toggleChannel(ch: string) {
    setChannels(prev => prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch])
  }

  async function handlePreview() {
    if (!name || !description || !startDate) return
    setStep('previewing')
    setError(null)
    try {
      const res = await fetch('/api/agents/campaign/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, startDate, theme, budget, channels, durationWeeks, postsPerWeek, products: selectedProducts }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error ?? 'Failed')
      const b = data.brief as Record<string, unknown>
      setBrief(b)
      setEditableSummary(typeof b.summary === 'string' ? b.summary : '')
      setEditableObjective(typeof b.objective === 'string' ? b.objective : '')
      const weeks = Array.isArray(b.weeks) ? b.weeks as Array<{ week: number; theme: string; posts?: Post[]; milestones?: Post[] }> : []
      const parsedWeeks = weeks.map(w => ({
        week: w.week,
        theme: w.theme,
        posts: (w.posts ?? w.milestones ?? []) as Post[],
      }))
      const totalParsedPosts = parsedWeeks.reduce((sum, w) => sum + w.posts.length, 0)
      if (totalParsedPosts === 0) throw new Error('AI returned an empty calendar — please try again.')
      setEditableWeeks(parsedWeeks)
      setStep('preview')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setStep('form')
    }
  }

  async function handleApprove() {
    setStep('approving')
    setError(null)
    const approvedBrief = { ...brief, summary: editableSummary, objective: editableObjective, weeks: editableWeeks }
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
      // Load milestones with status
      const milRes = await fetch(`/api/campaigns/${data.campaign.id}`)
      const milData = await milRes.json()
      setSavedMilestones(milData.milestones ?? [])
      setStep('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setStep('preview')
    }
  }

  function updatePost(wi: number, pi: number, field: keyof Post, value: string) {
    setEditableWeeks(weeks => weeks.map((w, i) =>
      i !== wi ? w : { ...w, posts: w.posts.map((p, j) => j !== pi ? p : { ...p, [field]: value }) }
    ))
  }

  function removePost(wi: number, pi: number) {
    setEditableWeeks(weeks => weeks.map((w, i) =>
      i !== wi ? w : { ...w, posts: w.posts.filter((_, j) => j !== pi) }
    ))
  }

  function addPost(wi: number) {
    setEditableWeeks(weeks => weeks.map((w, i) =>
      i !== wi ? w : { ...w, posts: [...w.posts, { day_offset: wi * 7, platform: channels[0] ?? 'Instagram', content_type: 'image', title: 'New post' }] }
    ))
  }

  async function handleSavePlan() {
    if (!campaign) return
    setIsSaving(true)
    await fetch(`/api/campaigns/${campaign.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary: editableSummary, objective: editableObjective }),
    })
    setIsSaving(false)
    setIsEditingDone(false)
  }

  async function handleArchive() {
    if (!campaign) return
    if (!confirm('Archive this campaign? It will be hidden from the active view.')) return
    await fetch(`/api/campaigns/${campaign.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'archived' }),
    })
    // Reset to form for a new campaign
    setStep('form')
    setCampaign(null)
    setName('')
    setDescription('')
    setStartDate('')
    setTheme('')
    setEditableWeeks([])
    setIsEditingDone(false)
  }

  const formValid = !!(name && description && startDate)
  const totalPosts = editableWeeks.reduce((sum, w) => sum + w.posts.length, 0)

  // Build flat post list with global index for milestone linking
  function getGlobalIndex(wi: number, pi: number) {
    return editableWeeks.slice(0, wi).reduce((sum, w) => sum + w.posts.length, 0) + pi
  }

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
          <p className="text-sm text-zinc-500">Build a content calendar with Google Calendar and Drive brief</p>
        </div>
        <Badge variant="info">Google APIs</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left panel */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Campaign Details</CardTitle>
              <CardDescription>Fill in the details to generate your content calendar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1.5">Campaign Name *</label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Summer Solstice Drop" disabled={step !== 'form'} />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1.5">Description *</label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="Products, goals, audience?" rows={6} disabled={step !== 'form'} />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1.5">Start Date *</label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} disabled={step !== 'form'} />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1.5">Campaign Theme <span className="text-zinc-400">(optional)</span></label>
                <Input value={theme} onChange={e => setTheme(e.target.value)} placeholder="e.g. Coastal summer, Quiet luxury" disabled={step !== 'form'} />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1.5">Budget <span className="text-zinc-400">(optional)</span></label>
                <Input value={budget} onChange={e => setBudget(e.target.value)} placeholder="e.g. $5,000" disabled={step !== 'form'} />
              </div>

              {products.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-2">
                    Products <span className="text-zinc-400 font-normal">(optional)</span>
                    {selectedProductIds.length > 0 && <span className="ml-1 text-blue-600">{selectedProductIds.length} selected</span>}
                  </label>
                  <div className="space-y-1.5">
                    {products.map(p => {
                      const selected = selectedProductIds.includes(p.id)
                      return (
                        <button key={p.id} onClick={() => toggleProduct(p.id)} disabled={step !== 'form'}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-colors ${selected ? 'border-blue-400 bg-blue-50' : 'border-zinc-200 bg-white hover:border-zinc-300'}`}>
                          {p.image_url
                            ? <img src={p.image_url} alt={p.name} className="w-8 h-8 rounded object-cover flex-shrink-0" />
                            : <div className="w-8 h-8 rounded bg-zinc-100 flex-shrink-0" />}
                          <div className="min-w-0 flex-1">
                            <p className={`text-xs font-medium truncate ${selected ? 'text-blue-700' : 'text-zinc-700'}`}>{p.name}</p>
                            {p.category && <p className="text-[11px] text-zinc-400">{p.category}</p>}
                          </div>
                          <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${selected ? 'border-blue-500 bg-blue-500' : 'border-zinc-300'}`}>
                            {selected && <Check className="w-2.5 h-2.5 text-white" />}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-2">Duration</label>
                <div className="flex flex-wrap gap-1.5">
                  {DURATION_OPTIONS.map(d => (
                    <button key={d.value} onClick={() => setDurationWeeks(d.value)} disabled={step !== 'form'}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${durationWeeks === d.value ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'}`}>
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-2">
                  Posting Frequency
                  <span className="ml-1.5 font-bold text-zinc-900">{postsPerWeek}×/week</span>
                  <span className="ml-1 font-normal text-zinc-400">= {postsPerWeek * durationWeeks} total posts</span>
                </label>
                <input type="range" min={1} max={21} value={postsPerWeek}
                  onChange={e => setPostsPerWeek(Number(e.target.value))}
                  disabled={step !== 'form'}
                  className="w-full accent-blue-600 disabled:opacity-50" />
                <div className="flex justify-between mt-1.5">
                  {FREQUENCY_PRESETS.map(p => (
                    <button key={p} onClick={() => setPostsPerWeek(p)} disabled={step !== 'form'}
                      className={`text-xs px-2 py-0.5 rounded border transition-colors ${postsPerWeek === p ? 'bg-blue-600 text-white border-blue-600' : 'text-zinc-400 border-zinc-200 hover:border-zinc-400'}`}>
                      {p}×
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-2">Channels</label>
                <div className="flex flex-wrap gap-1.5">
                  {channelOptions.map(ch => (
                    <button key={ch} onClick={() => toggleChannel(ch)} disabled={step !== 'form'}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${channels.includes(ch) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'}`}>
                      {channels.includes(ch) ? <X className="w-2.5 h-2.5" /> : <Plus className="w-2.5 h-2.5" />}
                      {ch}
                    </button>
                  ))}
                </div>
              </div>

              {step === 'form' && (
                <Button onClick={handlePreview} disabled={!formValid} className="w-full" size="lg">
                  Preview Content Calendar <ArrowRight className="w-4 h-4" />
                </Button>
              )}
              {step === 'preview' && (
                <Button onClick={() => setStep('form')} variant="secondary" className="w-full" size="sm">
                  ← Edit Details
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right panel */}
        <div className="lg:col-span-2 space-y-5">

          {(step === 'previewing' || step === 'approving') && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <div className="text-center">
                  <p className="text-sm text-zinc-700 font-medium">
                    {step === 'previewing' ? 'Generating your content calendar…' : 'Creating Calendar events and Drive brief…'}
                  </p>
                  <p className="text-xs text-zinc-400 mt-1">
                    {step === 'previewing' ? `Planning ${durationWeeks} weeks · ${postsPerWeek}×/week` : 'Saving campaign and creating events…'}
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

          {/* ── PREVIEW — review & edit ── */}
          {step === 'preview' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-sm font-semibold text-amber-800">Review your content calendar</p>
                <p className="text-xs text-amber-600 mt-0.5">{totalPosts} posts planned. Edit titles, types, or platforms. Remove posts you don&apos;t need. Approve when ready.</p>
              </div>

              {/* Summary / Objective editable */}
              <Card>
                <CardContent className="pt-5 space-y-3">
                  <h2 className="font-bold text-zinc-900">{name}</h2>
                  <div>
                    <p className="text-xs font-semibold text-zinc-400 mb-1">Summary</p>
                    <Textarea value={editableSummary} onChange={e => setEditableSummary(e.target.value)} rows={5} className="text-sm" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-zinc-400 mb-1">Objective</p>
                    <Textarea value={editableObjective} onChange={e => setEditableObjective(e.target.value)} rows={2} className="text-sm" />
                  </div>
                  {Array.isArray(brief?.kpis) && (
                    <div>
                      <p className="text-xs font-semibold text-zinc-400 mb-1.5">KPIs</p>
                      <ul className="space-y-1">
                        {(brief.kpis as string[]).map((kpi, i) => (
                          <li key={i} className="flex items-center gap-2 text-xs text-zinc-600">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" /> {kpi}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Editable content calendar per week */}
              {editableWeeks.map((week, wi) => (
                <Card key={wi}>
                  <CardHeader className="pb-3 border-b border-zinc-100">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="flex-shrink-0 text-center">
                          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-bold text-sm flex items-center justify-center">{week.week}</div>
                          <p className="text-[10px] text-zinc-400 mt-0.5 font-medium">WEEK</p>
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-wider mb-0.5">Theme</p>
                          {editingCell?.wi === wi && editingCell?.field === 'theme' ? (
                            <input autoFocus value={week.theme}
                              onChange={e => setEditableWeeks(weeks => weeks.map((w, i) => i !== wi ? w : { ...w, theme: e.target.value }))}
                              onBlur={() => setEditingCell(null)}
                              onKeyDown={e => e.key === 'Enter' && setEditingCell(null)}
                              className="w-full text-sm font-semibold border border-blue-300 rounded px-2 py-0.5 outline-none" />
                          ) : (
                            <button onClick={() => setEditingCell({ wi, pi: -1, field: 'theme' })}
                              className="text-left text-sm font-semibold text-zinc-800 hover:text-blue-600 flex items-center gap-1 group w-full">
                              <span>{week.theme}</span>
                              <Pencil className="w-3 h-3 flex-shrink-0 opacity-0 group-hover:opacity-40" />
                            </button>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-zinc-400 flex-shrink-0 pt-1">{week.posts.length} posts</span>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-2">
                    {week.posts.map((post, pi) => {
                      const typeMeta = CONTENT_TYPE_META[post.content_type] ?? CONTENT_TYPE_META.image
                      const TypeIcon = typeMeta.icon
                      return (
                        <div key={pi} className="flex items-center gap-2 rounded-lg border border-zinc-100 p-2.5 hover:border-zinc-200 group">
                          {/* Type icon */}
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${typeMeta.color}`}>
                            <TypeIcon className="w-3.5 h-3.5 text-white" />
                          </div>
                          {/* Title */}
                          <div className="flex-1 min-w-0">
                            {editingCell?.wi === wi && editingCell?.pi === pi && editingCell?.field === 'title' ? (
                              <input autoFocus value={post.title}
                                onChange={e => updatePost(wi, pi, 'title', e.target.value)}
                                onBlur={() => setEditingCell(null)}
                                onKeyDown={e => e.key === 'Enter' && setEditingCell(null)}
                                className="w-full text-sm font-medium border border-blue-300 rounded px-2 py-0.5 outline-none" />
                            ) : (
                              <button onClick={() => setEditingCell({ wi, pi, field: 'title' })}
                                className="text-left text-sm font-medium text-zinc-700 hover:text-blue-600 truncate w-full flex items-center gap-1 group/t">
                                <span className="truncate">{post.title}</span>
                                <Pencil className="w-3 h-3 flex-shrink-0 opacity-0 group-hover/t:opacity-40" />
                              </button>
                            )}
                          </div>
                          {/* Platform picker */}
                          <select value={post.platform} onChange={e => updatePost(wi, pi, 'platform', e.target.value)}
                            className="text-xs border border-zinc-200 rounded px-1.5 py-1 text-zinc-600 bg-white flex-shrink-0">
                            {channelOptions.map(ch => <option key={ch}>{ch}</option>)}
                          </select>
                          {/* Type picker */}
                          <select value={post.content_type} onChange={e => updatePost(wi, pi, 'content_type', e.target.value as ContentType)}
                            className="text-xs border border-zinc-200 rounded px-1.5 py-1 text-zinc-600 bg-white flex-shrink-0">
                            {CONTENT_TYPES.map(t => <option key={t} value={t}>{CONTENT_TYPE_META[t].label}</option>)}
                          </select>
                          {/* Remove */}
                          <button onClick={() => removePost(wi, pi)}
                            className="opacity-0 group-hover:opacity-100 text-zinc-300 hover:text-red-400 transition-all flex-shrink-0">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )
                    })}
                    <button onClick={() => addPost(wi)}
                      className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-blue-600 py-1 px-2.5 transition-colors">
                      <Plus className="w-3.5 h-3.5" /> Add post
                    </button>
                  </CardContent>
                </Card>
              ))}

              <Button onClick={handleApprove} className="w-full bg-blue-600 hover:bg-blue-700 text-white" size="lg">
                Approve & Create Calendar + Drive Brief <ArrowRight className="w-4 h-4" />
              </Button>
            </motion.div>
          )}

          {/* ── DONE — approved campaign with checklist ── */}
          {step === 'done' && campaign && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              {/* Overview card */}
              <Card className="border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50">
                <CardContent className="pt-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-bold text-zinc-900 text-lg">{campaign.name}</h2>
                      <p className="text-xs text-zinc-500 mt-0.5">{formatDate(campaign.start_date)} → {formatDate(campaign.end_date)} · {totalPosts} posts</p>
                    </div>
                    <Badge variant="info">Active</Badge>
                  </div>
                  {isEditingDone ? (
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs font-semibold text-zinc-400 mb-1">Summary</p>
                        <Textarea value={editableSummary} onChange={e => setEditableSummary(e.target.value)} rows={4} className="text-sm bg-white" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-zinc-400 mb-1">Objective</p>
                        <Textarea value={editableObjective} onChange={e => setEditableObjective(e.target.value)} rows={2} className="text-sm bg-white" />
                      </div>
                    </div>
                  ) : (
                    editableSummary && <p className="text-sm text-zinc-700 leading-relaxed">{editableSummary}</p>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    {isEditingDone ? (
                      <>
                        <Button onClick={handleSavePlan} loading={isSaving} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                          <Save className="w-3.5 h-3.5" /> Save Plan
                        </Button>
                        <Button onClick={() => setIsEditingDone(false)} variant="secondary" size="sm">Cancel</Button>
                      </>
                    ) : (
                      <Button onClick={() => setIsEditingDone(true)} variant="secondary" size="sm">
                        <Pencil className="w-3.5 h-3.5" /> Edit Plan
                      </Button>
                    )}
                    <Button onClick={handleArchive} variant="secondary" size="sm" className="ml-auto text-zinc-400 hover:text-red-500">
                      <Archive className="w-3.5 h-3.5" /> Archive
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Integrations */}
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
                      <div><p className="text-xs font-medium text-zinc-700">Google Drive</p><p className="text-xs text-zinc-400">View brief →</p></div>
                    </Card>
                  </a>
                ) : (
                  <Card className="p-4 flex items-center gap-3 opacity-50">
                    <div className="w-8 h-8 rounded-lg bg-zinc-300 flex items-center justify-center flex-shrink-0">
                      <ExternalLink className="w-4 h-4 text-white" />
                    </div>
                    <div><p className="text-xs font-medium text-zinc-700">Google Drive</p><p className="text-xs text-zinc-400">{integrations?.driveError ? 'Not connected' : 'Not connected'}</p></div>
                  </Card>
                )}
              </div>

              {/* Content checklist per week */}
              {editableWeeks.map((week, wi) => {
                const weekMilestones = savedMilestones.filter(m => m.week_number === week.week)
                return (
                  <Card key={wi}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center">{week.week}</span>
                        <CardTitle className="text-sm">{week.theme}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-2">
                      {week.posts.map((post, pi) => {
                        const globalIndex = getGlobalIndex(wi, pi)
                        const milestone = weekMilestones[pi] ?? savedMilestones[globalIndex]
                        const status = (milestone?.computed_status ?? 'not_started') as keyof typeof STATUS_META
                        const statusMeta = STATUS_META[status]
                        const typeMeta = CONTENT_TYPE_META[post.content_type] ?? CONTENT_TYPE_META.image
                        const TypeIcon = typeMeta.icon
                        const hasContent = status !== 'not_started'

                        const params = new URLSearchParams({
                          campaign_id: campaign.id,
                          milestone_index: String(globalIndex),
                          campaign_name: campaign.name,
                          milestone_title: post.title,
                          week_theme: week.theme,
                          task: post.content_type,
                          platform: post.platform,
                        })

                        return (
                          <div key={pi} className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${hasContent ? 'border-emerald-100 bg-emerald-50/50' : 'border-zinc-100'}`}>
                            {hasContent
                              ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                              : <Circle className="w-4 h-4 text-zinc-300 flex-shrink-0" />}
                            <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${typeMeta.color}`}>
                              <TypeIcon className="w-3 h-3 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-zinc-700 truncate">{post.title}</p>
                              <p className="text-xs text-zinc-400">{post.platform} · {typeMeta.label}</p>
                            </div>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${statusMeta.color}`}>
                              {statusMeta.label}
                            </span>
                            <a href={`/agents/creator?${params.toString()}`}
                              className="flex-shrink-0 flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-800 border border-violet-200 hover:border-violet-400 rounded-lg px-2 py-1 bg-violet-50 hover:bg-violet-100 transition-colors">
                              <Sparkles className="w-3 h-3" /> {hasContent ? 'Regenerate' : 'Generate'}
                            </a>
                          </div>
                        )
                      })}
                    </CardContent>
                  </Card>
                )
              })}
            </motion.div>
          )}

          {step === 'form' && (
            <div className="flex flex-col items-center justify-center py-24 text-zinc-400">
              <CalendarDays className="w-10 h-10 mb-3 opacity-20" />
              <p className="text-sm">Fill in campaign details and click Preview Content Calendar</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function CampaignPage() {
  return (
    <Suspense>
      <CampaignPageInner />
    </Suspense>
  )
}
