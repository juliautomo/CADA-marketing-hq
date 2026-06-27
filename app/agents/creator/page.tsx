'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, Type, FileText, Mail, Image, Video, Layout,
  ArrowRight, Copy, Check, ExternalLink, RotateCcw, X, Upload,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MediaReference } from '@/components/agents/media-reference'
import { ContentLibrary } from '@/components/agents/content-library'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import type { ContentItem, ContentType, CreatorInput } from '@/types'
import type { ImageAnalysis } from '@/lib/anthropic'
import type { VideoAnalysis } from '@/app/api/analyze-video/route'

// ── Task definitions ───────────────────────────────────────────────────────────
const TASKS = [
  { id: 'caption'      as ContentType, label: 'Caption',      icon: Type,     color: 'bg-violet-500', description: 'Social media captions with hashtags' },
  { id: 'description'  as ContentType, label: 'Description',  icon: FileText, color: 'bg-blue-500',   description: 'E-commerce product copy for Shopee' },
  { id: 'email'        as ContentType, label: 'Promo Email',  icon: Mail,     color: 'bg-amber-500',  description: 'Full email with subject line & CTA' },
  { id: 'image'        as ContentType, label: 'AI Image',     icon: Image,    color: 'bg-emerald-500',description: 'Generate fashion imagery via GPT Image' },
  { id: 'video'        as ContentType, label: 'Short Video',  icon: Video,    color: 'bg-red-500',    description: 'Generate video clips via Runway ML' },
  { id: 'canva'        as ContentType, label: 'Canva',        icon: Layout,   color: 'bg-pink-500',   description: 'Auto-create a Canva design template' },
]

const PLATFORMS  = ['Instagram', 'TikTok', 'Pinterest', 'Twitter/X', 'LinkedIn', 'Shopee']
const TONES      = ['Aspirational', 'Playful', 'Luxury', 'Minimal', 'Bold', 'Romantic']
const LANGUAGES  = [
  { value: 'english',          label: '🇬🇧 English' },
  { value: 'bahasa-indonesia', label: '🇮🇩 Bahasa Indonesia' },
  { value: 'bahasa-melayu',    label: '🇲🇾 Bahasa Melayu' },
]
const CAP_LENGTHS = [
  { value: 'short',    label: 'Short',    sub: '< 80 words' },
  { value: 'standard', label: 'Standard', sub: '100–180 words' },
  { value: 'long',     label: 'Long',     sub: '200–300 words' },
]
const VIDEO_LENGTHS = [
  { value: 5,  label: '5 sec' },
  { value: 10, label: '10 sec' },
]

function TikTokPostButton({ videoUrl, caption }: { videoUrl: string; caption: string }) {
  const [status, setStatus] = useState<'idle' | 'posting' | 'done' | 'error'>('idle')
  const [msg, setMsg] = useState('')

  async function post() {
    setStatus('posting')
    const res = await fetch('/api/tiktok/post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoUrl, caption }),
    })
    const data = await res.json()
    if (res.ok) {
      setStatus('done')
      setMsg('Sent to TikTok inbox as draft — open TikTok app to review and publish')
    } else {
      setStatus('error')
      setMsg(data.error ?? 'Post failed')
    }
  }

  if (status === 'done') return (
    <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">
      <Check className="w-4 h-4 shrink-0" /> {msg}
    </div>
  )

  return (
    <div className="space-y-1.5">
      <button
        onClick={post}
        disabled={status === 'posting'}
        className="flex items-center justify-center gap-2 w-full rounded-xl bg-zinc-900 text-white text-sm font-semibold py-2.5 hover:bg-zinc-700 transition-colors disabled:opacity-60"
      >
        <div className="w-4 h-4 rounded-sm bg-white/20 flex items-center justify-center text-[10px] font-bold">TT</div>
        {status === 'posting' ? 'Posting…' : 'Post to TikTok'}
      </button>
      {status === 'error' && <p className="text-xs text-red-500 text-center">{msg}</p>}
    </div>
  )
}

