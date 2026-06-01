'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Sparkles, Type, FileText, Mail, Image, Video, Layout,
  ChevronDown, ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ContentLibrary } from '@/components/agents/content-library'
import { MediaReference } from '@/components/agents/media-reference'
import { cn } from '@/lib/utils'
import type { ContentItem, ContentType, CreatorInput } from '@/types'
import type { ImageAnalysis } from '@/lib/anthropic'

const tasks: {
  id: ContentType
  label: string
  icon: typeof Type
  description: string
  color: string
  fields: string[]
}[] = [
  {
    id: 'caption',
    label: 'Caption',
    icon: Type,
    description: 'Write platform-optimised social captions',
    color: 'bg-violet-500',
    fields: ['product', 'platform', 'tone'],
  },
  {
    id: 'description',
    label: 'Product Description',
    icon: FileText,
    description: 'Craft compelling e-commerce product copy',
    color: 'bg-blue-500',
    fields: ['product', 'tone'],
  },
  {
    id: 'email',
    label: 'Promo Email',
    icon: Mail,
    description: 'Full email with subject line and body copy',
    color: 'bg-amber-500',
    fields: ['product', 'tone'],
  },
  {
    id: 'image',
    label: 'AI Image',
    icon: Image,
    description: 'Generate editorial fashion imagery via DALL-E 3',
    color: 'bg-emerald-500',
    fields: ['product', 'prompt'],
  },
  {
    id: 'video',
    label: 'Short Video',
    icon: Video,
    description: 'Generate short clips via Runway ML',
    color: 'bg-red-500',
    fields: ['product', 'prompt'],
  },
  {
    id: 'canva',
    label: 'Canva Template',
    icon: Layout,
    description: 'Auto-create a Canva design template',
    color: 'bg-pink-500',
    fields: ['product'],
  },
]

const platforms = ['Instagram', 'TikTok', 'Pinterest', 'Twitter/X', 'LinkedIn', 'Facebook']
const tones = ['Aspirational', 'Playful', 'Luxury', 'Minimal', 'Bold', 'Romantic']

