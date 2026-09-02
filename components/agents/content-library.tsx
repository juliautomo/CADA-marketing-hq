'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatRelativeTime } from '@/lib/utils'
import type { ContentItem, ContentType } from '@/types'
import { Image, Video, Mail, Type, Layout, FileText, ExternalLink, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Copy, Check, BookImage, Download, RotateCcw, Upload, X } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'

const typeConfig: Record<ContentType, { label: string; icon: typeof Image; color: string }> = {
  caption:        { label: 'Caption',     icon: Type,     color: 'bg-violet-50 text-violet-600' },
  description:    { label: 'Description', icon: FileText, color: 'bg-blue-50 text-blue-600' },
  email:          { label: 'Email',       icon: Mail,     color: 'bg-amber-50 text-amber-600' },
  image:          { label: 'Image',       icon: Image,    color: 'bg-emerald-50 text-emerald-600' },
  video:          { label: 'Video',       icon: Video,    color: 'bg-red-50 text-red-600' },
  canva_template: { label: 'Canva',       icon: Layout,   color: 'bg-pink-50 text-pink-600' },
  canva:          { label: 'Canva',       icon: Layout,   color: 'bg-pink-50 text-pink-600' },
  story:          { label: 'Story',       icon: BookImage,color: 'bg-rose-50 text-rose-600' },
  tryon:          { label: 'Try-On',      icon: Image,    color: 'bg-teal-50 text-teal-600' },
}

const PAGE_SIZE = 10

interface ContentLibraryProps {
  items: ContentItem[]
}

