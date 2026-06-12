'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  TrendingUp, CalendarDays, BarChart3, FileText,
  Image, Palette, Layers, ExternalLink, ChevronDown,
  ChevronUp, Type, Mail, Video, Layout, LayoutGrid, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate, formatRelativeTime } from '@/lib/utils'
import type { TrendReport, Campaign, PerformanceReport, ContentItem } from '@/types'

type Tab = 'all' | 'content' | 'trends' | 'campaigns' | 'reports'

// Map content type → icon + colour
const CONTENT_TYPE_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  caption:      { label: 'Caption',      color: 'bg-violet-500', icon: Type },
  description:  { label: 'Description',  color: 'bg-blue-500',   icon: FileText },
  email:        { label: 'Email',        color: 'bg-amber-500',  icon: Mail },
  image:        { label: 'AI Image',     color: 'bg-emerald-500',icon: Image },
  video:        { label: 'Video',        color: 'bg-red-500',    icon: Video },
  canva:        { label: 'Canva',        color: 'bg-pink-500',   icon: Layout },
  canva_template:{ label: 'Canva',       color: 'bg-pink-500',   icon: Layout },
}

function ContentTypeBadge({ type }: { type: string }) {
  const meta = CONTENT_TYPE_META[type] ?? { label: type, color: 'bg-zinc-500', icon: FileText }
  const Icon = meta.icon
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium text-white px-2 py-0.5 rounded-full ${meta.color}`}>
      <Icon className="w-2.5 h-2.5" /> {meta.label}
    </span>
  )
}

export default function HistoryPage() {
  const [tab, setTab]             = useState<Tab>('all')
  const [trends, setTrends]       = useState<TrendReport[]>([])
  const [content, setContent]     = useState<ContentItem[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [reports, setReports]     = useState<PerformanceReport[]>([])
  const [loading, setLoading]     = useState(true)
  const [expanded, setExpanded]   = useState<string | null>(null)
  const [contentPage, setContentPage] = useState(1)
  const [allPage, setAllPage]         = useState(1)
  const PAGE_SIZE = 10

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [t, c, camp, r] = await Promise.all([
        fetch('/api/trends').then(r => r.json()),
        fetch('/api/content-library').then(r => r.json()),
        fetch('/api/campaigns').then(r => r.json()),
        fetch('/api/reports').then(r => r.json()),
      ])
      setTrends(t.reports ?? [])
      setContent(c.items ?? [])
      setCampaigns(camp.campaigns ?? [])
      setReports(r.reports ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const totalAll = trends.length + content.length + campaigns.length + reports.length

  const tabs: { id: Tab; label: string; icon: React.ElementType; count: number }[] = [
    { id: 'all',       label: 'All',            icon: LayoutGrid,  count: totalAll },
    { id: 'content',   label: 'Content',        icon: Image,       count: content.length },
    { id: 'trends',    label: 'Trend Reports',  icon: TrendingUp,  count: trends.length },
    { id: 'campaigns', label: 'Campaigns',      icon: CalendarDays,count: campaigns.length },
    { id: 'reports',   label: 'Perf. Reports',  icon: BarChart3,   count: reports.length },
  ]

  // Merge all items for the "All" tab, sorted by date
  type AllItem =
    | { kind: 'content';  data: ContentItem;       date: string }
    | { kind: 'trend';    data: TrendReport;        date: string }
    | { kind: 'campaign'; data: Campaign;           date: string }
    | { kind: 'report';   data: PerformanceReport;  date: string }

  const allItems: AllItem[] = [
    ...content.map(d   => ({ kind: 'content'  as const, data: d, date: d.created_at })),
    ...trends.map(d    => ({ kind: 'trend'    as const, data: d, date: d.created_at })),
    ...campaigns.map(d => ({ kind: 'campaign' as const, data: d, date: d.created_at })),
    ...reports.map(d   => ({ kind: 'report'   as const, data: d, date: d.created_at })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">History</h1>
        <p className="text-sm text-zinc-500 mt-1">Everything your AI agents have created</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-200 overflow-x-auto pb-0">
        {tabs.map(({ id, label, icon: Icon, count }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap -mb-px ${
              tab === id
                ? 'border-zinc-900 text-zinc-900'
                : 'border-transparent text-zinc-500 hover:text-zinc-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
            <span className={`rounded-full px-1.5 py-0.5 text-xs ${tab === id ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600'}`}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-zinc-300 border-t-zinc-700 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">

          {/* ── ALL ── */}
          {tab === 'all' && (() => {
            if (allItems.length === 0) return <Empty label="Nothing yet — run an agent to get started" />
            const totalPages = Math.ceil(allItems.length / PAGE_SIZE)
            const paged = allItems.slice((allPage - 1) * PAGE_SIZE, allPage * PAGE_SIZE)
            return (
              <div className="space-y-2">
                <div className="divide-y divide-zinc-100 border border-zinc-100 rounded-xl overflow-hidden">
                  {paged.map((item, i) => (
                    <motion.div key={`${item.kind}-${item.data.id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}>
                      {item.kind === 'content'  && <ContentRow   item={item.data} />}
                      {item.kind === 'trend'    && <TrendCard    item={item.data} expanded={expanded} setExpanded={setExpanded} />}
                      {item.kind === 'campaign' && <CampaignCard item={item.data} expanded={expanded} setExpanded={setExpanded} />}
                      {item.kind === 'report'   && <ReportCard   item={item.data} expanded={expanded} setExpanded={setExpanded} />}
                    </motion.div>
                  ))}
                </div>
                <Pagination page={allPage} totalPages={totalPages} total={allItems.length} pageSize={PAGE_SIZE} onChange={setAllPage} />
              </div>
            )
          })()}

          {/* ── CONTENT ── */}
          {tab === 'content' && (() => {
            if (content.length === 0) return <Empty label="No content yet — try the Content Creator" />
            const totalPages = Math.ceil(content.length / PAGE_SIZE)
            const paged = content.slice((contentPage - 1) * PAGE_SIZE, contentPage * PAGE_SIZE)
            return (
              <div className="space-y-2">
                <div className="divide-y divide-zinc-100 border border-zinc-100 rounded-xl overflow-hidden">
                  {paged.map((item, i) => (
                    <motion.div key={item.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}>
                      <ContentRow item={item} />
                    </motion.div>
                  ))}
                </div>
                <Pagination page={contentPage} totalPages={totalPages} total={content.length} pageSize={PAGE_SIZE} onChange={setContentPage} />
              </div>
            )
          })()}

          {/* ── TRENDS ── */}
          {tab === 'trends' && (
            trends.length === 0 ? <Empty label="No trend reports yet" /> :
            trends.map((r, i) => (
              <motion.div key={r.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <TrendCard item={r} expanded={expanded} setExpanded={setExpanded} />
              </motion.div>
            ))
          )}

          {/* ── CAMPAIGNS ── */}
          {tab === 'campaigns' && (
            campaigns.length === 0 ? <Empty label="No campaigns yet" /> :
            campaigns.map((c, i) => (
              <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <CampaignCard item={c} expanded={expanded} setExpanded={setExpanded} />
              </motion.div>
            ))
          )}

          {/* ── REPORTS ── */}
          {tab === 'reports' && (
            reports.length === 0 ? <Empty label="No performance reports yet" /> :
            reports.map((r, i) => (
              <motion.div key={r.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <ReportCard item={r} expanded={expanded} setExpanded={setExpanded} />
              </motion.div>
            ))
          )}

        </div>
      )}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Pagination({ page, totalPages, total, pageSize, onChange }: { page: number; totalPages: number; total: number; pageSize: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between pt-1">
      <p className="text-xs text-zinc-400">{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total} items</p>
      <div className="flex items-center gap-1">
        <Button variant="secondary" size="sm" onClick={() => onChange(page - 1)} disabled={page === 1}><ChevronLeft className="w-4 h-4" /></Button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
          <Button key={p} variant={p === page ? 'primary' : 'secondary'} size="sm" onClick={() => onChange(p)} className="w-8">{p}</Button>
        ))}
        <Button variant="secondary" size="sm" onClick={() => onChange(page + 1)} disabled={page === totalPages}><ChevronRight className="w-4 h-4" /></Button>
      </div>
    </div>
  )
}

function ContentRow({ item }: { item: ContentItem }) {
  const meta = CONTENT_TYPE_META[item.type] ?? { label: item.type, color: 'bg-zinc-500', icon: FileText }
  const Icon = meta.icon
  return (
    <div className="flex items-start gap-4 px-4 py-3 bg-white hover:bg-zinc-50 transition-colors">
      <span className={`flex-shrink-0 inline-flex items-center gap-1 text-xs font-medium text-white px-2 py-1 rounded-full mt-0.5 ${meta.color}`}>
        <Icon className="w-3 h-3" /> {meta.label}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-800 truncate">{item.title}</p>
        {item.body && <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1">{item.body}</p>}
        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {item.tags.map((tag) => <Badge key={tag} variant="default" className="text-xs">{tag}</Badge>)}
          </div>
        )}
      </div>
      {item.image_url && <img src={item.image_url} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />}
      {item.video_url && <video src={item.video_url} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />}
      <div className="flex-shrink-0 flex flex-col items-end gap-1">
        <span className="text-xs text-zinc-400 whitespace-nowrap">{formatRelativeTime(item.created_at)}</span>
        {item.canva_url && (
          <a href={item.canva_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
            Canva <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  )
}

function ContentCard({ item }: { item: ContentItem }) {
  return (
    <Card className="h-full hover:shadow-sm transition-shadow">
      {item.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.image_url} alt={item.title} className="w-full aspect-square object-cover rounded-t-2xl" />
      )}
      {item.video_url && (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video src={item.video_url} className="w-full aspect-video object-cover rounded-t-2xl bg-zinc-900" muted />
      )}
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between mb-2">
          <ContentTypeBadge type={item.type} />
          <span className="text-xs text-zinc-400">{formatRelativeTime(item.created_at)}</span>
        </div>
        <p className="text-sm font-medium text-zinc-800 mb-1 line-clamp-1">{item.title}</p>
        {item.body && <p className="text-xs text-zinc-500 line-clamp-3 leading-relaxed">{item.body}</p>}
        {item.canva_url && (
          <a href={item.canva_url} target="_blank" rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs text-pink-600 hover:underline">
            Open in Canva <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </CardContent>
    </Card>
  )
}

function TrendCard({ item: r, expanded, setExpanded }: { item: TrendReport; expanded: string | null; setExpanded: (id: string | null) => void }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="info">Trend Report</Badge>
              <span className="text-xs text-zinc-400">{formatRelativeTime(r.created_at)}</span>
            </div>
            <CardTitle className="text-base">{r.title}</CardTitle>
          </div>
          <button onClick={() => setExpanded(expanded === r.id ? null : r.id)} className="text-zinc-400 hover:text-zinc-600 ml-2">
            {expanded === r.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
        {r.colors.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            <span className="text-xs text-zinc-400 flex items-center gap-1"><Palette className="w-3 h-3" /> Colors:</span>
            {r.colors.map(c => <Badge key={c} variant="default">{c}</Badge>)}
          </div>
        )}
        {r.styles.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            <span className="text-xs text-zinc-400 flex items-center gap-1"><Layers className="w-3 h-3" /> Styles:</span>
            {r.styles.map(s => <Badge key={s} variant="info">{s}</Badge>)}
          </div>
        )}
      </CardHeader>
      {expanded === r.id && r.summary && (
        <CardContent>
          <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">{r.summary}</p>
        </CardContent>
      )}
    </Card>
  )
}

function CampaignCard({ item: c, expanded, setExpanded }: { item: Campaign; expanded: string | null; setExpanded: (id: string | null) => void }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant={c.status === 'active' ? 'success' : c.status === 'completed' ? 'default' : 'info'}>
                {c.status}
              </Badge>
              <span className="text-xs text-zinc-400">{formatDate(c.start_date)} → {formatDate(c.end_date)}</span>
            </div>
            <CardTitle className="text-base">{c.name}</CardTitle>
          </div>
          <button onClick={() => setExpanded(expanded === c.id ? null : c.id)} className="text-zinc-400 hover:text-zinc-600 ml-2">
            {expanded === c.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
        {c.description && <p className="text-sm text-zinc-600 mt-1">{c.description}</p>}
        <div className="flex gap-2 mt-2 flex-wrap">
          {c.google_drive_url && (
            <a href={c.google_drive_url} target="_blank" rel="noopener noreferrer">
              <Badge variant="success" className="cursor-pointer hover:opacity-80"><ExternalLink className="w-3 h-3" /> Drive Brief</Badge>
            </a>
          )}
          {c.todoist_project_id && <Badge variant="warning">Todoist ✓</Badge>}
          {c.calendar_event_ids?.length > 0 && <Badge variant="info">Calendar ✓</Badge>}
        </div>
      </CardHeader>
      {expanded === c.id && c.milestones && c.milestones.length > 0 && (
        <CardContent>
          <p className="text-xs font-medium text-zinc-500 mb-2 uppercase tracking-wide">Milestones</p>
          <div className="space-y-2">
            {c.milestones.map((m) => (
              <div key={m.id} className="flex items-center gap-3 text-sm">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${m.completed ? 'bg-emerald-500' : 'bg-zinc-300'}`} />
                <span className="text-zinc-700">{m.title}</span>
                {m.due_date && <span className="text-xs text-zinc-400 ml-auto">{formatDate(m.due_date)}</span>}
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  )
}

function ReportCard({ item: r, expanded, setExpanded }: { item: PerformanceReport; expanded: string | null; setExpanded: (id: string | null) => void }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="warning">Performance Report</Badge>
              <span className="text-xs text-zinc-400">{formatRelativeTime(r.created_at)}</span>
            </div>
            <CardTitle className="text-base">{r.title}</CardTitle>
          </div>
          <div className="flex items-center gap-2 ml-2">
            {r.google_drive_url && (
              <a href={r.google_drive_url} target="_blank" rel="noopener noreferrer">
                <Badge variant="success" className="cursor-pointer"><ExternalLink className="w-3 h-3" /> Drive</Badge>
              </a>
            )}
            <button onClick={() => setExpanded(expanded === r.id ? null : r.id)} className="text-zinc-400 hover:text-zinc-600">
              {expanded === r.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </CardHeader>
      {expanded === r.id && r.insights && (
        <CardContent>
          <pre className="text-sm text-zinc-700 whitespace-pre-wrap font-sans leading-relaxed">{r.insights}</pre>
        </CardContent>
      )}
    </Card>
  )
}

function Empty({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
      <FileText className="w-10 h-10 mb-3 opacity-20" />
      <p className="text-sm">{label}</p>
    </div>
  )
}
