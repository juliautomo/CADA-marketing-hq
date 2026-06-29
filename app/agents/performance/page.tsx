'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart3, ArrowRight, Upload, ExternalLink, Lightbulb,
  RefreshCw, Heart, MessageCircle, Eye, Bookmark, Play, TrendingUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { PerformanceReport } from '@/types'

const sampleCSV = `metric,value,prev_value,change
Instagram Reach,124500,98200,+26.8%
Email Open Rate,32.4%,28.1%,+4.3pts
Click-through Rate,4.2%,3.8%,+0.4pts
Revenue (attributed),18400,14200,+29.6%
ROAS,3.2x,2.7x,+18.5%
New Customers,342,280,+22.1%`

interface PostWithMetrics {
  id: string
  caption?: string
  media_type: string
  media_url?: string
  thumbnail_url?: string
  timestamp: string
  permalink: string
  like_count: number
  comments_count: number
  metrics: Record<string, number>
}

function MetricPill({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="flex items-center gap-1 text-zinc-400">
        <Icon className="w-3 h-3" />
        <span className="text-[10px]">{label}</span>
      </div>
      <span className="text-sm font-semibold text-zinc-800">{value.toLocaleString()}</span>
    </div>
  )
}

function LivePostsTab() {
  const [posts, setPosts] = useState<PostWithMetrics[]>([])
  const [loading, setLoading] = useState(true)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiInsight, setAiInsight] = useState<string | null>(null)

  const [fetchError, setFetchError] = useState<string | null>(null)

  const fetchMetrics = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const res = await fetch('/api/posts/metrics')
      const data = await res.json()
      if (data.error) setFetchError(data.error)
      setPosts(data.posts ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchMetrics() }, [fetchMetrics])

  async function analyseWithAI() {
    if (posts.length === 0) return
    setAiLoading(true)
    setAiInsight(null)
    const metricsText = posts.map(p => {
      const m = p.metrics
      const caption = p.caption?.slice(0, 80) ?? '(no caption)'
      return `Post (${p.media_type}) — "${caption}"\n  Likes: ${m.likes ?? 0}, Comments: ${m.comments ?? 0}, Reach: ${m.reach ?? 0}, Saves: ${m.saved ?? 0}, Plays: ${m.plays ?? 0}`
    }).join('\n\n')

    try {
      const res = await fetch('/api/agents/performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Live Instagram Post Performance',
          period: 'All-time (live data)',
          metricsText,
        }),
      })
      const data = await res.json()
      setAiInsight(data.report?.insights ?? 'No insights returned.')
    } catch {
      setAiInsight('Failed to get AI insights.')
    } finally {
      setAiLoading(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24 text-zinc-400">
      <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (posts.length === 0) return (
    <div className="flex flex-col items-center justify-center py-24 text-zinc-400 px-4">
      <BarChart3 className="w-10 h-10 mb-3 opacity-20" />
      <p className="text-sm font-medium text-zinc-600">No posts found.</p>
      {fetchError ? (
        <div className="mt-3 text-center space-y-3">
          <p className="text-xs text-red-500 max-w-sm">{fetchError}</p>
          <p className="text-xs text-zinc-400">Your Instagram token may have expired. Reconnect to refresh it.</p>
          <a
            href="/api/auth/instagram"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Reconnect Instagram
          </a>
        </div>
      ) : (
        <p className="text-xs mt-1">Make sure Instagram is connected in Settings → Connections.</p>
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">{posts.length} post{posts.length !== 1 ? 's' : ''} tracked</p>
        <div className="flex items-center gap-2">
          <button onClick={fetchMetrics} className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-700">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          {posts.length > 0 && (
            <Button size="sm" onClick={analyseWithAI} loading={aiLoading} className="gap-1.5">
              <Lightbulb className="w-3.5 h-3.5" />
              {aiLoading ? 'Analysing…' : 'AI Analysis'}
            </Button>
          )}
        </div>
      </div>

      {/* AI insight */}
      {aiInsight && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-amber-200 bg-amber-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-amber-800">
                <Lightbulb className="w-4 h-4" /> AI Insights on Your Posts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-sm text-amber-900 whitespace-pre-wrap font-sans leading-relaxed">{aiInsight}</pre>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Posts grid */}
      <div className="space-y-3">
        {posts.map((post, i) => {
          const thumb = post.media_type === 'IMAGE' ? post.media_url : post.thumbnail_url
          const m = post.metrics
          return (
            <motion.div key={post.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Thumbnail */}
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumb} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0 border border-zinc-100" />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-zinc-100 shrink-0 flex items-center justify-center">
                        <Play className="w-5 h-5 text-zinc-400" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-xs text-zinc-600 line-clamp-2">{post.caption ?? '—'}</p>
                        <a href={post.permalink} target="_blank" rel="noopener noreferrer"
                          className="shrink-0 text-zinc-400 hover:text-zinc-600">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                      <p className="text-[10px] text-zinc-400 mb-3">
                        {new Date(post.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        {' · '}{post.media_type}
                      </p>
                      <div className="flex items-center gap-5 flex-wrap">
                        <MetricPill icon={Heart} label="Likes" value={m.likes ?? 0} />
                        <MetricPill icon={MessageCircle} label="Comments" value={m.comments ?? 0} />
                        <MetricPill icon={Eye} label="Reach" value={m.reach ?? 0} />
                        <MetricPill icon={Bookmark} label="Saves" value={m.saved ?? 0} />
                        {m.plays ? <MetricPill icon={Play} label="Plays" value={m.plays} /> : null}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

export default function PerformancePage() {
  const [pageTab, setPageTab] = useState<'analyse' | 'live'>('live')

  // Analyse tab state
  const [title, setTitle] = useState('')
  const [period, setPeriod] = useState('')
  const [metricsText, setMetricsText] = useState('')
  const [csvData, setCsvData] = useState('')
  const [activeTab, setActiveTab] = useState<'paste' | 'csv'>('paste')
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<PerformanceReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setCsvData(ev.target?.result as string)
    reader.readAsText(file)
  }

  async function handleAnalyze() {
    if (!title) return
    setLoading(true)
    setReport(null)
    setError(null)
    try {
      const res = await fetch('/api/agents/performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          period,
          metricsText: activeTab === 'paste' ? metricsText : undefined,
          csvData: activeTab === 'csv' ? csvData : undefined,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error ?? 'Failed')
      setReport(data.report)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-zinc-900">Performance Reviewer</h1>
          </div>
          <p className="text-sm text-zinc-500">Live post metrics from Instagram + AI analysis</p>
        </div>
        <Badge variant="warning">AI Analysis</Badge>
      </div>

      {/* Top-level tab */}
      <div className="flex rounded-xl border border-zinc-200 overflow-hidden w-fit">
        {([
          { id: 'live', label: 'Live Posts', icon: TrendingUp },
          { id: 'analyse', label: 'Analyse Metrics', icon: BarChart3 },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setPageTab(id)}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium transition-colors ${
              pageTab === id ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-600 hover:bg-zinc-50'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Live Posts tab */}
      {pageTab === 'live' && <LivePostsTab />}

      {/* Analyse tab */}
      {pageTab === 'analyse' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Controls */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Report Details</CardTitle>
                <CardDescription>Provide your metrics for analysis</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1.5">Report Title *</label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. May 2026 Campaign Review" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1.5">Period <span className="text-zinc-400">(optional)</span></label>
                  <Input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="e.g. May 1–31, 2026" />
                </div>

                {/* Tab switcher */}
                <div>
                  <div className="flex rounded-lg border border-zinc-200 overflow-hidden mb-3">
                    {(['paste', 'csv'] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 py-2 text-xs font-medium transition-colors ${
                          activeTab === tab ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-600 hover:bg-zinc-50'
                        }`}
                      >
                        {tab === 'paste' ? 'Paste Metrics' : 'Upload CSV'}
                      </button>
                    ))}
                  </div>

                  {activeTab === 'paste' && (
                    <div>
                      <Textarea
                        value={metricsText}
                        onChange={(e) => setMetricsText(e.target.value)}
                        placeholder="Paste your metrics here…&#10;e.g. Instagram Reach: 124,500 (+26.8%)&#10;Email Open Rate: 32.4%&#10;Revenue: $18,400"
                        rows={8}
                      />
                      <button
                        onClick={() => setMetricsText(sampleCSV)}
                        className="mt-1.5 text-xs text-zinc-400 hover:text-zinc-600 underline"
                      >
                        Load sample data
                      </button>
                    </div>
                  )}

                  {activeTab === 'csv' && (
                    <div>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full border-2 border-dashed border-zinc-200 rounded-xl p-6 flex flex-col items-center gap-2 hover:border-zinc-400 transition-colors"
                      >
                        <Upload className="w-6 h-6 text-zinc-400" />
                        <p className="text-sm text-zinc-500">
                          {csvData ? 'CSV loaded ✓' : 'Click to upload CSV'}
                        </p>
                        <p className="text-xs text-zinc-400">metric, value columns</p>
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                      {csvData && (
                        <button
                          onClick={() => setCsvData('')}
                          className="mt-1.5 text-xs text-red-400 hover:text-red-600 underline"
                        >
                          Clear CSV
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <Button
                  onClick={handleAnalyze}
                  loading={loading}
                  disabled={!title || (activeTab === 'paste' ? !metricsText : !csvData)}
                  className="w-full"
                  size="lg"
                >
                  {loading ? 'Analysing…' : <>Analyse Performance <ArrowRight className="w-4 h-4" /></>}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Results */}
          <div className="lg:col-span-2 space-y-5">
            {loading && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                  <div className="text-center">
                    <p className="text-sm text-zinc-700 font-medium">Analysing your metrics…</p>
                    <p className="text-xs text-zinc-400 mt-1">Generating insights and saving to Google Drive</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {error && (
              <div className="rounded-xl bg-red-50 border border-red-100 p-4">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {report && !loading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-zinc-900">{report.title}</h2>
                  <div className="flex items-center gap-2">
                    <Badge variant="success">Saved to DB</Badge>
                    {report.google_drive_url && (
                      <a
                        href={report.google_drive_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        View in Drive
                      </a>
                    )}
                  </div>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Lightbulb className="w-4 h-4 text-amber-500" />
                      AI Insights
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-sm text-zinc-700 whitespace-pre-wrap font-sans leading-relaxed">
                      {report.insights}
                    </pre>
                  </CardContent>
                </Card>

                {Object.keys(report.metrics).length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Parsed Metrics</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="divide-y divide-zinc-100">
                        {Object.entries(report.metrics).map(([key, val]) => (
                          <div key={key} className="flex items-center justify-between py-2">
                            <span className="text-sm text-zinc-600">{key}</span>
                            <span className="text-sm font-medium text-zinc-900">{String(val)}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </motion.div>
            )}

            {!loading && !report && !error && (
              <div className="flex flex-col items-center justify-center py-24 text-zinc-400">
                <BarChart3 className="w-10 h-10 mb-3 opacity-20" />
                <p className="text-sm">Add your metrics and click Analyse Performance</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