export function ContentLibrary({ items }: ContentLibraryProps) {
  const router = useRouter()
  const [page, setPage]         = useState(1)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [copied, setCopied]     = useState<string | null>(null)
  const [retryOpen, setRetryOpen]     = useState<string | null>(null)
  const [retryText, setRetryText]     = useState<Record<string, string>>({})
  const [retryRefImg, setRetryRefImg] = useState<Record<string, string>>({})
  const [uploading, setUploading]     = useState<string | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  async function handleRefUpload(itemId: string, file: File) {
    setUploading(itemId)
    const ext = file.name.split('.').pop()
    const path = `retry-refs/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('product-images').upload(path, file, { upsert: true })
    if (!error) {
      const { data } = supabase.storage.from('product-images').getPublicUrl(path)
      setRetryRefImg(prev => ({ ...prev, [itemId]: data.publicUrl }))
    }
    setUploading(null)
  }

  function toggleExpand(id: string) { setExpanded(prev => prev === id ? null : id) }

  async function downloadMedia(url: string, filename: string) {
    if (url.startsWith('data:')) {
      const [header, b64] = url.split(',')
      const mime = header.match(/:(.*?);/)?.[1] ?? 'application/octet-stream'
      const bytes = atob(b64)
      const arr = new Uint8Array(bytes.length)
      for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
      const blob = new Blob([arr], { type: mime })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = filename
      a.click()
      URL.revokeObjectURL(a.href)
    } else {
      window.open(url, '_blank')
    }
  }

  async function copyText(id: string, text: string) {
    await navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-16 text-zinc-400">
        <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">No content yet — generate something above.</p>
      </div>
    )
  }

  const totalPages = Math.ceil(items.length / PAGE_SIZE)
  const paged = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="space-y-2">
      <AnimatePresence mode="wait">
        <motion.div key={page} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
          className="divide-y divide-zinc-100 border border-zinc-100 rounded-xl overflow-hidden">
          {paged.map((item) => {
            const cfg = typeConfig[item.type]
            const Icon = cfg.icon
            const isOpen = expanded === item.id
            return (
              <div key={item.id} className="bg-white">
                {/* Row — click to expand */}
                <div className="flex items-start gap-4 px-4 py-3 hover:bg-zinc-50 transition-colors cursor-pointer" onClick={() => toggleExpand(item.id)}>
                  <div className={`flex-shrink-0 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium mt-0.5 ${cfg.color}`}>
                    <Icon className="w-3 h-3" />{cfg.label}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-800 truncate">{item.title}</p>
                    {item.body && <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1">{item.body}</p>}
                    {item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {item.tags.map((tag) => <Badge key={tag} variant="default" className="text-xs">{tag}</Badge>)}
                      </div>
                    )}
                  </div>
                  {item.image_url && <img src={item.image_url} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />}
                  {item.video_url && <video src={item.video_url} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />}
                  <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                    <span className="text-xs text-zinc-400 whitespace-nowrap">{formatRelativeTime(item.created_at)}</span>
                    {isOpen ? <ChevronUp className="w-3.5 h-3.5 text-zinc-400" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />}
                  </div>
                </div>

                {/* Expanded content */}
                {isOpen && (
                  <div className="px-4 pb-4 bg-zinc-50 border-t border-zinc-100 space-y-3">
                    {item.image_url && (
                      <div className="mt-3 space-y-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.image_url} alt={item.title} className="w-full max-w-sm rounded-xl" />
                        <div className="flex items-center gap-3">
                          <button onClick={(e) => { e.stopPropagation(); downloadMedia(item.image_url!, `image-${new Date().toISOString().slice(0,10)}.png`) }}
                            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-800">
                            <Download className="w-3.5 h-3.5" /> Download
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); setRetryOpen(v => v === item.id ? null : item.id) }}
                            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-800">
                            <RotateCcw className="w-3.5 h-3.5" /> Try Again
                          </button>
                        </div>
                        {retryOpen === item.id && (
                          <div className="rounded-xl border border-zinc-200 bg-white p-3 space-y-2" onClick={e => e.stopPropagation()}>
                            <p className="text-xs font-medium text-zinc-500">What would you like to change?</p>
                            <textarea
                              value={retryText[item.id] ?? ''}
                              onChange={e => setRetryText(prev => ({ ...prev, [item.id]: e.target.value }))}
                              rows={2}
                              autoFocus
                              placeholder="e.g. brighter colors, remove the text, warmer lighting…"
                              className="w-full text-xs text-zinc-700 bg-zinc-50 border border-zinc-200 rounded-lg p-2 resize-none focus:outline-none focus:ring-1 focus:ring-zinc-400"
                            />
                            <div>
                              <p className="text-xs font-medium text-zinc-500 mb-1.5">Reference image <span className="text-zinc-400 font-normal">(optional)</span></p>
                              {retryRefImg[item.id] ? (
                                <div className="relative w-16 h-16">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={retryRefImg[item.id]} alt="ref" className="w-16 h-16 rounded-lg object-cover border border-zinc-200" />
                                  <button onClick={() => setRetryRefImg(prev => { const n = { ...prev }; delete n[item.id]; return n })}
                                    className="absolute -top-1 -right-1 bg-white rounded-full shadow p-0.5 border border-zinc-200">
                                    <X className="w-3 h-3 text-zinc-500" />
                                  </button>
                                </div>
                              ) : (
                                <label className="inline-flex items-center gap-2 cursor-pointer rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-xs text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 transition-colors">
                                  <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleRefUpload(item.id, f) }} />
                                  <Upload className="w-3.5 h-3.5" />
                                  {uploading === item.id ? 'Uploading…' : 'Upload reference'}
                                </label>
                              )}
                            </div>
                            <button
                              disabled={!(retryText[item.id] ?? '').trim()}
                              onClick={() => {
                                const feedback = (retryText[item.id] ?? '').trim()
                                if (!feedback || !item.image_url) return
                                const params = new URLSearchParams({ task: 'image', refImg: retryRefImg[item.id] ?? item.image_url, revision: '1', feedback })
                                router.push(`/agents/creator?${params.toString()}`)
                              }}
                              className="flex items-center justify-center gap-2 w-full rounded-xl bg-zinc-800 text-white text-xs font-medium py-2 hover:bg-zinc-700 disabled:opacity-40 transition-colors"
                            >
                              <RotateCcw className="w-3 h-3" /> Regenerate with changes
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                    {item.video_url && (
                      <div className="mt-3 space-y-2">
                        <video src={item.video_url} controls className="w-full max-w-sm rounded-xl bg-zinc-900" />
                        <button onClick={(e) => { e.stopPropagation(); downloadMedia(item.video_url!, 'cada-video.mp4') }}
                          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-800">
                          <Download className="w-3.5 h-3.5" /> Download
                        </button>
                      </div>
                    )}
                    {item.body && (
                      <div className="relative mt-3">
                        <pre className="text-sm text-zinc-700 whitespace-pre-wrap font-sans leading-relaxed bg-white rounded-lg border border-zinc-200 p-3 pr-10">{item.body}</pre>
                        <button onClick={(e) => { e.stopPropagation(); copyText(item.id, item.body!) }}
                          className="absolute top-2 right-2 p-1.5 rounded-md hover:bg-zinc-100 text-zinc-400">
                          {copied === item.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    )}
                    {item.canva_url && (
                      <a href={item.canva_url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline">
                        Open in Canva <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {item.drive_url && (
                      <a href={item.drive_url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-emerald-600 hover:underline">
                        Open in Google Drive <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </motion.div>
      </AnimatePresence>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-zinc-400">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, items.length)} of {items.length} items
          </p>
          <div className="flex items-center gap-1">
            <Button variant="secondary" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 1}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <Button key={p} variant={p === page ? 'primary' : 'secondary'} size="sm"
                onClick={() => setPage(p)} className="w-8">
                {p}
              </Button>
            ))}
            <Button variant="secondary" size="sm" onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
