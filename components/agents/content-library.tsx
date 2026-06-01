'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatRelativeTime, truncate } from '@/lib/utils'
import type { ContentItem, ContentType } from '@/types'
import { Image, Video, Mail, Type, Layout, FileText, ExternalLink } from 'lucide-react'

const typeConfig: Record<ContentType, { label: string; icon: typeof Image; color: string }> = {
  caption:        { label: 'Caption',       icon: Type,    color: 'bg-violet-50 text-violet-600' },
  description:    { label: 'Description',   icon: FileText, color: 'bg-blue-50 text-blue-600' },
  email:          { label: 'Email',         icon: Mail,    color: 'bg-amber-50 text-amber-600' },
  image:          { label: 'Image',         icon: Image,   color: 'bg-emerald-50 text-emerald-600' },
  video:          { label: 'Video',         icon: Video,   color: 'bg-red-50 text-red-600' },
  canva_template: { label: 'Canva',         icon: Layout,  color: 'bg-pink-50 text-pink-600' },
  canva:          { label: 'Canva',         icon: Layout,  color: 'bg-pink-50 text-pink-600' },
}

interface ContentLibraryProps {
  items: ContentItem[]
}

export function ContentLibrary({ items }: ContentLibraryProps) {
  if (items.length === 0) {
    return (
      <div className="text-center py-16 text-zinc-400">
        <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">No content yet — generate something above.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      <AnimatePresence>
        {items.map((item, i) => {
          const cfg = typeConfig[item.type]
          const Icon = cfg.icon
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.25, delay: i * 0.04 }}
            >
              <Card className="h-full hover:shadow-md transition-shadow">
                {/* Image preview */}
                {item.image_url && (
                  <div className="relative w-full aspect-square overflow-hidden rounded-t-2xl bg-zinc-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.image_url} alt={item.title} className="object-cover w-full h-full" />
                  </div>
                )}

                {/* Video preview */}
                {item.video_url && (
                  <div className="w-full aspect-video overflow-hidden rounded-t-2xl bg-zinc-900">
                    <video src={item.video_url} controls className="w-full h-full object-cover" />
                  </div>
                )}

                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ${cfg.color}`}>
                      <Icon className="w-3 h-3" />
                      {cfg.label}
                    </div>
                    <span className="text-xs text-zinc-400">{formatRelativeTime(item.created_at)}</span>
                  </div>

                  <p className="text-sm font-medium text-zinc-800 mb-1">{item.title}</p>

                  {item.body && (
                    <p className="text-xs text-zinc-500 leading-relaxed">{truncate(item.body, 140)}</p>
                  )}

                  {item.canva_url && (
                    <a
                      href={item.canva_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline"
                    >
                      Open in Canva <ExternalLink className="w-3 h-3" />
                    </a>
                  )}

                  {item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {item.tags.map((tag) => (
                        <Badge key={tag} variant="default" className="text-xs">{tag}</Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
