'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, CalendarDays, BarChart3, FileText, Image, Palette, Layers, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate, formatRelativeTime } from '@/lib/utils'
import type { TrendReport, Campaign, PerformanceReport, ContentItem } from '@/types'

type Tab = 'content' | 'trends' | 'campaigns' | 'reports'

export default function HistoryPage() {
  const [tab, setTab] = useState<Tab>('trends')
  const [trends, setTrends] = useState<TrendReport[]>([])
  const [content, setContent] = useState<ContentItem[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [reports, setReports] = useState<PerformanceReport[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

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

  const tabs: { id: Tab; label: string; icon: typeof TrendingUp; count: number }[] = [
    { id: 'trends',    label: 'Trend Reports',    icon: TrendingUp,  count: trends.length },
    { id: 'content',   label: 'Content Library',  icon: Image,       count: content.length },
    { id: 'campaigns', label: 'Campaigns',         icon: CalendarDays, count: campaigns.length },
    { id: 'reports',   label: 'Perf. Reports',    icon: BarChart3,   count: reports.length },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">History</h1>
        <p className="text-sm text-zinc-500 mt-1">All outputs saved by your AI agents</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-zinc-200 pb-0">
        {tabs.map(({ id, label, icon: Icon, count }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
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

          {/* TREND REPORTS */}
          {tab === 'trends' && (
            trends.length === 0 ? <Empty label="No trend reports yet" /> :
            trends.map((r, i) => (
              <motion.div key={r.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">{r.title}</CardTitle>
                        <p className="text-xs text-zinc-400 mt-1">{formatRelativeTime(r.created_at)}</p>
                      </div>
                      <button onClick={() => setExpanded(expanded === r.id ? null : r.id)} className="text-zinc-400 hover:text-zinc-600">
                        {expanded === r.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                    {/* Color pills */}
                    {r.colors.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        <span className="text-xs text-zinc-400 flex items-center gap-1"><Palette className="w-3 h-3" /> Colors:</span>
                        {r.colors.map(c => <Badge key={c} variant="default">{c}</Badge>)}
                      </div>
                    )}
                    {r.styles.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <span className="text-xs text-zinc-400 flex items-center gap-1"><Layers className="w-3 h-3" /> Styles:</span>
                        {r.styles.map(s => <Badge key={s} variant="info">{s}</Badge>)}
                      </div>
                    )}
                    {r.silhouettes.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <span className="text-xs text-zinc-400">Silhouettes:</span>
                        {r.silhouettes.map(s => <Badge key={s} variant="default">{s}</Badge>)}
                      </div>
                    )}
                  </CardHeader>
                  {expanded === r.id && r.summary && (
                    <CardContent>
                      <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">{r.summary}</p>
                    </CardContent>
                  )}
                </Card>
              </motion.div>
            ))
          )}

          {/* CONTENT LIBRARY */}
          {tab === 'content' && (
            content.length === 0 ? <Empty label="No content items yet" /> :
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {content.map((item, i) => (
                <motion.div key={item.id} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.04 }}>
                  <Card className="h-full">
                    {item.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.image_url} alt={item.title} className="w-full aspect-square object-cover rounded-t-2xl" />
                    )}
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="default">{item.type}</Badge>
                        <span className="text-xs text-zinc-400">{formatRelativeTime(item.created_at)}</span>
                      </div>
                      <p className="text-sm font-medium text-zinc-800 mb-1">{item.title}</p>
                      {item.body && <p className="text-xs text-zinc-500 line-clamp-3">{item.body}</p>}
                      {item.canva_url && (
                        <a href={item.canva_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                          Open in Canva <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}

          {/* CAMPAIGNS */}
          {tab === 'campaigns' && (
            campaigns.length === 0 ? <Empty label="No campaigns yet" /> :
            campaigns.map((c, i) => (
              <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">{c.name}</CardTitle>
                        <p className="text-xs text-zinc-400 mt-1">{formatDate(c.start_date)} → {formatDate(c.end_date)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={c.status === 'active' ? 'success' : c.status === 'completed' ? 'default' : 'info'}>
                          {c.status}
                        </Badge>
                        <button onClick={() => setExpanded(expanded === c.id ? null : c.id)} className="text-zinc-400 hover:text-zinc-600">
                          {expanded === c.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    {c.description && <p className="text-sm text-zinc-600 mt-2">{c.description}</p>}
                    <div className="flex gap-2 mt-3">
                      {c.google_drive_url && (
                        <a href={c.google_drive_url} target="_blank" rel="noopener noreferrer">
                          <Badge variant="success" className="cursor-pointer hover:opacity-80">
                            <ExternalLink className="w-3 h-3" /> Drive Brief
                          </Badge>
                        </a>
                      )}
                      {c.todoist_project_id && <Badge variant="warning">Todoist ✓</Badge>}
                      {c.calendar_event_ids?.length > 0 && <Badge variant="info">Calendar ✓</Badge>}
                    </div>
                  </CardHeader>
                  {expanded === c.id && c.milestones && c.milestones.length > 0 && (
                    <CardContent>
                      <p className="text-xs font-medium text-zinc-500 mb-2">MILESTONES</p>
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
              </motion.div>
            ))
          )}

          {/* PERFORMANCE REPORTS */}
          {tab === 'reports' && (
            reports.length === 0 ? <Empty label="No performance reports yet" /> :
            reports.map((r, i) => (
              <motion.div key={r.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">{r.title}</CardTitle>
                        <p className="text-xs text-zinc-400 mt-1">{formatRelativeTime(r.created_at)}</p>
                      </div>
                      <div className="flex items-center gap-2">
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
              </motion.div>
            ))
          )}

        </div>
      )}
    </div>
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
