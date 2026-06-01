'use client'

import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload, X, Loader2, Video, Copy, Check,
  ChevronDown, ChevronUp, Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { VideoAnalysis } from '@/app/api/analyze-video/route'

interface VideoCaptionProps {
  platform: string
  tone: string
}

const MAX_FRAMES = 5
const MAX_VIDEO_MB = 100

export function VideoCaption({ platform, tone }: VideoCaptionProps) {
  const [videoSrc, setVideoSrc] = useState<string | null>(null)
  const [analysing, setAnalysing] = useState(false)
  const [analysis, setAnalysis] = useState<VideoAnalysis | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(true)
  const [copied, setCopied] = useState<'instagram' | 'tiktok' | null>(null)
  const [activeCaption, setActiveCaption] = useState<'instagram' | 'tiktok'>('instagram')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  // Extract N evenly-spaced frames from a video element as base64 JPEGs
  function extractFrames(video: HTMLVideoElement, n: number): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('Canvas not supported'))

      const duration = video.duration
      const times = Array.from({ length: n }, (_, i) =>
        (duration / (n + 1)) * (i + 1)   // evenly spaced, skip very start/end
      )
      const frames: string[] = []

      canvas.width = Math.min(video.videoWidth, 768)
      canvas.height = Math.round(canvas.width * (video.videoHeight / video.videoWidth))

      let idx = 0
      function seekNext() {
        if (idx >= times.length) return resolve(frames)
        video.currentTime = times[idx]
      }

      video.onseeked = () => {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
        frames.push(dataUrl.split(',')[1])   // strip "data:image/jpeg;base64,"
        idx++
        seekNext()
      }

      video.onerror = () => reject(new Error('Video error during frame extraction'))
      seekNext()
    })
  }

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('video/')) {
      setError('Please upload a video file (MP4, MOV, etc.)')
      return
    }
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
      setError(`Video must be under ${MAX_VIDEO_MB}MB`)
      return
    }

    setError(null)
    setAnalysis(null)
    const url = URL.createObjectURL(file)
    setVideoSrc(url)
    setAnalysing(true)

    try {
      // Wait for video metadata so we know the duration
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
      setAnalysis(data.analysis)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed')
      setVideoSrc(null)
    } finally {
      setAnalysing(false)
    }
  }, [platform, tone])

  function clear() {
    setVideoSrc(null)
    setAnalysis(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function copy(type: 'instagram' | 'tiktok') {
    const text = analysis?.captions[type]
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <Card className="border-pink-100 bg-gradient-to-br from-pink-50/50 to-violet-50/50">
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
            <div className="w-6 h-6 rounded-md bg-pink-500 flex items-center justify-center">
              <Video className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-semibold text-zinc-800">Video Caption Generator</span>
            <Badge variant="info" className="text-xs">Claude Vision</Badge>
            {analysis && <Badge variant="success" className="text-xs">Captions ready ✓</Badge>}
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
              className="overflow-hidden"
            >

              {/* Upload zone */}
              {!videoSrc && !analysing && (
                <>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault()
                      const file = e.dataTransfer.files[0]
                      if (file) handleFile(file)
                    }}
                    className="w-full border-2 border-dashed border-pink-200 rounded-xl p-8 flex flex-col items-center gap-2 hover:border-pink-400 hover:bg-pink-50 transition-colors"
                  >
                    <Video className="w-8 h-8 text-pink-400" />
                    <p className="text-sm text-zinc-600 font-medium">Drop your video or click to upload</p>
                    <p className="text-xs text-zinc-400">MP4, MOV, WEBM · up to {MAX_VIDEO_MB}MB</p>
                    <p className="text-xs text-violet-500 mt-1">
                      ✨ Claude extracts {MAX_FRAMES} frames and writes Instagram & TikTok captions
                    </p>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleFile(file)
                    }}
                  />
                </>
              )}

              {/* Analysing */}
              {analysing && (
                <div className="flex flex-col items-center justify-center gap-3 py-10">
                  <Loader2 className="w-6 h-6 text-pink-500 animate-spin" />
                  <p className="text-sm text-zinc-600 font-medium">Extracting frames from your video…</p>
                  <p className="text-xs text-zinc-400">Claude is watching {MAX_FRAMES} moments and writing your captions</p>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="rounded-lg bg-red-50 border border-red-100 p-3">
                  <p className="text-xs text-red-700">{error}</p>
                  <button onClick={clear} className="text-xs text-red-500 underline mt-1">Try again</button>
                </div>
              )}

              {/* Result */}
              {analysis && videoSrc && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  {/* Video preview + meta */}
                  <div className="flex gap-3">
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                    <video
                      src={videoSrc}
                      className="w-28 h-28 object-cover rounded-xl flex-shrink-0 border border-zinc-200 bg-zinc-900"
                      muted
                      loop
                      autoPlay
                      playsInline
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-zinc-800 mb-1">{analysis.product}</p>
                      <p className="text-xs text-zinc-500 leading-relaxed line-clamp-2">{analysis.description}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {analysis.colors.map((c) => (
                          <span key={c} className="text-xs bg-white border border-zinc-200 px-2 py-0.5 rounded-full text-zinc-600">
                            {c}
                          </span>
                        ))}
                        <span className="text-xs bg-white border border-zinc-200 px-2 py-0.5 rounded-full text-zinc-500 italic">
                          {analysis.setting}
                        </span>
                      </div>
                    </div>
                    <button onClick={clear} className="flex-shrink-0 text-zinc-400 hover:text-zinc-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Caption angle */}
                  <div className="bg-white rounded-lg p-3 border border-zinc-100">
                    <p className="text-xs font-medium text-zinc-400 mb-1 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-violet-400" /> Best caption angle
                    </p>
                    <p className="text-xs text-zinc-700">{analysis.captionAngle}</p>
                  </div>

                  {/* Caption tabs */}
                  <div>
                    <div className="flex rounded-lg border border-zinc-200 overflow-hidden mb-3">
                      {(['instagram', 'tiktok'] as const).map((p) => (
                        <button
                          key={p}
                          onClick={() => setActiveCaption(p)}
                          className={cn(
                            'flex-1 py-2 text-xs font-medium transition-colors flex items-center justify-center gap-1.5',
                            activeCaption === p
                              ? p === 'instagram'
                                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                                : 'bg-zinc-900 text-white'
                              : 'bg-white text-zinc-600 hover:bg-zinc-50'
                          )}
                        >
                          {p === 'instagram' ? '📸 Instagram' : '🎵 TikTok'}
                        </button>
                      ))}
                    </div>

                    <div className="relative">
                      <pre className="text-sm text-zinc-800 whitespace-pre-wrap font-sans leading-relaxed bg-white rounded-xl border border-zinc-100 p-4 pr-10">
                        {analysis.captions[activeCaption]}
                      </pre>
                      <button
                        onClick={() => copy(activeCaption)}
                        className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors"
                        title="Copy caption"
                      >
                        {copied === activeCaption
                          ? <Check className="w-4 h-4 text-emerald-500" />
                          : <Copy className="w-4 h-4" />}
                      </button>
                    </div>

                    <Button
                      onClick={() => copy(activeCaption)}
                      variant="secondary"
                      size="sm"
                      className="w-full mt-2"
                    >
                      {copied === activeCaption
                        ? <><Check className="w-3.5 h-3.5 text-emerald-500" /> Copied!</>
                        : <><Copy className="w-3.5 h-3.5" /> Copy {activeCaption === 'instagram' ? 'Instagram' : 'TikTok'} Caption</>}
                    </Button>
                  </div>

                  {/* Content ideas */}
                  {analysis.contentIdeas.length > 0 && (
                    <div className="bg-white rounded-lg p-3 border border-zinc-100">
                      <p className="text-xs font-medium text-zinc-400 mb-2">💡 More content ideas from this video</p>
                      <ul className="space-y-1">
                        {analysis.contentIdeas.map((idea, i) => (
                          <li key={i} className="text-xs text-zinc-700 flex items-start gap-1.5">
                            <span className="text-pink-400 font-bold">{i + 1}.</span> {idea}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Upload another */}
                  <button
                    onClick={clear}
                    className="text-xs text-zinc-400 hover:text-zinc-600 underline"
                  >
                    Upload a different video
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
