'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  TrendingUp, ArrowRight, Palette, Layers, Shirt,
  Hash, Users, Video, ExternalLink, Play, ImageIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { TrendReport } from '@/types'

const seasons = ['Current Season', 'Spring/Summer 2026', 'Fall/Winter 2026', 'Resort 2026']
const markets = ['Indonesia & Singapore', 'Indonesia', 'Singapore', 'Global', 'SEA', 'Luxury']
const focuses = ['Muslimwear', 'Modest Womenswear', 'Hijab Fashion', 'Modest Casual', 'Modest Formal', 'Modest Streetwear']

const platformColors = {
  tiktok: 'bg-zinc-900 text-white',
  instagram: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white',
}

export default function TrendPage() {
  const [brandName, setBrandName] = useState('')
  const [season, setSeason] = useState('Current Season')
  const [market, setMarket] = useState('Indonesia & Singapore')
  const [focus, setFocus] = useState('Muslimwear')

  useEffect(() => {
    fetch('/api/settings/brand').then(r => r.json()).then(d => { if (d.brand_name) setBrandName(d.brand_name) }).catch(() => {})
  }, [])
  const [customFocus, setCustomFocus] = useState('')
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<TrendReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lightboxImg, setLightboxImg] = useState<string | null>(null)

  async function handleAnalyze() {
    setLoading(true)
    setReport(null)
    setError(null)
    try {
      const res = await fetch('/api/agents/trend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season, market, focus: customFocus || focus }),
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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-zinc-900">Trend Analyst</h1>
          </div>
          <p className="text-sm text-zinc-500">Trend intelligence — with mood boards, hashtags & creator inspo</p>
        </div>
        <Badge variant="success">{brandName || 'Trend'} Intelligence</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Research Parameters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-2">Season</label>
                <div className="grid grid-cols-1 gap-1.5">
                  {seasons.map((s) => (
                    <button key={s} onClick={() => setSeason(s)}
                      className={`text-left px-3 py-2 rounded-lg text-sm border transition-colors ${season === s ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-2">Market</label>
                <div className="flex flex-wrap gap-1.5">
                  {markets.map((m) => (
                    <button key={m} onClick={() => setMarket(m)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${market === m ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'}`}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-2">Category Focus</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {focuses.map((f) => (
                    <button key={f} onClick={() => { setFocus(f); setCustomFocus('') }}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${focus === f && !customFocus ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'}`}>
                      {f}
                    </button>
                  ))}
                </div>
                <Input value={customFocus} onChange={(e) => setCustomFocus(e.target.value)} placeholder="Or type a custom focus…" className="text-sm" />
              </div>

              <Button onClick={handleAnalyze} loading={loading} className="w-full" size="lg">
                {loading ? 'Researching…' : <> Analyse Trends <ArrowRight className="w-4 h-4" /></>}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Results */}
        <div className="lg:col-span-2 space-y-5">
          {loading && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="relative w-12 h-12">
                  <div className="absolute inset-0 rounded-full border-2 border-emerald-200 animate-ping" />
                  <div className="w-12 h-12 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
                </div>
                <p className="text-sm text-zinc-500">Analysing trends{brandName ? ` for ${brandName}` : ''}…</p>
              </CardContent>
            </Card>
          )}

          {error && <div className="rounded-xl bg-red-50 border border-red-100 p-4"><p className="text-sm text-red-700">{error}</p></div>}

          {report && !loading && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">

              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-zinc-700">{report.title}</h2>
                <Badge variant="success">Saved to DB</Badge>
              </div>

              {/* ── Mood Board ── */}
              {report.mood_board_images?.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-emerald-500" /> Trend Mood Board
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-2">
                      {report.mood_board_images.map((img) => (
                        <div key={img.id} className="relative group cursor-pointer rounded-xl overflow-hidden aspect-[3/4] bg-zinc-100"
                          onClick={() => setLightboxImg(img.large_url)}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={img.url} alt={img.alt} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-end p-2 opacity-0 group-hover:opacity-100">
                            <a href={img.pexels_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                              className="text-white text-xs bg-black/50 rounded px-1.5 py-0.5 truncate">
                              © {img.photographer}
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-zinc-400 mt-2">Photos via Pexels. Click to enlarge.</p>
                  </CardContent>
                </Card>
              )}

              {/* ── Colors, Silhouettes, Styles ── */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {report.colors.length > 0 && (
                  <Card>
                    <CardHeader><CardTitle className="text-xs flex items-center gap-1.5"><Palette className="w-3.5 h-3.5 text-emerald-500" /> Colors</CardTitle></CardHeader>
                    <CardContent className="flex flex-wrap gap-1.5">
                      {report.colors.map((c) => <Badge key={c} variant="default">{c}</Badge>)}
                    </CardContent>
                  </Card>
                )}
                {report.silhouettes.length > 0 && (
                  <Card>
                    <CardHeader><CardTitle className="text-xs flex items-center gap-1.5"><Shirt className="w-3.5 h-3.5 text-emerald-500" /> Silhouettes</CardTitle></CardHeader>
                    <CardContent className="flex flex-wrap gap-1.5">
                      {report.silhouettes.map((s) => <Badge key={s} variant="default">{s}</Badge>)}
                    </CardContent>
                  </Card>
                )}
                {report.styles.length > 0 && (
                  <Card>
                    <CardHeader><CardTitle className="text-xs flex items-center gap-1.5"><Layers className="w-3.5 h-3.5 text-emerald-500" /> Styles</CardTitle></CardHeader>
                    <CardContent className="flex flex-wrap gap-1.5">
                      {report.styles.map((s) => <Badge key={s} variant="info">{s}</Badge>)}
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* ── Trending Hashtags ── */}
              {report.trending_hashtags?.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Hash className="w-4 h-4 text-emerald-500" /> Trending Hashtags
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {report.trending_hashtags.map((h) => (
                        <div key={h.tag} className="flex items-start gap-3 py-2 border-b border-zinc-50 last:border-0">
                          <div className="flex gap-1.5 flex-shrink-0 mt-0.5">
                            {h.platform === 'tiktok' || h.platform === undefined ? (
                              <a href={h.tiktok_url} target="_blank" rel="noopener noreferrer">
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${platformColors.tiktok}`}>TikTok</span>
                              </a>
                            ) : null}
                            <a href={h.instagram_url} target="_blank" rel="noopener noreferrer">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${platformColors.instagram}`}>Instagram</span>
                            </a>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-zinc-800">#{h.tag}</span>
                              <a href={h.tiktok_url} target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-zinc-600">
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                            {h.description && <p className="text-xs text-zinc-500 mt-0.5">{h.description}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* ── Trending Creators ── */}
              {report.trending_creators?.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Users className="w-4 h-4 text-emerald-500" /> Creators to Watch
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {report.trending_creators.map((c) => (
                        <a key={c.handle} href={c.url} target="_blank" rel="noopener noreferrer"
                          className="flex items-start gap-3 p-3 rounded-xl border border-zinc-100 hover:border-zinc-300 hover:bg-zinc-50 transition-all group">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${c.platform === 'tiktok' ? 'bg-zinc-900 text-white' : 'bg-gradient-to-br from-purple-500 to-pink-500 text-white'}`}>
                            {c.handle.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-semibold text-zinc-800">@{c.handle}</span>
                              <ExternalLink className="w-3 h-3 text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={`text-xs px-1.5 py-0.5 rounded-full ${c.platform === 'tiktok' ? 'bg-zinc-100 text-zinc-600' : 'bg-pink-50 text-pink-600'}`}>
                                {c.platform}
                              </span>
                              {c.followers && <span className="text-xs text-zinc-400">{c.followers}</span>}
                            </div>
                            {c.reason && <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{c.reason}</p>}
                          </div>
                        </a>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* ── Content Ideas ── */}
              {report.trending_content?.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Play className="w-4 h-4 text-emerald-500" /> Trending Content Ideas{brandName ? ` for ${brandName}` : ''}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {report.trending_content.map((c, i) => (
                        <div key={i} className="flex gap-3 p-3 rounded-xl bg-zinc-50 border border-zinc-100">
                          <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                            <Video className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">{c.format}</span>
                            </div>
                            <p className="text-sm font-medium text-zinc-800">{c.idea}</p>
                            {c.why && <p className="text-xs text-zinc-500 mt-0.5">{c.why}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* ── Full Analysis ── */}
              {report.summary && (
                <Card>
                  <CardHeader><CardTitle className="text-sm">Full Analysis</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">{report.summary}</p>
                  </CardContent>
                </Card>
              )}

            </motion.div>
          )}

          {!loading && !report && !error && (
            <div className="flex flex-col items-center justify-center py-24 text-zinc-400">
              <TrendingUp className="w-10 h-10 mb-3 opacity-20" />
              <p className="text-sm">Configure parameters and click Analyse Trends</p>
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxImg && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setLightboxImg(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightboxImg} alt="Trend" className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain" />
          <button className="absolute top-4 right-4 text-white text-2xl font-bold">×</button>
        </div>
      )}
    </div>
  )
}
