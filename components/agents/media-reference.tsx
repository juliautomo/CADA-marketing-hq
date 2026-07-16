'use client'

import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload, Link, X, Loader2, Sparkles,
  Palette, ChevronDown, ChevronUp, Video as VideoIcon,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { ImageAnalysis } from '@/lib/anthropic'
import type { VideoAnalysis } from '@/app/api/analyze-video/route'

interface MediaReferenceProps {
  onImageAnalysis: (analysis: ImageAnalysis, preview: string) => void
  onVideoAnalysis: (analysis: VideoAnalysis, preview: string) => void
  onRawMedia?: (url: string, preview: string) => void
  onClear: () => void
  platform?: string
  tone?: string
  skipAnalysis?: boolean  // true for image/video generation tasks
}

type MediaType = 'image' | 'video'
type InputMode = 'upload' | 'url'

const MAX_FRAMES = 5

export function MediaReference({
  onImageAnalysis,
  onVideoAnalysis,
  onRawMedia,
  onClear,
  platform = 'Instagram',
  tone = 'Aspirational',
  skipAnalysis = false,
}: MediaReferenceProps) {
  const [mediaType, setMediaType]         = useState<MediaType | null>(null)
  const [mode, setMode]                   = useState<InputMode>('upload')
  const [preview, setPreview]             = useState<string | null>(null)
  const [driveUrl, setDriveUrl]           = useState('')
  const [analysing, setAnalysing]         = useState(false)
  const [imageAnalysis, setImageAnalysis] = useState<ImageAnalysis | null>(null)
  const [videoAnalysis, setVideoAnalysis] = useState<VideoAnalysis | null>(null)
  const [error, setError]                 = useState<string | null>(null)
  const [expanded, setExpanded]           = useState(true)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef     = useRef<HTMLVideoElement>(null)

  // ── Image compression ──────────────────────────────────────────────────────
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
          width  = Math.round(width * scale)
          height = Math.round(height * scale)
        }
        canvas.width  = width
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

  // ── Video frame extraction ─────────────────────────────────────────────────
  function extractFrames(video: HTMLVideoElement, n: number): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas')
      const ctx    = canvas.getContext('2d')
      if (!ctx) return reject(new Error('Canvas not supported'))
      const duration = video.duration
      const times    = Array.from({ length: n }, (_, i) => (duration / (n + 1)) * (i + 1))
      canvas.width   = Math.min(video.videoWidth, 768)
      canvas.height  = Math.round(canvas.width * (video.videoHeight / video.videoWidth))
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

    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      setError('Please upload an image or video file.')
      return
    }

    const objectUrl = URL.createObjectURL(file)
    setMediaType(file.type.startsWith('image/') ? 'image' : 'video')
    setPreview(objectUrl)

    // Skip Claude analysis for image/video generation — upload to Supabase and use as starting frame
    if (skipAnalysis) {
      const ext = file.name.split('.').pop()
      const path = `starting-frames/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('product-images').upload(path, file, { upsert: true })
      if (uploadError) { setError('Upload failed: ' + uploadError.message); return }
      const { data } = supabase.storage.from('product-images').getPublicUrl(path)
      onRawMedia?.(data.publicUrl, objectUrl)
      return
    }

    setAnalysing(true)

    if (file.type.startsWith('image/')) {
      try {
        let upload: File | Blob = file
        if (file.size > 4 * 1024 * 1024) upload = await compressImage(file)

        // Upload to Supabase so we have a public URL for scheduling/posting
        const ext = file.name.split('.').pop()
        const path = `starting-frames/${Date.now()}.${ext}`
        const { error: uploadError } = await supabase.storage.from('product-images').upload(path, upload, { upsert: true })
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(path)
          onRawMedia?.(urlData.publicUrl, objectUrl)
        }

        const form = new FormData()
        form.append('image', upload, file.name)
        const res  = await fetch('/api/analyze-image', { method: 'POST', body: form })
        const data = await res.json()
        if (!data.success) throw new Error(data.error)
        setImageAnalysis(data.analysis)
        onImageAnalysis(data.analysis, objectUrl)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Image analysis failed')
        setPreview(null)
      }

    } else {
      try {
        await new Promise<void>((res, rej) => {
          const v = videoRef.current!
          v.onloadedmetadata = () => res()
          v.onerror = () => rej(new Error('Could not load video'))
          v.src = objectUrl
          v.load()
        })
        // Upload video to Supabase so we have a public URL for TikTok posting
        const ext = file.name.split('.').pop()
        const path = `${Date.now()}.${ext}`
        const { error: uploadError } = await supabase.storage.from('videos').upload(path, file, { upsert: true })
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('videos').getPublicUrl(path)
          onRawMedia?.(urlData.publicUrl, objectUrl)
        }
        const frames = await extractFrames(videoRef.current!, MAX_FRAMES)
        const res    = await fetch('/api/analyze-video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ frames, platform, tone }),
        })
        const data = await res.json()
        if (!data.success) throw new Error(data.error)
        setVideoAnalysis(data.analysis)
        onVideoAnalysis(data.analysis, objectUrl)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Video analysis failed')
        setPreview(null)
      }
    }

    setAnalysing(false)
  }, [onImageAnalysis, onVideoAnalysis, onRawMedia, skipAnalysis, platform, tone])

  const analyseUrl = useCallback(async () => {
    if (!driveUrl.trim()) return
    setAnalysing(true)
    setError(null)
    setImageAnalysis(null)
    setPreview(null)
    setMediaType('image')
    try {
      const res  = await fetch('/api/analyze-image', {
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

  function clear() {
    setMediaType(null)
    setPreview(null)
    setImageAnalysis(null)
    setVideoAnalysis(null)
    setError(null)
    setExpanded(true)
    setDriveUrl('')
    if (fileInputRef.current) fileInputRef.current.value = ''
    onClear()
  }

  const hasResult  = imageAnalysis || videoAnalysis
  const hasRawMedia = skipAnalysis && !!preview

  return (
    <Card className="border-violet-100 bg-gradient-to-br from-violet-50/40 to-pink-50/40">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video ref={videoRef} className="hidden" playsInline muted />

      <CardContent className="pt-4 pb-4">
        {/* Header */}
        <button onClick={() => setExpanded(v => !v)} className="w-full flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-violet-500 flex items-center justify-center">
              <Upload className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-semibold text-zinc-800">Image / Video Reference</span>
            {!skipAnalysis && <Badge variant="info" className="text-xs">Claude Vision</Badge>}
            {skipAnalysis && <Badge variant="default" className="text-xs">Starting frame</Badge>}
            {hasResult && <Badge variant="success" className="text-xs">Analysed ✓</Badge>}
            {skipAnalysis && preview && !hasResult && <Badge variant="success" className="text-xs">Ready ✓</Badge>}
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
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
              {/* Raw media preview (skip analysis mode) */}
              {hasRawMedia && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview!} alt="Reference" className="w-20 h-20 object-cover rounded-xl flex-shrink-0 border border-zinc-200" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-zinc-800">Starting frame ready</p>
                    <p className="text-xs text-zinc-400 mt-0.5">Will be used directly by the video/image generator</p>
                  </div>
                  <button onClick={clear} className="text-zinc-400 hover:text-zinc-600"><X className="w-4 h-4" /></button>
                </motion.div>
              )}

              {/* Upload / URL tabs */}
              {!hasResult && !analysing && !hasRawMedia && (
                <>
                  <div className="flex rounded-lg border border-zinc-200 overflow-hidden">
                    {(['upload', 'url'] as InputMode[]).map((m) => (
                      <button key={m} onClick={() => setMode(m)}
                        className={cn('flex-1 py-2 text-xs font-medium transition-colors flex items-center justify-center gap-1.5',
                          mode === m ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-600 hover:bg-zinc-50'
                        )}>
                        {m === 'upload' ? <><Upload className="w-3 h-3" /> Upload</> : <><Link className="w-3 h-3" /> Drive link</>}
                      </button>
                    ))}
                  </div>

                  {mode === 'upload' ? (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
                      className="w-full border-2 border-dashed border-violet-200 rounded-xl p-6 flex flex-col items-center gap-2 hover:border-violet-400 hover:bg-violet-50 transition-colors"
                    >
                      <Upload className="w-6 h-6 text-violet-400" />
                      <p className="text-sm text-zinc-600 font-medium">Drop image or video here</p>
                      <p className="text-xs text-zinc-400">JPG · PNG · WebP · MP4 · MOV</p>
                      <p className="text-xs text-violet-500 mt-1">{skipAnalysis ? '🎬 Used directly as starting frame — no API cost' : '✨ Claude analyses your media and uses it as context for generation'}</p>
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <Input value={driveUrl} onChange={(e) => setDriveUrl(e.target.value)}
                        placeholder="Paste Google Drive link or image URL…" className="flex-1 text-sm"
                        onKeyDown={(e) => e.key === 'Enter' && analyseUrl()} />
                      <Button onClick={analyseUrl} disabled={!driveUrl.trim()} size="sm">Analyse</Button>
                    </div>
                  )}

                  <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
                </>
              )}

              {/* Analysing spinner */}
              {analysing && (
                <div className="flex flex-col items-center justify-center gap-2 py-8">
                  <Loader2 className="w-5 h-5 text-violet-500 animate-spin" />
                  <p className="text-sm text-zinc-600">
                    {mediaType === 'video' ? `Extracting ${MAX_FRAMES} frames and analysing…` : 'Analysing with Claude…'}
                  </p>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="rounded-lg bg-red-50 border border-red-100 p-3">
                  <p className="text-xs text-red-700">{error}</p>
                  <button onClick={clear} className="text-xs text-red-500 underline mt-1">Try again</button>
                </div>
              )}

              {/* Image result */}
              {imageAnalysis && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                  <div className="flex gap-3">
                    {preview && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={preview} alt="Reference" className="w-20 h-20 object-cover rounded-xl flex-shrink-0 border border-zinc-200" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-zinc-800 mb-0.5">{imageAnalysis.product}</p>
                      <p className="text-xs text-zinc-500 leading-relaxed">{imageAnalysis.description}</p>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {imageAnalysis.colors.map((c) => (
                          <span key={c} className="text-xs bg-white border border-zinc-200 px-2 py-0.5 rounded-full text-zinc-600">
                            <Palette className="w-2.5 h-2.5 inline mr-0.5" />{c}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button onClick={clear} className="flex-shrink-0 text-zinc-400 hover:text-zinc-600"><X className="w-4 h-4" /></button>
                  </div>

                  <p className="text-xs text-violet-600 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Context active — click Generate below to create content based on this image
                  </p>
                </motion.div>
              )}

              {/* Video result */}
              {videoAnalysis && preview && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                  <div className="flex gap-3">
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                    <video src={preview} className="w-20 h-20 object-cover rounded-xl flex-shrink-0 border border-zinc-200 bg-zinc-900" muted loop autoPlay playsInline />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <VideoIcon className="w-3 h-3 text-zinc-400" />
                        <p className="text-sm font-semibold text-zinc-800">{videoAnalysis.product}</p>
                      </div>
                      <p className="text-xs text-zinc-500 leading-relaxed">{videoAnalysis.description}</p>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {videoAnalysis.colors.map((c) => (
                          <span key={c} className="text-xs bg-white border border-zinc-200 px-2 py-0.5 rounded-full text-zinc-600">{c}</span>
                        ))}
                        <span className="text-xs bg-white border border-zinc-200 px-2 py-0.5 rounded-full text-zinc-500 italic">{videoAnalysis.setting}</span>
                      </div>
                    </div>
                    <button onClick={clear} className="flex-shrink-0 text-zinc-400 hover:text-zinc-600"><X className="w-4 h-4" /></button>
                  </div>

                  <p className="text-xs text-violet-600 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Context active — click Generate to create a caption based on this video
                  </p>

                  <button onClick={clear} className="text-xs text-zinc-400 hover:text-zinc-600 underline">Upload a different file</button>
                </motion.div>
              )}

            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  )
}
