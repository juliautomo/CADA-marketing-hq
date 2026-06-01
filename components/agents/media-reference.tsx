'use client'

import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload, Link, X, Loader2, Sparkles,
  Wand2, Palette, ChevronDown, ChevronUp, Check, Copy,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { ImageAnalysis } from '@/lib/anthropic'
import type { VideoAnalysis } from '@/app/api/analyze-video/route'

interface MediaReferenceProps {
  onImageAnalysis: (analysis: ImageAnalysis, preview: string) => void
  onClear: () => void
  platform?: string
  tone?: string
  showVideoCaptions?: boolean   // true when Caption task is selected
}

type MediaType = 'image' | 'video'
type InputMode = 'upload' | 'url'

const MAX_FRAMES = 5

export function MediaReference({
  onImageAnalysis,
  onClear,
  platform = 'Instagram',
  tone = 'Aspirational',
  showVideoCaptions = false,
}: MediaReferenceProps) {
  const [mediaType, setMediaType] = useState<MediaType | null>(null)
  const [mode, setMode] = useState<InputMode>('upload')
  const [preview, setPreview] = useState<string | null>(null)     // image data URL or object URL
  const [driveUrl, setDriveUrl] = useState('')
  const [analysing, setAnalysing] = useState(false)
  const [imageAnalysis, setImageAnalysis] = useState<ImageAnalysis | null>(null)
  const [videoAnalysis, setVideoAnalysis] = useState<VideoAnalysis | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(true)
  const [activeCaption, setActiveCaption] = useState<'instagram' | 'tiktok'>('instagram')
  const [copied, setCopied] = useState<string | null>(null)
  const [customInstructions, setCustomInstructions] = useState('')
  const [similarImageUrl, setSimilarImageUrl] = useState<string | null>(null)
  const [generatingSimilar, setGeneratingSimilar] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  // ── Image helpers ──────────────────────────────────────────────────────────

  async function compressImage(file: File, maxBytes = 3.5 * 1024 * 1024): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(url)
        const canvas = document.createElement('canvas')
        let { width, height } = img
        const maxDim = 1920
        if (width > maxDim || height > maxDim) {
          const scale = Math.min(maxDim / width, maxDim / height)
          width = Math.round(width * scale)
          height = Math.round(height * scale)
        }
        canvas.width = width
        canvas.height = height
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
        let quality = 0.85
        const tryCompress = () => {
          canvas.toBlob((blob) => {
            if (!blob) return reject(new Error('Compression failed'))
            if (blob.size <= maxBytes || quality < 0.3) return resolve(blob)
            quality -= 0.1
            tryCompress()
          }, 'image/jpeg', quality)
        }
        tryCompress()
      }
      img.onerror = reject
      img.src = url
    })
  }

  // ── Video helpers ──────────────────────────────────────────────────────────

  function extractFrames(video: HTMLVideoElement, n: number): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('Canvas not supported'))
      const duration = video.duration
      const times = Array.from({ length: n }, (_, i) => (duration / (n + 1)) * (i + 1))
      canvas.width = Math.min(video.videoWidth, 768)
      canvas.height = Math.round(canvas.width * (video.videoHeight / video.videoWidth))
      const frames: string[] = []
      let idx = 0
      function seekNext() {
        if (idx >= times.length) return resolve(frames)
        video.currentTime = times[idx]
      }
      video.onseeked = () => {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        frames.push(canvas.toDataURL('image/jpeg', 0.8).split(',')[1])
        idx++
        seekNext()
      }
      video.onerror = () => reject(new Error('Video error during frame extraction'))
      seekNext()
    })
  }

  // ── File handler ───────────────────────────────────────────────────────────

  const handleFile = useCallback(async (file: File) => {
    setError(null)
    setImageAnalysis(null)
    setVideoAnalysis(null)
    setSimilarImageUrl(null)
    setAnalysing(true)

    if (file.type.startsWith('image/')) {
      setMediaType('image')
      const reader = new FileReader()
      reader.onload = (e) => setPreview(e.target?.result as string)
      reader.readAsDataURL(file)

      try {
        let upload: File | Blob = file
        if (file.size > 4 * 1024 * 1024) upload = await compressImage(file)
        const form = new FormData()
        form.append('image', upload, file.name)
        const res = await fetch('/api/analyze-image', { method: 'POST', body: form })
        const data = await res.json()
        if (!data.success) throw new Error(data.error)
        setImageAnalysis(data.analysis)
        onImageAnalysis(data.analysis, URL.createObjectURL(file))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Image analysis failed')
        setPreview(null)
      }

    } else if (file.type.startsWith('video/')) {
      setMediaType('video')
      const url = URL.createObjectURL(file)
      setPreview(url)

      try {
        await new Promise<void>((res, rej) => {
          const v = videoRef.current!
          v.onloadedmetadata = () => res()
          v.onerror = () => rej(new Error('Could not load video'))
          v.src = url
          v.load()
        })
        const frames = await extractFrames(videoRef.current!, MAX_FRAMES)
        const res = await fetch('/api/analyze-video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ frames, platform, tone }),
        })
        const data = await res.json()
        if (!data.success) throw new Error(data.error)
        setVideoAnalysis(data.analysis)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Video analysis failed')
        setPreview(null)
      }

    } else {
      setError('Please upload an image or video file.')
    }

    setAnalysing(false)
  }, [onImageAnalysis, platform, tone])

  const analyseUrl = useCallback(async () => {
    if (!driveUrl.trim()) return
    setAnalysing(true)
    setError(null)
    setImageAnalysis(null)
    setPreview(null)
    setMediaType('image')
    try {
      const res = await fetch('/api/analyze-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: driveUrl }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setImageAnalysis(data.analysis)
      setPreview(driveUrl)
      onImageAnalysis(data.analysis, driveUrl)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed')
    } finally {
      setAnalysing(false)
    }
  }, [driveUrl, onImageAnalysis])

  async function handleSimilarImage() {
    if (!imageAnalysis) return
    setGeneratingSimilar(true)
    setSimilarImageUrl(null)
    try {
      const res = await fetch('/api/agents/creator/similar-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysis: imageAnalysis, customInstructions }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setSimilarImageUrl(data.imageUrl)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setGeneratingSimilar(false)
    }
  }

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  function clear() {
    setMediaType(null)
    setPreview(null)
    setImageAnalysis(null)
    setVideoAnalysis(null)
    setError(null)
    setSimilarImageUrl(null)
    setDriveUrl('')
    if (fileInputRef.current) fileInputRef.current.value = ''
    onClear()
  }

  const hasResult = imageAnalysis || videoAnalysis
  const isDone = !!hasResult

  return (
    <Card className="border-violet-100 bg-gradient-to-br from-violet-50/40 to-pink-50/40">
      {/* hidden video element for frame extraction */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video ref={videoRef} className="hidden" playsInline muted />

      <CardContent className="pt-4 pb-4">
        {/* Header */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-between mb-3"
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-violet-500 flex items-center justify-center">
              <Upload className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-semibold text-zinc-800">Image / Video Reference</span>
            <Badge variant="info" className="text-xs">Claude Vision</Badge>
            {isDone && <Badge variant="success" className="text-xs">Analysed ✓</Badge>}
          </div>
          {expanded
            ? <ChevronUp className="w-4 h-4 text-zinc-400" />
            : <ChevronDown className="w-4 h-4 text-zinc-400" />}
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden space-y-3"
            >

              {/* ── Upload / URL tabs (only when empty) ── */}
              {!hasResult && !analysing && (
                <>
                  <div className="flex rounded-lg border border-zinc-200 overflow-hidden">
                    {(['upload', 'url'] as InputMode[]).map((m) => (
                      <button key={m} onClick={() => setMode(m)}
                        className={cn('flex-1 py-2 text-xs font-medium transition-colors flex items-center justify-center gap-1.5',
                          mode === m ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-600 hover:bg-zinc-50'
                        )}>
                        {m === 'upload'
                          ? <><Upload className="w-3 h-3" /> Upload</>
                          : <><Link className="w-3 h-3" /> Drive link</>}
                      </button>
                    ))}
                  </div>

                  {mode === 'upload' ? (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault()
                        const file = e.dataTransfer.files[0]
                        if (file) handleFile(file)
                      }}
                      className="w-full border-2 border-dashed border-violet-200 rounded-xl p-6 flex flex-col items-center gap-2 hover:border-violet-400 hover:bg-violet-50 transition-colors"
                    >
                      <Upload className="w-6 h-6 text-violet-400" />
                      <p className="text-sm text-zinc-600 font-medium">Drop image or video here</p>
                      <p className="text-xs text-zinc-400">JPG · PNG · WebP · MP4 · MOV</p>
                      {showVideoCaptions && (
                        <p className="text-xs text-violet-500 mt-1">
                          ✨ Upload a video → get instant Instagram & TikTok captions
                        </p>
                      )}
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        value={driveUrl}
                        onChange={(e) => setDriveUrl(e.target.value)}
                        placeholder="Paste Google Drive link or image URL…"
                        className="flex-1 text-sm"
                        onKeyDown={(e) => e.key === 'Enter' && analyseUrl()}
                      />
                      <Button onClick={analyseUrl} disabled={!driveUrl.trim()} size="sm">
                        Analyse
                      </Button>
                    </div>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleFile(file)
                    }}
                  />
                </>
              )}

              {/* ── Analysing spinner ── */}
              {analysing && (
                <div className="flex flex-col items-center justify-center gap-2 py-8">
                  <Loader2 className="w-5 h-5 text-violet-500 animate-spin" />
                  <p className="text-sm text-zinc-600">
                    {mediaType === 'video'
                      ? `Extracting ${MAX_FRAMES} frames and analysing with Claude…`
                      : 'Claude is analysing your image…'}
                  </p>
                </div>
              )}

              {/* ── Error ── */}
              {error && (
                <div className="rounded-lg bg-red-50 border border-red-100 p-3">
                  <p className="text-xs text-red-700">{error}</p>
                  <button onClick={clear} className="text-xs text-red-500 underline mt-1">Try again</button>
                </div>
              )}

              {/* ── IMAGE RESULT ── */}
              {imageAnalysis && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                  <div className="flex gap-3">
                    {preview && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={preview} alt="Reference" className="w-24 h-24 object-cover rounded-xl flex-shrink-0 border border-zinc-200" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-zinc-800 mb-1">{imageAnalysis.product}</p>
                      <p className="text-xs text-zinc-500 leading-relaxed line-clamp-2">{imageAnalysis.description}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {imageAnalysis.colors.map((c) => (
                          <span key={c} className="text-xs bg-white border border-zinc-200 px-2 py-0.5 rounded-full text-zinc-600">
                            <Palette className="w-2.5 h-2.5 inline mr-0.5" />{c}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button onClick={clear} className="flex-shrink-0 text-zinc-400 hover:text-zinc-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-white rounded-lg p-2.5 border border-zinc-100">
                      <p className="text-zinc-400 font-medium mb-0.5">Silhouette</p>
                      <p className="text-zinc-700">{imageAnalysis.silhouette}</p>
                    </div>
                    <div className="bg-white rounded-lg p-2.5 border border-zinc-100">
                      <p className="text-zinc-400 font-medium mb-0.5">Mood</p>
                      <p className="text-zinc-700">{imageAnalysis.mood}</p>
                    </div>
                  </div>

                  <p className="text-xs text-zinc-400 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-violet-400" />
                    Image context active — content will reference this photo
                  </p>

                  {/* Similar image */}
                  <div className="space-y-2">
                    <Input
                      value={customInstructions}
                      onChange={(e) => setCustomInstructions(e.target.value)}
                      placeholder="Custom instructions for similar image (optional)…"
                      className="text-xs"
                    />
                    <Button
                      onClick={handleSimilarImage}
                      loading={generatingSimilar}
                      variant="secondary"
                      size="sm"
                      className="w-full justify-start gap-2"
                    >
                      <Wand2 className="w-3.5 h-3.5 text-violet-500" />
                      Generate similar image with DALL-E 3
                    </Button>
                  </div>

                  {similarImageUrl && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={similarImageUrl} alt="Generated" className="w-full rounded-xl border border-zinc-200" />
                      <p className="text-xs text-emerald-600 mt-1">✓ Saved to Content Library</p>
                    </motion.div>
                  )}
                </motion.div>
              )}

              {/* ── VIDEO RESULT ── */}
              {videoAnalysis && preview && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                  {/* Preview + meta */}
                  <div className="flex gap-3">
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                    <video
                      src={preview}
                      className="w-24 h-24 object-cover rounded-xl flex-shrink-0 border border-zinc-200 bg-zinc-900"
                      muted loop autoPlay playsInline
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-zinc-800 mb-1">{videoAnalysis.product}</p>
                      <p className="text-xs text-zinc-500 leading-relaxed line-clamp-2">{videoAnalysis.description}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {videoAnalysis.colors.map((c) => (
                          <span key={c} className="text-xs bg-white border border-zinc-200 px-2 py-0.5 rounded-full text-zinc-600">{c}</span>
                        ))}
                        <span className="text-xs bg-white border border-zinc-200 px-2 py-0.5 rounded-full text-zinc-500 italic">{videoAnalysis.setting}</span>
                      </div>
                    </div>
                    <button onClick={clear} className="flex-shrink-0 text-zinc-400 hover:text-zinc-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Caption angle */}
                  <div className="bg-white rounded-lg p-2.5 border border-zinc-100">
                    <p className="text-xs text-zinc-400 font-medium mb-0.5 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-violet-400" /> Best caption angle
                    </p>
                    <p className="text-xs text-zinc-700">{videoAnalysis.captionAngle}</p>
                  </div>

                  {/* Captions — only shown for caption task */}
                  {showVideoCaptions && (
                    <div>
                      <div className="flex rounded-lg border border-zinc-200 overflow-hidden mb-2">
                        {(['instagram', 'tiktok'] as const).map((p) => (
                          <button key={p} onClick={() => setActiveCaption(p)}
                            className={cn(
                              'flex-1 py-2 text-xs font-medium transition-colors',
                              activeCaption === p
                                ? p === 'instagram'
                                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                                  : 'bg-zinc-900 text-white'
                                : 'bg-white text-zinc-600 hover:bg-zinc-50'
                            )}>
                            {p === 'instagram' ? '📸 Instagram' : '🎵 TikTok'}
                          </button>
                        ))}
                      </div>

                      <div className="relative">
                        <pre className="text-sm text-zinc-800 whitespace-pre-wrap font-sans leading-relaxed bg-white rounded-xl border border-zinc-100 p-4 pr-10">
                          {videoAnalysis.captions[activeCaption]}
                        </pre>
                        <button
                          onClick={() => copy(videoAnalysis.captions[activeCaption], activeCaption)}
                          className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600"
                        >
                          {copied === activeCaption
                            ? <Check className="w-4 h-4 text-emerald-500" />
                            : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  )}

                  <button onClick={clear} className="text-xs text-zinc-400 hover:text-zinc-600 underline">
                    Upload a different file
                  </button>
                </motion.div>
              )}

            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  )
}