export default function CreatorPage() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [task, setTask]                 = useState<ContentType>('caption')
  const [product, setProduct]           = useState('')
  const [platform, setPlatform]         = useState('Instagram')
  const [tone, setTone]                 = useState('Aspirational')
  const [language, setLanguage]         = useState<CreatorInput['language']>('english')
  const [captionLength, setCaptionLen]  = useState<CreatorInput['captionLength']>('standard')
  const [videoLength, setVideoLength]   = useState<5 | 10>(5)
  const [videoProvider, setVideoProvider] = useState<'runway' | 'kling' | 'runway-ref'>('kling')
  const [refImageUrls, setRefImageUrls]   = useState<string[]>([])
  const [customPrompt, setCustomPrompt] = useState('')
  const [captionNotes, setCaptionNotes] = useState('')
  const [imageAnalysis, setImageAnalysis] = useState<ImageAnalysis | null>(null)
  const [videoAnalysis, setVideoAnalysis] = useState<VideoAnalysis | null>(null)
  const [rawMediaUrl, setRawMediaUrl]     = useState<string | null>(null)
  const [resultMediaUrl, setResultMediaUrl] = useState<string | null>(null)

  const [loading, setLoading]   = useState(false)
  const [result, setResult]     = useState<Record<string, unknown> | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const [copied, setCopied]     = useState(false)

  const [library, setLibrary]         = useState<ContentItem[]>([])
  const [libraryLoading, setLibraryLoading] = useState(true)
  const [products, setProducts]       = useState<import('@/types').Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<import('@/types').Product | null>(null)

  const taskDef    = TASKS.find(t => t.id === task)!
  const needsPrompt = ['image', 'video'].includes(task)

  // ── Library ────────────────────────────────────────────────────────────────
  const fetchLibrary = useCallback(async () => {
    setLibraryLoading(true)
    try {
      const res = await fetch('/api/content-library')
      const data = await res.json()
      setLibrary(data.items ?? [])
    } catch { /* non-critical */ }
    finally { setLibraryLoading(false) }
  }, [])

  useEffect(() => { fetchLibrary() }, [fetchLibrary])

  useEffect(() => {
    fetch('/api/products').then(r => r.json()).then(d => setProducts(d.products ?? []))
  }, [])

  // Auto-fill product details field when catalog item selected for image/video
  useEffect(() => {
    if (needsPrompt && selectedProduct) {
      const parts = [
        selectedProduct.name,
        selectedProduct.colors.length > 0 ? selectedProduct.colors.join(', ') : null,
        selectedProduct.fabric ?? null,
      ].filter(Boolean)
      setProduct(parts.join(' · '))
    }
  }, [selectedProduct, needsPrompt])

  // ── Generate ───────────────────────────────────────────────────────────────
  async function handleGenerate() {
    if (!product && !customPrompt && !imageAnalysis && !videoAnalysis && !selectedProduct && !rawMediaUrl) return
    setLoading(true)
    setResult(null)
    setError(null)
    setResultMediaUrl(rawMediaUrl)

    // Build product context from catalog selection
    const productContext = selectedProduct
      ? `\n\nPRODUCT FROM CATALOG:\n- Name: ${selectedProduct.name}\n- Category: ${selectedProduct.category}\n- Price: ${selectedProduct.price ?? 'not specified'}\n- Colours: ${selectedProduct.colors.join(', ')}\n- Fabric: ${selectedProduct.fabric ?? 'not specified'}\n- Season: ${selectedProduct.season}\n- Description: ${selectedProduct.description ?? ''}\nUse these exact product details in the content.`
      : ''

    const imageContext = imageAnalysis
      ? `\n\nIMAGE REFERENCE:\n- Product: ${imageAnalysis.product}\n- Colors: ${imageAnalysis.colors.join(', ')}\n- Mood: ${imageAnalysis.mood}\n- Caption angle: ${imageAnalysis.captionAngle}\nWrite content inspired by this image.`
      : videoAnalysis
      ? `\n\nVIDEO REFERENCE:\n- Product: ${videoAnalysis.product}\n- Colors: ${videoAnalysis.colors.join(', ')}\n- Mood: ${videoAnalysis.mood}\n- Setting: ${videoAnalysis.setting}\n- Caption angle: ${videoAnalysis.captionAngle}\nWrite content inspired by this video.`
      : ''

    const body: CreatorInput = {
      task,
      product:        product || selectedProduct?.name || imageAnalysis?.product || videoAnalysis?.product || undefined,
      platform,
      tone,
      language,
      captionLength:  task === 'caption' ? captionLength : undefined,
      videoLength:    task === 'video'   ? videoLength   : undefined,
      videoProvider:  task === 'video'   ? videoProvider : undefined,
      referenceImageUrl: rawMediaUrl ?? undefined,
      referenceImageUrls: refImageUrls.length > 0 ? refImageUrls : undefined,
      prompt:         customPrompt || undefined,
      additionalContext: (productContext + imageContext + (captionNotes ? `\n\nADDITIONAL CAPTION NOTES: ${captionNotes}` : '')) || undefined,
    }

    try {
      const res  = await fetch('/api/agents/creator', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json()
      if (!data.success) throw new Error(data.error ?? 'Generation failed')
      setResult(data)
      fetchLibrary()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  function handleTaskChange(t: ContentType) {
    setTask(t)
    setResult(null)
    setError(null)
    setSelectedProduct(null)
    setImageAnalysis(null)
    setVideoAnalysis(null)
    setRawMediaUrl(null)
    setCaptionNotes('')
  }

  function copyText() {
    if (typeof result?.text === 'string') {
      navigator.clipboard.writeText(result.text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  function reset() {
    setResult(null)
    setError(null)
    setProduct('')
    setCustomPrompt('')
    setImageAnalysis(null)
    setVideoAnalysis(null)
    setRawMediaUrl(null)
    setResultMediaUrl(null)
    setRefImageUrls([])
  }

  const canGenerate  = !!(product || customPrompt || imageAnalysis || videoAnalysis || selectedProduct || rawMediaUrl)
  const needsProduct = ['caption', 'description', 'email'].includes(task)
  const showCatalog  = products.length > 0

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-violet-500 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-zinc-900">Content Creator</h1>
          </div>
          <p className="text-sm text-zinc-500">Generate captions, images, videos, emails and more</p>
        </div>
        <Badge variant="info">Claude + GPT Image + Runway</Badge>
      </div>

      {/* ── STEP 1: What do you want to create? ── */}
      <div>
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">1 — What do you want to create?</p>
        <div className="grid grid-cols-3 gap-2">
          {TASKS.map((t) => {
            const Icon = t.icon
            const active = task === t.id
            return (
              <button
                key={t.id}
                onClick={() => handleTaskChange(t.id)}
                className={cn(
                  'flex flex-col items-start gap-2 rounded-xl p-3.5 border text-left transition-all',
                  active
                    ? 'border-zinc-900 bg-zinc-900 text-white shadow-md'
                    : 'border-zinc-200 bg-white hover:border-zinc-300 hover:shadow-sm'
                )}
              >
                <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', active ? 'bg-white/20' : t.color)}>
                  <Icon className="w-3.5 h-3.5 text-white" />
                </div>
                <div>
                  <p className={cn('text-xs font-semibold', active ? 'text-white' : 'text-zinc-800')}>{t.label}</p>
                  <p className={cn('text-xs leading-tight mt-0.5', active ? 'text-white/60' : 'text-zinc-400')}>{t.description}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── STEP 2: Reference (optional) — hidden for Runway References which has its own slots ── */}
      {videoProvider !== 'runway-ref' && (
      <div>
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
          2 — {needsPrompt ? 'Starting frame' : 'Add a reference'} <span className="normal-case font-normal text-zinc-300">(optional)</span>
        </p>
        <MediaReference
          onImageAnalysis={(analysis) => { setImageAnalysis(analysis); setCaptionNotes(n => n || analysis.captionAngle) }}
          onVideoAnalysis={(analysis) => { setVideoAnalysis(analysis); setCaptionNotes(n => n || analysis.captionAngle) }}
          onRawMedia={(url) => setRawMediaUrl(url)}
          onClear={() => { setImageAnalysis(null); setVideoAnalysis(null); setRawMediaUrl(null); setCaptionNotes('') }}
          platform={platform}
          tone={tone}
          skipAnalysis={needsPrompt}
        />
        {(imageAnalysis || videoAnalysis) && (
          <p className="text-xs text-violet-600 mt-2 flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> {videoAnalysis ? 'Video' : 'Image'} context active — click Generate below to create content
          </p>
        )}
      </div>
      )}

      {/* ── STEP 3: Settings ── */}
      <div>
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">3 — Settings</p>
        <Card>
          <CardContent className="pt-5 space-y-4">

            {/* Product picker from catalog */}
            {showCatalog && (needsProduct || task === 'canva' || needsPrompt) && (
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1.5">
                  Pick from catalog <span className="text-zinc-400 font-normal">(optional)</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {products.filter(p => p.active).map(p => (
                    <button key={p.id} onClick={() => {
                      setSelectedProduct(selectedProduct?.id === p.id ? null : p)
                      if (selectedProduct?.id !== p.id) setProduct('')
                    }}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                        selectedProduct?.id === p.id
                          ? 'bg-violet-600 text-white border-violet-600'
                          : 'bg-white text-zinc-600 border-zinc-200 hover:border-violet-300 hover:text-violet-700'
                      )}>
                      {p.name}
                    </button>
                  ))}
                </div>
                {selectedProduct && (
                  <div className="mt-2 rounded-lg bg-violet-50 border border-violet-100 px-3 py-2 flex items-center justify-between">
                    <p className="text-xs text-violet-700">
                      ✓ <strong>{selectedProduct.name}</strong> — {selectedProduct.colors.join(', ')} · {selectedProduct.fabric}
                    </p>
                    <button onClick={() => setSelectedProduct(null)} className="text-violet-400 hover:text-violet-600 ml-2">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Product / subject */}
            {(needsProduct || task === 'canva') && (
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1.5">
                  {selectedProduct ? 'Extra product notes' : task === 'email' ? 'Product or campaign name' : 'Product / subject'}
                </label>
                <Input
                  value={product}
                  onChange={(e) => setProduct(e.target.value)}
                  placeholder={
                    selectedProduct ? 'e.g. focus on the relaxed fit, style it with sandals…' :
                    task === 'email' ? 'e.g. Raya Eid Collection launch' :
                    task === 'canva' ? 'e.g. Linen wide-leg pants' :
                    'e.g. silk slip dress in champagne'
                  }
                />
              </div>
            )}

            {/* Visual scene — image / video */}
            {needsPrompt && (
              <div className="space-y-3">
                {/* Product details */}
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1">
                    Product details <span className="text-zinc-400 font-normal">(colour, fabric, tone — auto-filled if catalog selected)</span>
                  </label>
                  <Input
                    value={product}
                    onChange={(e) => setProduct(e.target.value)}
                    placeholder={selectedProduct ? 'e.g. focus on the wide leg silhouette, earthy tone…' : 'e.g. Navy linen wide-leg pants, relaxed fit, minimal style'}
                  />
                </div>
                {/* Scene / visual prompt */}
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1">
                    {task === 'video' ? 'Scene description' : 'Visual / scene description'}
                    <span className="text-zinc-400 font-normal ml-1">(what should happen in the {task === 'video' ? 'video' : 'image'})</span>
                  </label>
                  <Textarea
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder={
                      task === 'video'
                        ? 'e.g. Lady walking in a park with a dog, golden hour lighting, slow motion'
                        : 'e.g. Editorial flat lay on marble surface with fresh flowers, top-down angle'
                    }
                    rows={2}
                  />
                </div>
              </div>
            )}

            {/* Platform — caption only */}
            {task === 'caption' && (
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1.5">Platform</label>
                <div className="flex flex-wrap gap-1.5">
                  {PLATFORMS.map((p) => (
                    <button key={p} onClick={() => setPlatform(p)}
                      className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                        platform === p ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'
                      )}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Tone — text tasks */}
            {['caption', 'description', 'email'].includes(task) && (
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1.5">Tone</label>
                <div className="flex flex-wrap gap-1.5">
                  {TONES.map((t) => (
                    <button key={t} onClick={() => setTone(t)}
                      className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                        tone === t ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'
                      )}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Caption length */}
            {task === 'caption' && (
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1.5">Caption length</label>
                <div className="grid grid-cols-3 gap-2">
                  {CAP_LENGTHS.map((l) => (
                    <button key={l.value} onClick={() => setCaptionLen(l.value as CreatorInput['captionLength'])}
                      className={cn('rounded-lg border p-2.5 text-left transition-all',
                        captionLength === l.value ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white hover:border-zinc-300'
                      )}>
                      <p className={cn('text-xs font-semibold', captionLength === l.value ? 'text-white' : 'text-zinc-800')}>{l.label}</p>
                      <p className={cn('text-xs mt-0.5', captionLength === l.value ? 'text-white/60' : 'text-zinc-400')}>{l.sub}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Video provider + length */}
            {task === 'video' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1.5">Video provider</label>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { id: 'kling',      label: 'Kling AI',         sub: 'Realistic motion' },
                      { id: 'runway',     label: 'Runway Gen4.5',    sub: 'Fast text-to-video' },
                      { id: 'runway-ref', label: 'Runway References', sub: 'Upload 1–3 ref photos' },
                    ] as const).map((p) => (
                      <button key={p.id} onClick={() => setVideoProvider(p.id)}
                        className={cn('rounded-xl border p-3 text-left transition-all',
                          videoProvider === p.id ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white hover:border-zinc-300'
                        )}>
                        <p className={cn('text-xs font-semibold', videoProvider === p.id ? 'text-white' : 'text-zinc-800')}>{p.label}</p>
                        <p className={cn('text-xs mt-0.5', videoProvider === p.id ? 'text-white/60' : 'text-zinc-400')}>{p.sub}</p>
                      </button>
                    ))}
                  </div>

                  {/* Reference image slots for Runway References */}
                  {videoProvider === 'runway-ref' && (
                    <div className="mt-3">
                      <p className="text-xs text-zinc-500 mb-2">Upload up to 3 reference photos — style &amp; subject only, not a starting frame</p>
                      <div className="grid grid-cols-3 gap-2">
                        {[0, 1, 2].map((i) => (
                          <label key={i} className={cn(
                            'relative rounded-xl border-2 border-dashed cursor-pointer overflow-hidden flex items-center justify-center aspect-square transition-colors',
                            refImageUrls[i] ? 'border-violet-300' : 'border-zinc-200 hover:border-violet-300'
                          )}>
                            <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                              const file = e.target.files?.[0]
                              if (!file) return
                              const ext = file.name.split('.').pop()
                              const path = `runway-refs/${Date.now()}-${i}.${ext}`
                              const { error } = await supabase.storage.from('product-images').upload(path, file, { upsert: true })
                              if (error) { console.error('Upload failed', error); return }
                              const { data } = supabase.storage.from('product-images').getPublicUrl(path)
                              setRefImageUrls(prev => { const next = [...prev]; next[i] = data.publicUrl; return next })
                            }} />
                            {refImageUrls[i] ? (
                              <>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={refImageUrls[i]} alt="ref" className="w-full h-full object-cover" />
                                <button onClick={(e) => { e.preventDefault(); setRefImageUrls(prev => { const next = [...prev]; next[i] = ''; return next }) }}
                                  className="absolute top-1 right-1 bg-white rounded-full p-0.5 shadow">
                                  <X className="w-3 h-3 text-zinc-500" />
                                </button>
                              </>
                            ) : (
                              <div className="flex flex-col items-center gap-1">
                                <Upload className="w-4 h-4 text-zinc-300" />
                                <span className="text-xs text-zinc-400">Ref {i + 1}</span>
                              </div>
                            )}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1.5">Video length</label>
                  <div className="flex gap-2">
                    {VIDEO_LENGTHS.map((l) => (
                      <button key={l.value} onClick={() => setVideoLength(l.value as 5 | 10)}
                        className={cn('flex-1 rounded-lg border p-2.5 text-center text-sm font-semibold transition-all',
                          videoLength === l.value ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white hover:border-zinc-300 text-zinc-700'
                        )}>
                        {l.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Caption direction notes */}
            {task === 'caption' && (
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1.5">Caption direction <span className="text-zinc-400 font-normal">(optional)</span></label>
                <textarea
                  rows={2}
                  value={captionNotes}
                  onChange={e => setCaptionNotes(e.target.value)}
                  placeholder="e.g. focus on the flower shop vibe, make it feel dreamy and romantic..."
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-800 placeholder-zinc-400 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
              </div>
            )}

            {/* Language — text tasks */}
            {['caption', 'description', 'email'].includes(task) && (
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1.5">Language</label>
                <div className="flex gap-2">
                  {LANGUAGES.map((l) => (
                    <button key={l.value} onClick={() => setLanguage(l.value as CreatorInput['language'])}
                      className={cn('flex-1 rounded-lg border py-2 text-xs font-medium transition-all',
                        language === l.value ? 'border-violet-600 bg-violet-50 text-violet-700' : 'border-zinc-200 bg-white hover:border-zinc-300 text-zinc-600'
                      )}>
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Generate button */}
            <Button
              onClick={handleGenerate}
              loading={loading}
              disabled={!canGenerate && (needsProduct || needsPrompt)}
              className="w-full bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700 text-white border-0"
              size="lg"
            >
              {loading
                ? (task === 'video' ? 'Generating video (~1 min)…' : 'Generating…')
                : <><Sparkles className="w-4 h-4" /> Generate {taskDef.label} <ArrowRight className="w-4 h-4" /></>
              }
            </Button>

          </CardContent>
        </Card>
      </div>

      {/* ── Result ── */}
      <AnimatePresence>
        {(result || error) && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card className="border-violet-100">
              <CardContent className="pt-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn('w-6 h-6 rounded-md flex items-center justify-center', taskDef.color)}>
                      <taskDef.icon className="w-3.5 h-3.5 text-white" />
                    </div>
                    <p className="text-sm font-semibold text-zinc-800">Generated {taskDef.label}</p>
                    <Badge variant="success">Done</Badge>
                  </div>
                  <button onClick={reset} className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600">
                    <RotateCcw className="w-3 h-3" /> New
                  </button>
                </div>

                {error && (
                  <div className="rounded-xl bg-red-50 border border-red-100 p-4">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                {/* Text output */}
                {typeof result?.text === 'string' && (
                  <div className="space-y-3">
                    <div className="relative">
                      <pre className="text-sm text-zinc-800 whitespace-pre-wrap font-sans leading-relaxed bg-zinc-50 rounded-xl border border-zinc-100 p-4 pr-12">
                        {result.text}
                      </pre>
                      <button onClick={copyText}
                        className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-zinc-200 text-zinc-400 hover:text-zinc-700 transition-colors">
                        {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                    {task === 'caption' && resultMediaUrl && (
                      <TikTokPostButton videoUrl={resultMediaUrl} caption={result.text} />
                    )}
                  </div>
                )}

                {/* Image output */}
                {((): React.ReactNode => {
                  if (typeof result?.imageUrl !== 'string') return null
                  const url = result.imageUrl
                  return (
                    <div className="rounded-xl overflow-hidden border border-zinc-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="Generated" className="w-full" />
                    </div>
                  )
                })()}

                {/* Video output */}
                {((): React.ReactNode => {
                  if (typeof result?.videoUrl !== 'string') return null
                  const url = result.videoUrl
                  return (
                    <div className="space-y-3">
                      <div className="rounded-xl overflow-hidden border border-zinc-200 bg-zinc-900">
                        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                        <video src={url} controls className="w-full" />
                      </div>
                      <TikTokPostButton videoUrl={url} caption={typeof result?.caption === 'string' ? result.caption : ''} />
                    </div>
                  )
                })()}

                {/* Canva link */}
                {((): React.ReactNode => {
                  const design = result?.design as Record<string, unknown> | undefined
                  if (!design || typeof design.editUrl !== 'string') return null
                  const editUrl = design.editUrl
                  return (
                    <div className="rounded-xl bg-pink-50 border border-pink-100 p-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-pink-900">Canva design created!</p>
                        <p className="text-xs text-pink-600 mt-0.5">Your template is ready to customise</p>
                      </div>
                      <a href={editUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-sm font-medium text-pink-700 hover:underline">
                        Open in Canva <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )
                })()}

                <p className="text-xs text-zinc-400">✓ Saved to Content Library</p>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Content Library ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-zinc-700">Content Library</h2>
          {library.length > 0 && <Badge variant="default">{library.length} items</Badge>}
        </div>
        {libraryLoading
          ? <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" /></div>
          : <ContentLibrary items={library} />
        }
      </div>

    </div>
  )
}