export default function CreatorPage() {
  const [selectedTask, setSelectedTask] = useState<ContentType>('caption')
  const [product, setProduct] = useState('')
  const [platform, setPlatform] = useState('Instagram')
  const [tone, setTone] = useState('Aspirational')
  const [prompt, setPrompt] = useState('')
  const [additionalContext, setAdditionalContext] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [library, setLibrary] = useState<ContentItem[]>([])
  const [libraryLoading, setLibraryLoading] = useState(true)
  const [imageAnalysis, setImageAnalysis] = useState<ImageAnalysis | null>(null)

  const task = tasks.find((t) => t.id === selectedTask)!

  const fetchLibrary = useCallback(async () => {
    setLibraryLoading(true)
    try {
      const res = await fetch('/api/content-library')
      const data = await res.json()
      setLibrary(data.items ?? [])
    } catch {
      // silently fail — library is non-critical
    } finally {
      setLibraryLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLibrary()
  }, [fetchLibrary])

  async function handleGenerate() {
    if (!product && !prompt) return
    setLoading(true)
    setResult(null)
    setError(null)

    // Build image context string to inject into the request
    const imageContext = imageAnalysis
      ? `\n\nIMAGE REFERENCE CONTEXT (from uploaded photo):\n- Product shown: ${imageAnalysis.product}\n- Colors: ${imageAnalysis.colors.join(', ')}\n- Silhouette: ${imageAnalysis.silhouette}\n- Mood: ${imageAnalysis.mood}\n- Styling: ${imageAnalysis.styling}\n- Caption angle: ${imageAnalysis.captionAngle}\nWrite content that directly references or is inspired by this specific image.`
      : ''

    const body: CreatorInput = {
      task: selectedTask,
      product: product || imageAnalysis?.product || undefined,
      platform,
      tone,
      prompt: prompt || undefined,
      additionalContext: (additionalContext || '') + imageContext || undefined,
    }

    try {
      const res = await fetch('/api/agents/creator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error ?? 'Generation failed')
      setResult(data)
      await fetchLibrary()
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
            <div className="w-8 h-8 rounded-lg bg-violet-500 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-zinc-900">Content Creator</h1>
          </div>
          <p className="text-sm text-zinc-500">Generate captions, images, videos, emails, and Canva templates</p>
        </div>
        <Badge variant="info">Claude + DALL-E 3 + Runway</Badge>
      </div>

      {/* Unified image + video reference */}
      <MediaReference
        onImageAnalysis={(analysis) => setImageAnalysis(analysis)}
        onClear={() => setImageAnalysis(null)}
        platform={platform}
        tone={tone}
        showVideoCaptions={selectedTask === 'caption'}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT — controls */}
        <div className="lg:col-span-1 space-y-5">

          {/* Image analysis badge */}
          {imageAnalysis && (
            <div className="rounded-xl bg-violet-50 border border-violet-100 px-3 py-2 flex items-center gap-2">
              <span className="text-xs">🖼️</span>
              <p className="text-xs text-violet-700 font-medium">
                Image context active — content will reference your uploaded photo
              </p>
            </div>
          )}

          {/* Task selector */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">What do you want to create?</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              {tasks.map((t) => {
                const Icon = t.icon
                const active = selectedTask === t.id
                return (
                  <button
                    key={t.id}
                    onClick={() => { setSelectedTask(t.id); setResult(null); setError(null) }}
                    className={cn(
                      'flex flex-col items-start gap-1.5 rounded-xl p-3 border text-left transition-all',
                      active
                        ? 'border-zinc-900 bg-zinc-900 text-white shadow-sm'
                        : 'border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50'
                    )}
                  >
                    <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', active ? 'bg-white/20' : t.color)}>
                      <Icon className={cn('w-3.5 h-3.5', active ? 'text-white' : 'text-white')} />
                    </div>
                    <span className={cn('text-xs font-medium leading-tight', active ? 'text-white' : 'text-zinc-700')}>
                      {String(t.label)}
                    </span>
                  </button>
                )
              })}
            </CardContent>
          </Card>

          {/* Fields */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{task.label} Settings</CardTitle>
              <CardDescription>{task.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {task.fields.includes('product') && (
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1.5">Product / Subject</label>
                  <Input
                    value={product}
                    onChange={(e) => setProduct(e.target.value)}
                    placeholder="e.g. silk slip dress in champagne"
                  />
                </div>
              )}

              {task.fields.includes('platform') && (
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1.5">Platform</label>
                  <div className="relative">
                    <select
                      value={platform}
                      onChange={(e) => setPlatform(e.target.value)}
                      className="w-full appearance-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
                    >
                      {platforms.map((p) => <option key={p}>{p}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-2.5 w-4 h-4 text-zinc-400" />
                  </div>
                </div>
              )}

              {task.fields.includes('tone') && (
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1.5">Tone</label>
                  <div className="flex flex-wrap gap-1.5">
                    {tones.map((t) => (
                      <button
                        key={t}
                        onClick={() => setTone(t)}
                        className={cn(
                          'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                          tone === t
                            ? 'bg-zinc-900 text-white border-zinc-900'
                            : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {task.fields.includes('prompt') && (
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1.5">
                    Custom Prompt <span className="text-zinc-400">(optional)</span>
                  </label>
                  <Textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe exactly what you want..."
                    rows={3}
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1.5">
                  Additional Context <span className="text-zinc-400">(optional)</span>
                </label>
                <Textarea
                  value={additionalContext}
                  onChange={(e) => setAdditionalContext(e.target.value)}
                  placeholder="Brand guidelines, seasonal notes, campaign theme..."
                  rows={2}
                />
              </div>

              <Button
                onClick={handleGenerate}
                loading={loading}
                disabled={!product && !prompt}
                className="w-full"
                size="lg"
              >
                {loading ? 'Generating…' : (
                  <>Generate <ArrowRight className="w-4 h-4" /></>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT — result */}
        <div className="lg:col-span-2 space-y-5">
          {/* Live result */}
          {(result || error || loading) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <div className={cn('w-6 h-6 rounded-md flex items-center justify-center', task.color)}>
                    <task.icon className="w-3.5 h-3.5 text-white" />
                  </div>
                  Generated {task.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center py-16 gap-3"
                  >
                    <div className="w-8 h-8 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-zinc-500">
                      {selectedTask === 'video' ? 'Generating video (this takes ~1 min)…' : 'Generating with AI…'}
                    </p>
                  </motion.div>
                )}

                {error && (
                  <div className="rounded-xl bg-red-50 border border-red-100 p-4">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                {result && !loading && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                    {/* Text output */}
                    {typeof result.text === 'string' && (
                      <div className="rounded-xl bg-zinc-50 border border-zinc-100 p-4">
                        <pre className="text-sm text-zinc-800 whitespace-pre-wrap font-sans leading-relaxed">
                          {result.text}
                        </pre>
                      </div>
                    )}

                    {/* Image output */}
                    {typeof result.imageUrl === 'string' ? (
                      <div className="rounded-xl overflow-hidden border border-zinc-200">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={result.imageUrl} alt="Generated" className="w-full" />
                      </div>
                    ) : null}

                    {/* Video output */}
                    {typeof result.videoUrl === 'string' ? (
                      <div className="rounded-xl overflow-hidden border border-zinc-200 bg-zinc-900">
                        <video src={result.videoUrl} controls className="w-full" />
                      </div>
                    ) : null}

                    {/* Canva link */}
                    {result.design && typeof (result.design as Record<string, unknown>).editUrl === 'string' ? (
                      <div className="rounded-xl bg-pink-50 border border-pink-100 p-4 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-pink-900">Canva design created!</p>
                          <p className="text-xs text-pink-600 mt-0.5">Your template is ready to customise</p>
                        </div>
                        <a
                          href={(result.design as Record<string, unknown>).editUrl as string}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-pink-700 underline"
                        >
                          Open in Canva →
                        </a>
                      </div>
                    ) : null}

                    <p className="text-xs text-zinc-400">Saved to Content Library ✓</p>
                  </motion.div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Content library */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-zinc-700">Content Library</h2>
              {library.length > 0 && (
                <Badge variant="default">{library.length} items</Badge>
              )}
            </div>
            {libraryLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
              </div>
            ) : (
              <ContentLibrary items={library} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
