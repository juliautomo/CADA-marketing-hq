'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, Type, FileText, Mail, Image, Video, Layout,
  ArrowRight, Copy, Check, ExternalLink, RotateCcw, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MediaReference } from '@/components/agents/media-reference'
import { ContentLibrary } from '@/components/agents/content-library'
import { cn } from '@/lib/utils'
import type { ContentItem, ContentType, CreatorInput } from '@/types'
import type { ImageAnalysis } from '@/lib/anthropic'
import type { VideoAnalysis } from '@/app/api/analyze-video/route'

// ── Task definitions ───────────────────────────────────────────────────────────
const TASKS = [
  { id: 'caption'      as ContentType, label: 'Caption',      icon: Type,     color: 'bg-violet-500', description: 'Social media captions with hashtags' },
  { id: 'description'  as ContentType, label: 'Description',  icon: FileText, color: 'bg-blue-500',   description: 'E-commerce product copy for Shopee' },
  { id: 'email'        as ContentType, label: 'Promo Email',  icon: Mail,     color: 'bg-amber-500',  description: 'Full email with subject line & CTA' },
  { id: 'image'        as ContentType, label: 'AI Image',     icon: Image,    color: 'bg-emerald-500',description: 'Generate fashion imagery via DALL-E 3' },
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

export default function CreatorPage() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [task, setTask]                 = useState<ContentType>('caption')
  const [product, setProduct]           = useState('')
  const [platform, setPlatform]         = useState('Instagram')
  const [tone, setTone]                 = useState('Aspirational')
  const [language, setLanguage]         = useState<CreatorInput['language']>('english')
  const [captionLength, setCaptionLen]  = useState<CreatorInput['captionLength']>('standard')
  const [videoLength, setVideoLength]   = useState<5 | 10>(5)
  const [customPrompt, setCustomPrompt] = useState('')
  const [imageAnalysis, setImageAnalysis] = useState<ImageAnalysis | null>(null)
  const [videoAnalysis, setVideoAnalysis] = useState<VideoAnalysis | null>(null)

  const [loading, setLoading]   = useState(false)
  const [result, setResult]     = useState<Record<string, unknown> | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const [copied, setCopied]     = useState(false)

  const [library, setLibrary]         = useState<ContentItem[]>([])
  const [libraryLoading, setLibraryLoading] = useState(true)
  const [products, setProducts]       = useState<import('@/types').Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<import('@/types').Product | null>(null)

  const taskDef = TASKS.find(t => t.id === task)!

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

  // ── Generate ───────────────────────────────────────────────────────────────
  async function handleGenerate() {
    if (!product && !customPrompt && !imageAnalysis) return
    setLoading(true)
    setResult(null)
    setError(null)

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
      prompt:         customPrompt || undefined,
      additionalContext: (productContext + imageContext) || undefined,
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
  }

  const canGenerate = !!(product || customPrompt || imageAnalysis || videoAnalysis)
  const needsProduct = ['caption', 'description', 'email'].includes(task)
  const needsPrompt  = ['image', 'video'].includes(task)

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
        <Badge variant="info">Claude + DALL-E + Runway</Badge>
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

      {/* ── STEP 2: Reference (optional) ── */}
      <div>
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">2 — Add a reference <span className="normal-case font-normal text-zinc-300">(optional)</span></p>
        <MediaReference
          onImageAnalysis={(analysis) => setImageAnalysis(analysis)}
          onVideoAnalysis={(analysis) => setVideoAnalysis(analysis)}
          onClear={() => { setImageAnalysis(null); setVideoAnalysis(null) }}
          platform={platform}
          tone={tone}
        />
        {(imageAnalysis || videoAnalysis) && (
          <p className="text-xs text-violet-600 mt-2 flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> {videoAnalysis ? 'Video' : 'Image'} context active — click Generate below to create content
          </p>
        )}
      </div>

      {/* ── STEP 3: Settings ── */}
      <div>
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">3 — Settings</p>
        <Card>
          <CardContent className="pt-5 space-y-4">

            {/* Product picker from catalog */}
            {products.length > 0 && (needsProduct || task === 'canva') && (
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
                  {selectedProduct ? 'Additional context' : task === 'email' ? 'Product or campaign name' : 'Product / subject'}
                </label>
                <Input
                  value={product}
                  onChange={(e) => setProduct(e.target.value)}
                  placeholder={
                    selectedProduct ? 'Any extra notes (optional)…' :
                    task === 'email' ? 'e.g. Raya Eid Collection launch' :
                    task === 'canva' ? 'e.g. Linen wide-leg pants' :
                    'e.g. silk slip dress in champagne'
                  }
                />
              </div>
            )}

            {/* Custom prompt */}
            {needsPrompt && (
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1.5">
                  {task === 'video' ? 'Video description' : 'Image description'}
                  <span className="text-zinc-400 font-normal ml-1">(or leave blank for auto)</span>
                </label>
                <Textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder={
                    task === 'video'
                      ? 'e.g. Model walking through a garden in a flowy abaya, golden hour lighting'
                      : 'e.g. Editorial flat lay of the dress with fresh flowers, minimal aesthetic'
                  }
                  rows={2}
                />
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

            {/* Video length */}
            {task === 'video' && (
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
                  <div className="relative">
                    <pre className="text-sm text-zinc-800 whitespace-pre-wrap font-sans leading-relaxed bg-zinc-50 rounded-xl border border-zinc-100 p-4 pr-12">
                      {result.text}
                    </pre>
                    <button onClick={copyText}
                      className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-zinc-200 text-zinc-400 hover:text-zinc-700 transition-colors">
                      {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
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
                    <div className="rounded-xl overflow-hidden border border-zinc-200 bg-zinc-900">
                      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                      <video src={url} controls className="w-full" />
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
