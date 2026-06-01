'use client'

import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload, Link, X, Loader2, Sparkles, Image as ImageIcon,
  Wand2, Lightbulb, Palette, ChevronDown, ChevronUp, Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { ImageAnalysis } from '@/lib/anthropic'

interface ImageReferenceProps {
  onAnalysis: (analysis: ImageAnalysis, imagePreview: string) => void
  onClear: () => void
}

type InputMode = 'upload' | 'url'
type ActionResult = { imageUrl?: string; text?: string; prompt?: string }

export function ImageReference({ onAnalysis, onClear }: ImageReferenceProps) {
  const [mode, setMode] = useState<InputMode>('upload')
  const [driveUrl, setDriveUrl] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const [analysing, setAnalysing] = useState(false)
  const [analysis, setAnalysis] = useState<ImageAnalysis | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(true)

  // Action states
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionResult, setActionResult] = useState<ActionResult | null>(null)
  const [customInstructions, setCustomInstructions] = useState('')
  const [copied, setCopied] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<File | null>(null)

  // Compress image before sending to Claude Vision.
  // Claude's limit is 5MB base64 — base64 adds ~33% overhead,
  // so we target 3.5MB raw (= ~4.65MB base64, safely under limit).
  async function compressImage(file: File, maxSizeBytes = 3.5 * 1024 * 1024): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(url)
        const canvas = document.createElement('canvas')
        let { width, height } = img

        // Scale down if very large
        const maxDim = 1920
        if (width > maxDim || height > maxDim) {
          const scale = Math.min(maxDim / width, maxDim / height)
          width = Math.round(width * scale)
          height = Math.round(height * scale)
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, width, height)

        // Try progressively lower quality until under limit
        let quality = 0.85
        const tryCompress = () => {
          canvas.toBlob((blob) => {
            if (!blob) return reject(new Error('Compression failed'))
            if (blob.size <= maxSizeBytes || quality < 0.3) return resolve(blob)
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

  function friendlyError(raw: string): string {
    if (raw.includes('exceeds') && raw.includes('MB')) return 'Image is too large. Try a smaller photo (under 5MB).'
    if (raw.includes('image exceeds')) return 'Image is too large — compressing automatically, please try again.'
    if (raw.includes('Could not parse')) return 'Claude couldn\'t read this image. Try a different photo.'
    if (raw.includes('400')) return 'Image format not supported. Please use JPG, PNG, or WebP.'
    if (raw.includes('network') || raw.includes('fetch')) return 'Network error — check your connection and try again.'
    return raw
  }

  const analyseFile = useCallback(async (file: File) => {
    fileRef.current = file

    // Show preview immediately
    const reader = new FileReader()
    reader.onload = (e) => setPreview(e.target?.result as string)
    reader.readAsDataURL(file)

    setAnalysing(true)
    setError(null)
    setAnalysis(null)
    setActionResult(null)

    try {
      // Compress if over 4MB
      let uploadFile: File | Blob = file
      if (file.size > 4 * 1024 * 1024) {
        uploadFile = await compressImage(file)
      }

      const form = new FormData()
      form.append('image', uploadFile, file.name)
      const res = await fetch('/api/analyze-image', { method: 'POST', body: form })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setAnalysis(data.analysis)
      onAnalysis(data.analysis, URL.createObjectURL(file))
    } catch (e) {
      const raw = e instanceof Error ? e.message : 'Analysis failed'
      setError(friendlyError(raw))
    } finally {
      setAnalysing(false)
    }
  }, [onAnalysis])

  const analyseUrl = useCallback(async () => {
    if (!driveUrl.trim()) return
    setAnalysing(true)
    setError(null)
    setAnalysis(null)
    setActionResult(null)
    setPreview(null)

    try {
      const res = await fetch('/api/analyze-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: driveUrl }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setAnalysis(data.analysis)
      // For URL mode, try to show the image directly
      const directUrl = driveUrl.includes('drive.google.com')
        ? driveUrl.replace(/\/view.*/, '').replace('/file/d/', '/uc?export=view&id=').replace('drive.google.com/uc?export=view&id=', 'drive.google.com/uc?export=view&id=')
        : driveUrl
      setPreview(directUrl)
      onAnalysis(data.analysis, directUrl)
    } catch (e) {
      const raw = e instanceof Error ? e.message : 'Analysis failed'
      setError(friendlyError(raw))
    } finally {
      setAnalysing(false)
    }
  }, [driveUrl, onAnalysis])

  async function handleSimilarImage() {
    if (!analysis) return
    setActionLoading('similar')
    setActionResult(null)
    try {
      const res = await fetch('/api/agents/creator/similar-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysis, customInstructions }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setActionResult({ imageUrl: data.imageUrl, prompt: data.prompt })
    } catch (e) {
      const raw = e instanceof Error ? e.message : 'Generation failed'
      setError(friendlyError(raw))
    } finally {
      setActionLoading(null)
    }
  }

  function clear() {
    setPreview(null)
    setAnalysis(null)
    setError(null)
    setActionResult(null)
    setDriveUrl('')
    fileRef.current = null
    if (fileInputRef.current) fileInputRef.current.value = ''
    onClear()
  }

  function copyPrompt(text: string) {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card className="border-violet-100 bg-gradient-to-br from-violet-50/50 to-pink-50/50">
      <CardContent className="pt-4 pb-4">
        {/* Header */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-between mb-3"
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-violet-500 flex items-center justify-center">
              <ImageIcon className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-semibold text-zinc-800">Image Reference</span>
            <Badge variant="info" className="text-xs">Claude Vision</Badge>
            {analysis && <Badge variant="success" className="text-xs">Image analysed ✓</Badge>}
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
              className="overflow-hidden"
            >
              {/* Mode tabs */}
              {!analysis && (
                <div className="flex rounded-lg border border-zinc-200 overflow-hidden mb-3">
                  {(['upload', 'url'] as InputMode[]).map((m) => (
                    <button key={m} onClick={() => setMode(m)}
                      className={cn('flex-1 py-2 text-xs font-medium transition-colors flex items-center justify-center gap-1.5',
                        mode === m ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-600 hover:bg-zinc-50'
                      )}>
                      {m === 'upload' ? <><Upload className="w-3 h-3" /> Upload image</> : <><Link className="w-3 h-3" /> Google Drive link</>}
                    </button>
                  ))}
                </div>
              )}

              {/* Input area */}
              {!analysis && !analysing && (
                <>
                  {mode === 'upload' ? (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault()
                        const file = e.dataTransfer.files[0]
                        if (file && file.type.startsWith('image/')) analyseFile(file)
                      }}
                      className="w-full border-2 border-dashed border-violet-200 rounded-xl p-6 flex flex-col items-center gap-2 hover:border-violet-400 hover:bg-violet-50 transition-colors"
                    >
                      <Upload className="w-6 h-6 text-violet-400" />
                      <p className="text-sm text-zinc-600 font-medium">Drop image or click to upload</p>
                      <p className="text-xs text-zinc-400">JPG, PNG, WebP · from your computer or Google Drive download</p>
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        value={driveUrl}
                        onChange={(e) => setDriveUrl(e.target.value)}
                        placeholder="Paste Google Drive share link or image URL…"
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
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) analyseFile(file)
                    }}
                  />
                </>
              )}

              {/* Analysing spinner */}
              {analysing && (
                <div className="flex items-center justify-center gap-3 py-8">
                  <Loader2 className="w-5 h-5 text-violet-500 animate-spin" />
                  <p className="text-sm text-zinc-600">Claude is analysing your image…</p>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="rounded-lg bg-red-50 border border-red-100 p-3">
                  <p className="text-xs text-red-700">{error}</p>
                  <button onClick={clear} className="text-xs text-red-500 underline mt-1">Try again</button>
                </div>
              )}

              {/* Analysis result */}
              {analysis && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  {/* Image + summary */}
                  <div className="flex gap-3">
                    {preview && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={preview} alt="Reference" className="w-24 h-24 object-cover rounded-xl flex-shrink-0 border border-zinc-200" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-zinc-800 mb-1">{analysis.product}</p>
                      <p className="text-xs text-zinc-500 leading-relaxed line-clamp-3">{analysis.description}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {analysis.colors.map((c) => (
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

                  {/* What Claude found */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-white rounded-lg p-2.5 border border-zinc-100">
                      <p className="text-zinc-400 font-medium mb-0.5">Silhouette</p>
                      <p className="text-zinc-700">{analysis.silhouette}</p>
                    </div>
                    <div className="bg-white rounded-lg p-2.5 border border-zinc-100">
                      <p className="text-zinc-400 font-medium mb-0.5">Mood</p>
                      <p className="text-zinc-700">{analysis.mood}</p>
                    </div>
                  </div>

                  {/* Content ideas */}
                  {analysis.contentIdeas.length > 0 && (
                    <div className="bg-white rounded-lg p-3 border border-zinc-100">
                      <p className="text-xs font-medium text-zinc-500 mb-2 flex items-center gap-1">
                        <Lightbulb className="w-3 h-3" /> Content angles Claude spotted
                      </p>
                      <ul className="space-y-1">
                        {analysis.contentIdeas.map((idea, i) => (
                          <li key={i} className="text-xs text-zinc-700 flex items-start gap-1.5">
                            <span className="text-violet-400 font-bold">{i + 1}.</span> {idea}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-zinc-500">What do you want to do with this image?</p>
                    <p className="text-xs text-zinc-400 mb-1">
                      💡 To write a caption or email <strong>based on this image</strong>, select a content type above — the analysis is already applied.
                    </p>

                    {/* Custom instructions for similar image */}
                    <div>
                      <Input
                        value={customInstructions}
                        onChange={(e) => setCustomInstructions(e.target.value)}
                        placeholder="Custom instructions for similar image (optional)… e.g. 'use outdoor setting'"
                        className="text-xs mb-2"
                      />
                      <div className="grid grid-cols-1 gap-2">
                        <Button
                          onClick={handleSimilarImage}
                          loading={actionLoading === 'similar'}
                          variant="secondary"
                          size="sm"
                          className="w-full justify-start gap-2"
                        >
                          <Wand2 className="w-3.5 h-3.5 text-violet-500" />
                          Generate similar image with DALL-E 3
                        </Button>
                        <Button
                          onClick={() => {
                            // Signal parent to use this analysis as inspiration context
                            onAnalysis(analysis, preview ?? '')
                          }}
                          variant="secondary"
                          size="sm"
                          className="w-full justify-start gap-2"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                          Use as style inspiration for all content
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Similar image result */}
                  {actionLoading === 'similar' && (
                    <div className="flex items-center gap-2 py-4 justify-center">
                      <Loader2 className="w-4 h-4 text-violet-500 animate-spin" />
                      <p className="text-xs text-zinc-500">Generating similar image with DALL-E 3…</p>
                    </div>
                  )}

                  {actionResult?.imageUrl && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={actionResult.imageUrl} alt="Generated" className="w-full rounded-xl border border-zinc-200" />
                      {actionResult.prompt && (
                        <button
                          onClick={() => copyPrompt(actionResult.prompt!)}
                          className="text-xs text-zinc-400 hover:text-zinc-600 flex items-center gap-1"
                        >
                          {copied ? <Check className="w-3 h-3 text-emerald-500" /> : null}
                          {copied ? 'Prompt copied!' : 'Copy DALL-E prompt'}
                        </button>
                      )}
                      <p className="text-xs text-emerald-600">✓ Saved to Content Library</p>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  )
}
