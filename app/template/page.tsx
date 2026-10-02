'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { toPng } from 'html-to-image'
import { Download, Loader2, Plus, Trash2, Sparkles, ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type VisualType = 'timeline' | 'comparison' | 'checklist' | 'steps' | 'none'
type IllustrationPosition = 'center' | 'right-float' | 'background'
type CanvasSize = '4:5' | '1:1' | '9:16'

const CANVAS_DIMS: Record<CanvasSize, { w: number; h: number }> = {
  '4:5':  { w: 1080, h: 1350 },
  '1:1':  { w: 1080, h: 1080 },
  '9:16': { w: 1080, h: 1920 },
}

interface TimelineItem { time: string; text: string }
interface ComparisonItem { left: string; right: string }
interface ChecklistItem { text: string; checked: boolean }
interface StepItem { number: string; text: string }

interface ElLayout { x: number; y: number; w: number }
interface VisualLayout extends ElLayout { h: number }
interface TemplateLayout {
  logo: ElLayout
  pill: ElLayout
  headline: ElLayout
  subheadline: ElLayout
  body: ElLayout
  visual: VisualLayout
  illustration: VisualLayout
  tips: ElLayout
  footer: ElLayout
}

interface TemplateFields {
  category: string
  headline: string
  subheadline: string
  body: string
  visualType: VisualType
  timeline: TimelineItem[]
  comparison: { leftLabel: string; rightLabel: string; items: ComparisonItem[] }
  checklist: ChecklistItem[]
  steps: StepItem[]
  tipsText: string
  illustrationUrl: string
  illustrationPosition: IllustrationPosition
  layout: TemplateLayout
}

const DEFAULT_LAYOUT: TemplateLayout = {
  logo:         { x: 6.7, y: 4.4,  w: 35   },
  pill:         { x: 6.7, y: 12.5, w: 55   },
  headline:     { x: 6.7, y: 16.5, w: 86.6 },
  subheadline:  { x: 6.7, y: 22.7, w: 86.6 },
  body:         { x: 6.7, y: 26.5, w: 86.6 },
  visual:       { x: 6.7, y: 33.0, w: 86.6, h: 36.5 },
  illustration: { x: 55,  y: 31.0, w: 38,   h: 40.0 },
  tips:         { x: 6.7, y: 71.0, w: 86.6 },
  footer:       { x: 6.7, y: 78.0, w: 86.6 },
}

// Layouts tuned for each canvas ratio — elements redistributed to fill the space
const DEFAULT_LAYOUT_1x1: TemplateLayout = {
  logo:         { x: 6.7, y: 5.5,  w: 35   },
  pill:         { x: 6.7, y: 15.0, w: 55   },
  headline:     { x: 6.7, y: 20.5, w: 86.6 },
  subheadline:  { x: 6.7, y: 31.0, w: 86.6 },
  body:         { x: 6.7, y: 39.0, w: 86.6 },
  visual:       { x: 6.7, y: 47.0, w: 86.6, h: 26.0 },
  illustration: { x: 55,  y: 45.0, w: 38,   h: 32.0 },
  tips:         { x: 6.7, y: 75.5, w: 86.6 },
  footer:       { x: 6.7, y: 85.0, w: 86.6 },
}

const DEFAULT_LAYOUT_9x16: TemplateLayout = {
  logo:         { x: 6.7, y: 3.5,  w: 35   },
  pill:         { x: 6.7, y: 9.5,  w: 55   },
  headline:     { x: 6.7, y: 12.5, w: 86.6 },
  subheadline:  { x: 6.7, y: 18.0, w: 86.6 },
  body:         { x: 6.7, y: 21.5, w: 86.6 },
  visual:       { x: 6.7, y: 26.0, w: 86.6, h: 40.0 },
  illustration: { x: 55,  y: 24.5, w: 38,   h: 44.0 },
  tips:         { x: 6.7, y: 68.0, w: 86.6 },
  footer:       { x: 6.7, y: 73.5, w: 86.6 },
}

const SIZE_LAYOUTS: Record<CanvasSize, TemplateLayout> = {
  '4:5':  DEFAULT_LAYOUT,
  '1:1':  DEFAULT_LAYOUT_1x1,
  '9:16': DEFAULT_LAYOUT_9x16,
}

const DEFAULT: TemplateFields = {
  category: 'AKTIVITAS HARIAN',
  headline: 'Judul Post Kamu',
  subheadline: 'Subheadline menarik di sini',
  body: 'Deskripsi singkat yang menjelaskan isi post ini kepada pembaca.',
  visualType: 'timeline',
  timeline: [
    { time: '07:00', text: 'Buka email dengan Claude' },
    { time: '09:30', text: 'Buat outline meeting 3 menit' },
    { time: '12:00', text: 'Tulis caption Instagram saat makan siang' },
    { time: '15:00', text: 'Selesaikan laporan mingguan dalam 20 menit' },
    { time: '17:30', text: 'Matikan laptop — hari usai' },
  ],
  comparison: {
    leftLabel: 'Tanpa Claude',
    rightLabel: 'Dengan Claude',
    items: [
      { left: '2 jam balas email', right: '15 menit balas email' },
      { left: 'Lembur setiap hari', right: 'Pulang tepat waktu' },
    ],
  },
  checklist: [
    { text: 'Tulis prompt yang jelas dan spesifik', checked: true },
    { text: 'Berikan konteks yang cukup', checked: true },
    { text: 'Review dan edit hasilnya', checked: false },
    { text: 'Simpan prompt yang berhasil', checked: false },
  ],
  steps: [
    { number: '01', text: 'Buka Claude dan mulai percakapan baru' },
    { number: '02', text: 'Jelaskan tugas dengan detail dan konteks' },
    { number: '03', text: 'Review hasil dan minta penyesuaian' },
    { number: '04', text: 'Simpan hasilnya dan lanjut ke tugas berikutnya' },
  ],
  tipsText: 'Simpan template Claude favoritmu untuk tugas harian yang sering diulang.',
  illustrationUrl: '',
  illustrationPosition: 'center',
  layout: DEFAULT_LAYOUT,
}

const ELEMENT_KEYS = Object.keys(DEFAULT_LAYOUT) as (keyof TemplateLayout)[]

const ELEMENT_LABELS: Record<keyof TemplateLayout, string> = {
  logo: 'Logo', pill: 'Category pill', headline: 'Headline',
  subheadline: 'Subheadline', body: 'Body text', visual: 'Visual area',
  illustration: 'Illustration', tips: 'Tips bar', footer: 'Footer',
}

// ─── Poster Template (free-form canvas) ──────────────────────────────────────

function PosterTemplate({
  fields, logoUrl, brandName, primaryColor, lightColor, posterRef: posterRefProp, setElementRef, canvasW = 1080, canvasH = 1350,
}: {
  fields: TemplateFields
  logoUrl: string
  brandName: string
  primaryColor: string
  lightColor: string
  posterRef?: React.RefObject<HTMLDivElement | null>
  setElementRef?: (key: string) => (el: HTMLDivElement | null) => void
  canvasW?: number
  canvasH?: number
}) {
  const L = fields.layout

  const abs = (key: keyof TemplateLayout): React.CSSProperties => ({
    position: 'absolute',
    left:  `${L[key].x}%`,
    top:   `${L[key].y}%`,
    width: `${L[key].w}%`,
    ...('h' in L[key] ? { height: `${(L[key] as VisualLayout).h}%` } : {}),
  })

  return (
    <div ref={posterRefProp} style={{
      width: canvasW, height: canvasH, background: '#FFFFFF', position: 'relative',
      overflow: 'hidden', fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif",
    }}>
      {/* Logo */}
      <div ref={setElementRef?.('logo')} style={abs('logo')}>
        {logoUrl
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={logoUrl} alt="Logo" style={{ height: 28, objectFit: 'contain' }} />
          : <span style={{ fontSize: 20, fontWeight: 800, color: primaryColor, letterSpacing: '-0.5px' }}>{brandName}</span>
        }
      </div>

      {/* Category pill */}
      <div ref={setElementRef?.('pill')} style={abs('pill')}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: lightColor, color: primaryColor,
          fontSize: 13, fontWeight: 700, letterSpacing: '0.06em',
          borderRadius: 999, padding: '7px 16px',
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: primaryColor, display: 'inline-block', flexShrink: 0 }} />
          {fields.category}
        </span>
      </div>

      {/* Headline */}
      <div ref={setElementRef?.('headline')} style={abs('headline')}>
        <h1 style={{ fontSize: 62, fontWeight: 800, lineHeight: 1.1, color: '#1A1523', margin: 0, letterSpacing: '-1.5px' }}>
          {fields.headline}
        </h1>
      </div>

      {/* Subheadline */}
      <div ref={setElementRef?.('subheadline')} style={abs('subheadline')}>
        <p style={{ fontSize: 26, fontStyle: 'italic', fontWeight: 500, color: primaryColor, margin: 0, lineHeight: 1.3 }}>
          {fields.subheadline}
        </p>
      </div>

      {/* Body */}
      <div ref={setElementRef?.('body')} style={abs('body')}>
        <p style={{ fontSize: 18, color: '#4A4458', lineHeight: 1.6, margin: 0, fontWeight: 400 }}>
          {fields.body}
        </p>
      </div>

      {/* Visual */}
      <div ref={setElementRef?.('visual')} style={abs('visual')}>
        {fields.visualType === 'timeline'   && <TimelineVisual items={fields.timeline} primaryColor={primaryColor} lightColor={lightColor} />}
        {fields.visualType === 'comparison' && <ComparisonVisual data={fields.comparison} />}
        {fields.visualType === 'checklist'  && <ChecklistVisual items={fields.checklist} primaryColor={primaryColor} lightColor={lightColor} />}
        {fields.visualType === 'steps'      && <StepsVisual items={fields.steps} lightColor={lightColor} />}
      </div>

      {/* Illustration overlay — shown whenever a URL is set, any visual type */}
      {fields.illustrationUrl && (
        <div ref={setElementRef?.('illustration')} style={abs('illustration')}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={fields.illustrationUrl} alt="" draggable={false}
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block',
              opacity: fields.illustrationPosition === 'background' ? 0.15 : 1 }} />
        </div>
      )}

      {/* Tips bar */}
      {fields.tipsText && (
        <div ref={setElementRef?.('tips')} style={abs('tips')}>
          <div style={{ background: lightColor, borderRadius: 20, padding: '18px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 26, flexShrink: 0 }}>💡</span>
            <p style={{ fontSize: 16, color: '#27232D', margin: 0, lineHeight: 1.5 }}>
              <strong>Tips: </strong>{fields.tipsText}
            </p>
          </div>
        </div>
      )}

      {/* Footer */}
      <div ref={setElementRef?.('footer')} style={abs('footer')}>
        <div style={{
          background: '#FFFFFF', borderRadius: 20, border: '1.5px solid #ECE8F8',
          padding: '16px 24px', display: 'flex', alignItems: 'center',
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 22, color: primaryColor, fontWeight: 700, flexShrink: 0 }}>↗</span>
            <span style={{ fontSize: 13, color: '#4A4458', lineHeight: 1.4 }}>
              {brandName}
            </span>
          </div>
          <div style={{ width: 1.5, background: '#ECE8F8', alignSelf: 'stretch', margin: '0 20px', flexShrink: 0 }} />
          <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
            {logoUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={logoUrl} alt={brandName} style={{ height: 32, objectFit: 'contain' }} />
              : <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: lightColor, borderRadius: 10, padding: '6px 12px', fontSize: 12, color: primaryColor, fontWeight: 600 }}>
                  {brandName}
                </div>
            }
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Visual sub-components ────────────────────────────────────────────────────

function TimelineVisual({ items, primaryColor, lightColor }: { items: TimelineItem[]; primaryColor: string; lightColor: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, height: '100%', alignContent: 'start' }}>
      {items.map((item, i) => (
        <div key={i} style={{
          background: '#FFFFFF', border: `1.5px solid ${lightColor}`, borderRadius: 20, padding: '20px 24px',
          display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 26, fontWeight: 800, color: primaryColor, margin: 0, letterSpacing: '-0.5px' }}>{item.time}</p>
            <p style={{ fontSize: 15, color: '#4A4458', margin: 0, lineHeight: 1.4, marginTop: 4 }}>{item.text}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function ComparisonVisual({ data }: { data: TemplateFields['comparison'] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, height: '100%', alignContent: 'start' }}>
      {[
        { label: data.leftLabel,  items: data.items.map(i => i.left),  accent: '#E5484D', bg: '#FFF5F5' },
        { label: data.rightLabel, items: data.items.map(i => i.right), accent: '#22A06B', bg: '#F0FFF8' },
      ].map(col => (
        <div key={col.label} style={{ background: col.bg, borderRadius: 20, padding: 24 }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: col.accent, marginBottom: 16, letterSpacing: '0.04em', textTransform: 'uppercase' as const }}>{col.label}</p>
          {col.items.map((item, i) => (
            <div key={i} style={{ background: '#FFFFFF', borderRadius: 12, padding: '12px 16px', marginBottom: 10, fontSize: 15, color: '#27232D', lineHeight: 1.4 }}>{item}</div>
          ))}
        </div>
      ))}
    </div>
  )
}

function ChecklistVisual({ items, primaryColor, lightColor }: { items: ChecklistItem[]; primaryColor: string; lightColor: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%', justifyContent: 'flex-start' }}>
      {items.map((item, i) => (
        <div key={i} style={{
          background: '#FFFFFF', border: `1.5px solid ${lightColor}`, borderRadius: 16, padding: '16px 20px',
          display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 1px 8px rgba(0,0,0,0.05)',
        }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: item.checked ? primaryColor : lightColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {item.checked && <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>✓</span>}
          </div>
          <span style={{ fontSize: 17, color: item.checked ? '#27232D' : '#8B80A0', fontWeight: item.checked ? 500 : 400 }}>{item.text}</span>
        </div>
      ))}
    </div>
  )
}

function StepsVisual({ items, lightColor }: { items: StepItem[]; lightColor: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 20, background: '#FAFAFA', borderRadius: 16, padding: '18px 22px', border: `1.5px solid ${lightColor}` }}>
          <span style={{ fontSize: 28, fontWeight: 900, color: lightColor, letterSpacing: '-1px', flexShrink: 0, lineHeight: 1, fontVariantNumeric: 'tabular-nums' as const }}>{item.number}</span>
          <p style={{ fontSize: 17, color: '#27232D', margin: 0, lineHeight: 1.5, fontWeight: 500 }}>{item.text}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface Draft { name: string; savedAt: string; fields: TemplateFields }
interface QueuePost { id: string; title: string | null; caption: string; image_concept: string | null; status: string; cada_campaigns?: { name: string } | null }

interface BrandSettings {
  brand_name?: string
  brand_logo_url?: string
  brand_colors?: string
  template_layout?: string
}

function parsePrimaryColor(brandColors: string | undefined): string {
  if (!brandColors) return '#5B3FC4'
  // brand_colors may be a hex like "#5B3FC4" or a JSON string or comma-separated list
  const trimmed = brandColors.replace(/^"|"$/g, '').trim()
  // Try JSON array first
  try {
    const parsed = JSON.parse(trimmed)
    if (Array.isArray(parsed) && parsed.length > 0) return parsed[0]
    if (typeof parsed === 'string') return parsed
  } catch {}
  // Try comma-separated
  const first = trimmed.split(',')[0].trim()
  if (/^#[0-9a-fA-F]{3,8}$/.test(first)) return first
  return '#5B3FC4'
}

function lighten(hex: string): string {
  // Return a very light tint (~10% opacity) of the brand color
  try {
    const h = hex.replace('#', '')
    const r = parseInt(h.slice(0, 2), 16)
    const g = parseInt(h.slice(2, 4), 16)
    const b = parseInt(h.slice(4, 6), 16)
    return `rgb(${Math.round(r + (255 - r) * 0.88)}, ${Math.round(g + (255 - g) * 0.88)}, ${Math.round(b + (255 - b) * 0.88)})`
  } catch { return '#E9E3FA' }
}

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) as T : fallback } catch { return fallback }
}

export default function TemplatePage() {
  const [brand, setBrand] = useState<BrandSettings>({})
  const primaryColor = parsePrimaryColor(brand.brand_colors)
  const lightColor = lighten(primaryColor)
  const brandName = brand.brand_name?.replace(/^"|"$/g, '').trim() || 'Your Brand'

  // namespace localStorage per brand so each client's drafts are isolated
  const storagePrefix = `template-${brandName.toLowerCase().replace(/\s+/g, '-')}`

  const [fields, setFields] = useState<TemplateFields>(DEFAULT)
  const [canvasSize, setCanvasSize] = useState<CanvasSize>('4:5')
  const [logoUrl, setLogoUrl] = useState('')
  const [exporting, setExporting] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)

  function switchCanvasSize(size: CanvasSize) {
    setCanvasSize(size)
    setFields(prev => ({ ...prev, layout: savedLayouts[size] ?? SIZE_LAYOUTS[size] }))
  }

  const [posts, setPosts] = useState<QueuePost[]>([])
  const [loadingPost, setLoadingPost] = useState(false)
  const [selectedPostId, setSelectedPostId] = useState('')

  const [illustrationPrompt, setIllustrationPrompt] = useState('')
  const [illustrationModel, setIllustrationModel] = useState('gpt-image-1')
  const [generatingIllustration, setGeneratingIllustration] = useState(false)
  const [illustrationTransparent, setIllustrationTransparent] = useState(false)
  const [illustrationError, setIllustrationError] = useState('')
  const [loadPostError, setLoadPostError] = useState('')
  const [exportError, setExportError] = useState('')
  const [saveLayoutStatus, setSaveLayoutStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  // Per-client saved layouts from DB (keyed by canvas size)
  const [savedLayouts, setSavedLayouts] = useState<Partial<Record<CanvasSize, TemplateLayout>>>({})

  // Canvas interaction
  const posterPreviewRef = useRef<HTMLDivElement | null>(null)
  const elementRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const hoveredKeyRef = useRef<string | null>(null)
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [cursorStyle, setCursorStyle] = useState<'default' | 'grab' | 'grabbing'>('default')
  const fieldsRef = useRef(fields)
  fieldsRef.current = fields

  const setElementRef = useCallback((key: string) => (el: HTMLDivElement | null) => {
    elementRefs.current[key] = el
  }, [])

  const set = useCallback(<K extends keyof TemplateFields>(key: K, value: TemplateFields[K]) => {
    setFields(prev => ({ ...prev, [key]: value }))
  }, [])

  const setLayout = useCallback((key: keyof TemplateLayout, patch: Partial<ElLayout & { h: number }>) => {
    setFields(prev => ({ ...prev, layout: { ...prev.layout, [key]: { ...prev.layout[key], ...patch } } }))
  }, [])

  useEffect(() => {
    fetch('/api/settings/brand').then(r => r.json()).then((d: BrandSettings) => {
      setBrand(d)
      setLogoUrl((d.brand_logo_url ?? '').replace(/^"|"$/g, ''))
      // Parse saved layouts from DB and apply to starting canvas size (4:5)
      if (d.template_layout) {
        try {
          const parsed = JSON.parse(d.template_layout) as Partial<Record<CanvasSize, TemplateLayout>>
          setSavedLayouts(parsed)
          if (parsed['4:5']) setFields(prev => ({ ...prev, layout: parsed['4:5']! }))
        } catch {}
      }
    }).catch(() => {})
    fetch('/api/agents/post-queue').then(r => r.json()).then(d => setPosts((d.posts ?? []).filter((p: QueuePost) => p.image_concept || p.caption))).catch(() => {})
  }, [])

  // Load saved draft once brand is known (storagePrefix depends on brandName)
  const brandLoaded = !!brand.brand_name
  useEffect(() => {
    if (!brandLoaded) return
    const saved = loadFromStorage<Partial<TemplateFields> | null>(`${storagePrefix}-autosave`, null)
    if (saved?.headline && saved.headline !== DEFAULT.headline) {
      // Restore text content only — layout always uses DB-saved or hardcoded defaults
      const { layout: _layout, ...content } = saved as TemplateFields
      void _layout
      setFields({ ...DEFAULT, ...content, layout: savedLayouts[canvasSize] ?? SIZE_LAYOUTS[canvasSize] })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandLoaded])

  async function loadFromPost(postId: string) {
    const post = posts.find(p => p.id === postId)
    if (!post) return
    setLoadingPost(true)
    setLoadPostError('')
    try {
      const res = await fetch('/api/template/parse-post', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image_concept: post.image_concept, caption: post.caption }) })
      const data = await res.json()
      if (!res.ok || !data.fields) {
        setLoadPostError(data.error ?? 'Failed to parse post — try again.')
        return
      }
      const incoming = { ...data.fields }
      if (incoming.visualType === 'illustration-only') incoming.visualType = 'none'
      setFields(prev => ({ ...DEFAULT, ...incoming, illustrationUrl: prev.illustrationUrl, layout: DEFAULT_LAYOUT }))
    } catch {
      setLoadPostError('Network error — check your connection and try again.')
    } finally { setLoadingPost(false) }
  }

  async function generateIllustration() {
    if (!illustrationPrompt.trim()) return
    setGeneratingIllustration(true)
    setIllustrationError('')
    try {
      const res = await fetch('/api/template/generate-illustration', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: illustrationPrompt, model: illustrationModel, transparent: illustrationTransparent }) })
      const data = await res.json()
      if (!res.ok || !data.url) {
        setIllustrationError(data.error ?? 'Generation failed — try again.')
        return
      }
      set('illustrationUrl', data.url)
    } catch {
      setIllustrationError('Network error — check your connection and try again.')
    } finally { setGeneratingIllustration(false) }
  }

  async function saveLayoutAsDefault() {
    setSaveLayoutStatus('saving')
    try {
      const updated = { ...savedLayouts, [canvasSize]: fields.layout }
      await fetch('/api/settings/brand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_layout: JSON.stringify(updated) }),
      })
      setSavedLayouts(updated)
      setSaveLayoutStatus('saved')
      setTimeout(() => setSaveLayoutStatus('idle'), 2500)
    } catch {
      setSaveLayoutStatus('idle')
    }
  }

  async function downloadIllustration() {
    if (!fields.illustrationUrl) return
    try {
      const res = await fetch(fields.illustrationUrl)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'illustration.png'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      window.open(fields.illustrationUrl, '_blank')
    }
  }

  async function handleExport() {
    if (!exportRef.current) return
    setExporting(true)
    setExportError('')
    try {
      const dataUrl = await toPng(exportRef.current, { pixelRatio: 1 })
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `${brandName.toLowerCase().replace(/\s+/g, '-')}-${fields.category.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.png`
      a.click()
    } catch (err) {
      setExportError('Export failed — try removing the illustration and exporting again.')
      console.error('Export error:', err)
    } finally { setExporting(false) }
  }

  // ── Canvas drag interaction ──────────────────────────────────────────────

  const findElementAtPoint = useCallback((clientX: number, clientY: number): string | null => {
    // Check in reverse order so topmost (last in DOM) wins
    for (let i = ELEMENT_KEYS.length - 1; i >= 0; i--) {
      const key = ELEMENT_KEYS[i]
      const el = elementRefs.current[key]
      if (!el) continue
      const rect = el.getBoundingClientRect()
      if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) return key
    }
    return null
  }, [])

  const handleOverlayMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) return
    const found = findElementAtPoint(e.clientX, e.clientY)
    if (found !== hoveredKeyRef.current) {
      // Clear old hover outline
      if (hoveredKeyRef.current) {
        const old = elementRefs.current[hoveredKeyRef.current]
        if (old) { old.style.outline = ''; old.style.outlineOffset = '' }
      }
      // Set new hover outline
      if (found) {
        const el = elementRefs.current[found]
        if (el) { el.style.outline = '2px dashed rgba(91,63,196,0.5)'; el.style.outlineOffset = '3px' }
      }
      hoveredKeyRef.current = found
      setCursorStyle(found ? 'grab' : 'default')
    }
  }, [isDragging, findElementAtPoint])

  const handleOverlayMouseDown = useCallback((e: React.MouseEvent) => {
    const poster = posterPreviewRef.current
    if (!poster) return
    const found = findElementAtPoint(e.clientX, e.clientY)
    if (!found) return
    e.preventDefault()
    setActiveKey(found)
    setIsDragging(true)
    setCursorStyle('grabbing')

    const posterRect = poster.getBoundingClientRect()
    const startLayout = { ...fieldsRef.current.layout[found as keyof TemplateLayout] }
    const smx = e.clientX, smy = e.clientY

    const onMv = (ev: MouseEvent) => {
      const dxPct = (ev.clientX - smx) / posterRect.width * 100
      const dyPct = (ev.clientY - smy) / posterRect.height * 100
      setFields(prev => ({
        ...prev,
        layout: {
          ...prev.layout,
          [found]: {
            ...prev.layout[found as keyof TemplateLayout],
            x: Math.max(0, Math.min(95, startLayout.x + dxPct)),
            y: Math.max(0, Math.min(95, startLayout.y + dyPct)),
          },
        },
      }))
    }
    const onUp = () => {
      setIsDragging(false)
      setCursorStyle(hoveredKeyRef.current ? 'grab' : 'default')
      document.removeEventListener('mousemove', onMv)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMv)
    document.addEventListener('mouseup', onUp)
  }, [findElementAtPoint])

  const handleOverlayMouseLeave = useCallback(() => {
    if (hoveredKeyRef.current) {
      const old = elementRefs.current[hoveredKeyRef.current]
      if (old) { old.style.outline = ''; old.style.outlineOffset = '' }
      hoveredKeyRef.current = null
    }
    if (!isDragging) setCursorStyle('default')
  }, [isDragging])

  const { w: canvasW, h: canvasH } = CANVAS_DIMS[canvasSize]
  // Keep the preview at a fixed display width (~454px) regardless of canvas ratio
  const SCALE = 454 / canvasW

  // ── Drafts (localStorage) ────────────────────────────────────────────────

  const [drafts, setDrafts] = useState<Draft[]>([])
  const [draftName, setDraftName] = useState('')
  const [showDraftInput, setShowDraftInput] = useState(false)

  // Load drafts once brand is known
  useEffect(() => {
    if (!brandLoaded) return
    setDrafts(loadFromStorage<Draft[]>(`${storagePrefix}-drafts`, []))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandLoaded])

  // Auto-save on every fields change (only after brand is known)
  useEffect(() => {
    if (!brandLoaded) return
    try {
      // Only save text content — layout is excluded so stale positions don't override updated defaults
      const { layout: _layout, ...content } = fields
      void _layout
      localStorage.setItem(`${storagePrefix}-autosave`, JSON.stringify(content))
    } catch {}
  }, [fields, brandLoaded, storagePrefix])

  function saveDraft() {
    const name = draftName.trim() || `Draft ${new Date().toLocaleString('id-ID', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
    const draft: Draft = { name, savedAt: new Date().toISOString(), fields }
    const updated = [draft, ...drafts.filter(d => d.name !== name)].slice(0, 20)
    setDrafts(updated)
    try { localStorage.setItem(`${storagePrefix}-drafts`, JSON.stringify(updated)) } catch {}
    setDraftName('')
    setShowDraftInput(false)
  }

  function loadDraft(draft: Draft) {
    setFields({ ...draft.fields, layout: { ...DEFAULT_LAYOUT, ...draft.fields.layout } })
  }

  function deleteDraft(name: string) {
    const updated = drafts.filter(d => d.name !== name)
    setDrafts(updated)
    try { localStorage.setItem(`${storagePrefix}-drafts`, JSON.stringify(updated)) } catch {}
  }

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Image Template</h1>
          <p className="text-sm text-zinc-500 mt-1">Design a post template, then export as PNG. Drag any element to reposition it.</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button onClick={handleExport} disabled={exporting} className="gap-2">
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {exporting ? 'Exporting…' : 'Download PNG'}
          </Button>
          {exportError && <p className="text-xs text-red-500">{exportError}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-6 items-start">

        {/* ── Left: form ── */}
        <div className="space-y-4 bg-white rounded-2xl border border-zinc-200 p-5">

          <Section title="Drafts">
            <p className="text-[10px] text-zinc-400 -mt-1">Auto-saved to your browser. Save named drafts to switch between designs.</p>
            <div className="flex gap-2">
              {showDraftInput ? (
                <>
                  <input value={draftName} onChange={e => setDraftName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveDraft(); if (e.key === 'Escape') setShowDraftInput(false) }}
                    placeholder="Draft name…" autoFocus className={cn(inputCls, 'flex-1')} />
                  <button onClick={saveDraft}
                    className="text-xs font-medium bg-violet-600 text-white rounded-xl px-3 py-2 hover:bg-violet-500 transition-colors whitespace-nowrap flex-shrink-0">
                    Save
                  </button>
                  <button onClick={() => setShowDraftInput(false)}
                    className="text-xs text-zinc-400 hover:text-zinc-600 rounded-xl px-2 py-2 transition-colors flex-shrink-0">
                    ✕
                  </button>
                </>
              ) : (
                <button onClick={() => setShowDraftInput(true)}
                  className="text-xs font-medium border border-zinc-200 text-zinc-600 hover:bg-zinc-50 rounded-xl px-3 py-2 transition-colors">
                  + Save draft
                </button>
              )}
            </div>
            {drafts.length > 0 && (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {drafts.map(d => (
                  <div key={d.name} className="flex items-center gap-2 group">
                    <button onClick={() => loadDraft(d)}
                      className="flex-1 text-left text-xs px-3 py-2 rounded-lg border border-transparent hover:bg-violet-50 hover:border-violet-200 transition-colors text-zinc-600 hover:text-violet-700 truncate">
                      <span className="font-medium">{d.name}</span>
                      <span className="text-zinc-400 ml-2">{new Date(d.savedAt).toLocaleString('id-ID', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </button>
                    <button onClick={() => deleteDraft(d.name)}
                      className="opacity-0 group-hover:opacity-100 text-zinc-300 hover:text-red-400 transition-all flex-shrink-0 p-1">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <div className="h-px bg-zinc-100" />

          <Section title="Load from post queue">
            <p className="text-[10px] text-zinc-400 -mt-1">Pick a post and AI fills all the fields for you.</p>
            <div className="flex gap-2">
              <select value={selectedPostId} onChange={e => setSelectedPostId(e.target.value)} className={cn(inputCls, 'flex-1')}>
                <option value="">— Choose a post —</option>
                {posts.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.cada_campaigns?.name ? `${p.cada_campaigns.name} · ` : ''}{p.title ?? p.caption.slice(0, 40)} ({p.status})
                  </option>
                ))}
              </select>
              <button onClick={() => loadFromPost(selectedPostId)} disabled={!selectedPostId || loadingPost}
                className="flex items-center gap-1.5 text-xs font-medium bg-violet-600 text-white rounded-xl px-3 py-2 hover:bg-violet-500 disabled:opacity-40 transition-colors whitespace-nowrap flex-shrink-0">
                {loadingPost ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {loadingPost ? 'Loading…' : 'Auto-fill'}
              </button>
            </div>
            {loadPostError && <p className="text-xs text-red-500">{loadPostError}</p>}
          </Section>

          <div className="h-px bg-zinc-100" />

          <Section title="Text Content">
            <Field label="Category pill">
              <input value={fields.category} onChange={e => set('category', e.target.value)} className={inputCls} placeholder="AKTIVITAS HARIAN" />
            </Field>
            <Field label="Headline">
              <textarea value={fields.headline} onChange={e => set('headline', e.target.value)} rows={2} className={inputCls + ' resize-none'} />
            </Field>
            <Field label="Subheadline (italic)">
              <input value={fields.subheadline} onChange={e => set('subheadline', e.target.value)} className={inputCls} />
            </Field>
            <Field label="Body text">
              <textarea value={fields.body} onChange={e => set('body', e.target.value)} rows={2} className={inputCls + ' resize-none'} />
            </Field>
            <Field label="Tips Praktis">
              <input value={fields.tipsText} onChange={e => set('tipsText', e.target.value)} className={inputCls} />
            </Field>
          </Section>

          <Section title="Visual Type">
            <div className="grid grid-cols-2 gap-2">
              {([
                ['timeline', 'Timeline (hours)'],
                ['comparison', 'Before / After'],
                ['checklist', 'Checklist'],
                ['steps', 'Steps'],
                ['none', 'None (illustration only)'],
              ] as [VisualType, string][]).map(([v, label]) => (
                <button key={v} onClick={() => set('visualType', v)}
                  className={cn('text-xs rounded-xl border py-2.5 px-3 text-left transition-colors font-medium',
                    fields.visualType === v ? 'border-violet-400 bg-violet-50 text-violet-700' : 'border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:bg-zinc-50'
                  )}>{label}</button>
              ))}
            </div>
          </Section>

          {fields.visualType === 'timeline' && (
            <Section title="Timeline items">
              {fields.timeline.map((item, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <input value={item.time} onChange={e => { const t = [...fields.timeline]; t[i] = { ...t[i], time: e.target.value }; set('timeline', t) }} placeholder="07:00" className={cn(inputCls, 'w-20 flex-shrink-0')} />
                  <input value={item.text} onChange={e => { const t = [...fields.timeline]; t[i] = { ...t[i], text: e.target.value }; set('timeline', t) }} className={cn(inputCls, 'flex-1')} />
                  <button onClick={() => set('timeline', fields.timeline.filter((_, j) => j !== i))} className="text-zinc-300 hover:text-red-400 mt-2 flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              <button onClick={() => set('timeline', [...fields.timeline, { time: '', text: '' }])} className="text-xs text-violet-600 flex items-center gap-1 mt-1">
                <Plus className="w-3.5 h-3.5" /> Add item
              </button>
            </Section>
          )}

          {fields.visualType === 'comparison' && (
            <Section title="Comparison">
              <div className="grid grid-cols-2 gap-2 mb-2">
                <Field label="Left label"><input value={fields.comparison.leftLabel} onChange={e => set('comparison', { ...fields.comparison, leftLabel: e.target.value })} className={inputCls} /></Field>
                <Field label="Right label"><input value={fields.comparison.rightLabel} onChange={e => set('comparison', { ...fields.comparison, rightLabel: e.target.value })} className={inputCls} /></Field>
              </div>
              {fields.comparison.items.map((item, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <input value={item.left} onChange={e => { const items = [...fields.comparison.items]; items[i] = { ...items[i], left: e.target.value }; set('comparison', { ...fields.comparison, items }) }} placeholder="Without Claude" className={cn(inputCls, 'flex-1')} />
                  <input value={item.right} onChange={e => { const items = [...fields.comparison.items]; items[i] = { ...items[i], right: e.target.value }; set('comparison', { ...fields.comparison, items }) }} placeholder="With Claude" className={cn(inputCls, 'flex-1')} />
                  <button onClick={() => set('comparison', { ...fields.comparison, items: fields.comparison.items.filter((_, j) => j !== i) })} className="text-zinc-300 hover:text-red-400 mt-2 flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              <button onClick={() => set('comparison', { ...fields.comparison, items: [...fields.comparison.items, { left: '', right: '' }] })} className="text-xs text-violet-600 flex items-center gap-1 mt-1">
                <Plus className="w-3.5 h-3.5" /> Add row
              </button>
            </Section>
          )}

          {fields.visualType === 'checklist' && (
            <Section title="Checklist items">
              {fields.checklist.map((item, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input type="checkbox" checked={item.checked} onChange={e => { const t = [...fields.checklist]; t[i] = { ...t[i], checked: e.target.checked }; set('checklist', t) }} className="w-4 h-4 accent-violet-600 flex-shrink-0" />
                  <input value={item.text} onChange={e => { const t = [...fields.checklist]; t[i] = { ...t[i], text: e.target.value }; set('checklist', t) }} className={cn(inputCls, 'flex-1')} />
                  <button onClick={() => set('checklist', fields.checklist.filter((_, j) => j !== i))} className="text-zinc-300 hover:text-red-400 flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              <button onClick={() => set('checklist', [...fields.checklist, { text: '', checked: false }])} className="text-xs text-violet-600 flex items-center gap-1 mt-1">
                <Plus className="w-3.5 h-3.5" /> Add item
              </button>
            </Section>
          )}

          {fields.visualType === 'steps' && (
            <Section title="Steps">
              {fields.steps.map((item, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <input value={item.number} onChange={e => { const t = [...fields.steps]; t[i] = { ...t[i], number: e.target.value }; set('steps', t) }} placeholder="01" className={cn(inputCls, 'w-14 flex-shrink-0')} />
                  <input value={item.text} onChange={e => { const t = [...fields.steps]; t[i] = { ...t[i], text: e.target.value }; set('steps', t) }} className={cn(inputCls, 'flex-1')} />
                  <button onClick={() => set('steps', fields.steps.filter((_, j) => j !== i))} className="text-zinc-300 hover:text-red-400 mt-2 flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              <button onClick={() => set('steps', [...fields.steps, { number: String(fields.steps.length + 1).padStart(2, '0'), text: '' }])} className="text-xs text-violet-600 flex items-center gap-1 mt-1">
                <Plus className="w-3.5 h-3.5" /> Add step
              </button>
            </Section>
          )}

          <div className="h-px bg-zinc-100" />

          {/* Selected element controls */}
          {activeKey && (
            <Section title={`Editing: ${ELEMENT_LABELS[activeKey as keyof TemplateLayout]}`}>
              <div className="grid grid-cols-2 gap-3">
                {([
                  ['X', 'x', 0, 95] as const,
                  ['Y', 'y', 0, 95] as const,
                  ['Width', 'w', 10, 100] as const,
                  ...('h' in fields.layout[activeKey as keyof TemplateLayout] ? [['Height', 'h', 10, 100] as const] : []),
                ]).map(([label, prop, min, max]) => (
                  <div key={prop}>
                    <div className="flex justify-between mb-1">
                      <label className="text-[10px] font-medium text-zinc-500">{label}</label>
                      <span className="text-[10px] text-zinc-400">{Math.round((fields.layout[activeKey as keyof TemplateLayout] as unknown as Record<string, number>)[prop])}%</span>
                    </div>
                    <input type="range" min={min} max={max}
                      value={(fields.layout[activeKey as keyof TemplateLayout] as unknown as Record<string, number>)[prop]}
                      onChange={e => setLayout(activeKey as keyof TemplateLayout, { [prop]: Number(e.target.value) })}
                      className="w-full accent-violet-600 h-1" />
                  </div>
                ))}
              </div>
            </Section>
          )}

          <Section title="Canvas elements">
            <p className="text-[10px] text-zinc-400 -mt-1">Click an element in the preview to select it, then drag or use sliders above.</p>
            <div className="space-y-1">
              {ELEMENT_KEYS.map(key => (
                <button key={key} onClick={() => setActiveKey(activeKey === key ? null : key)}
                  className={cn('w-full text-left text-xs px-3 py-2 rounded-lg transition-colors flex items-center justify-between',
                    activeKey === key ? 'bg-violet-50 text-violet-700 border border-violet-300' : 'text-zinc-600 hover:bg-zinc-50 border border-transparent'
                  )}>
                  <span>{ELEMENT_LABELS[key]}</span>
                  <span className="text-[10px] text-zinc-400 font-mono">
                    x{Math.round(fields.layout[key].x)} y{Math.round(fields.layout[key].y)} w{Math.round(fields.layout[key].w)}{'h' in fields.layout[key] ? ` h${Math.round((fields.layout[key] as VisualLayout).h)}` : ''}
                  </span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 mt-1">
              <button onClick={() => setFields(prev => ({ ...prev, layout: savedLayouts[canvasSize] ?? SIZE_LAYOUTS[canvasSize] }))}
                className="text-[10px] text-violet-500 hover:text-violet-700 transition-colors">
                Reset to default
              </button>
              <button onClick={saveLayoutAsDefault} disabled={saveLayoutStatus === 'saving'}
                className="text-[10px] font-medium text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-lg px-2.5 py-1 transition-colors">
                {saveLayoutStatus === 'saving' ? 'Saving…' : saveLayoutStatus === 'saved' ? '✓ Saved as brand default' : 'Save as brand default'}
              </button>
            </div>
          </Section>

          <div className="h-px bg-zinc-100" />

          {/* Illustration generator */}
          <Section title="Generate illustration (AI)">
            <p className="text-[10px] text-zinc-400 -mt-1">Generate a 3D hero image. It overlays on top of any visual type — drag it to reposition on the canvas.</p>
            <div className="grid grid-cols-3 gap-1.5">
              {([
                ['center',      'Centered',    'Fills the visual area'],
                ['right-float', 'Right float', 'Right side, text left'],
                ['background',  'Background',  'Faded behind content'],
              ] as [IllustrationPosition, string, string][]).map(([v, label, desc]) => (
                <button key={v} onClick={() => set('illustrationPosition', v)}
                  className={cn('text-left rounded-xl border p-2.5 transition-colors',
                    fields.illustrationPosition === v ? 'border-violet-400 bg-violet-50' : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'
                  )}>
                  <p className={cn('text-xs font-semibold', fields.illustrationPosition === v ? 'text-violet-700' : 'text-zinc-600')}>{label}</p>
                  <p className="text-[10px] text-zinc-400 mt-0.5">{desc}</p>
                </button>
              ))}
            </div>
            <textarea value={illustrationPrompt} onChange={e => setIllustrationPrompt(e.target.value)} rows={2}
              placeholder='e.g. "A friendly purple 3D robot sitting at a laptop, looking happy and productive"'
              className={cn(inputCls, 'resize-none')} />
            <div className="flex gap-2 items-center">
              <select value={illustrationModel} onChange={e => setIllustrationModel(e.target.value)} className={cn(inputCls, 'flex-1')}>
                <option value="gpt-image-1">GPT Image 1</option>
                <option value="dall-e-3">DALL·E 3</option>
                <option value="gemini-nano-banana-2">Nano Banana 2 (Gemini)</option>
                <option value="gemini-nano-banana-2-lite">Nano Banana 2 Lite</option>
                <option value="gemini-nano-banana-pro">Nano Banana Pro</option>
              </select>
              <button onClick={generateIllustration} disabled={!illustrationPrompt.trim() || generatingIllustration}
                className="flex items-center gap-1.5 text-xs font-medium bg-violet-600 text-white rounded-xl px-3 py-2 hover:bg-violet-500 disabled:opacity-40 transition-colors whitespace-nowrap flex-shrink-0">
                {generatingIllustration ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
                {generatingIllustration ? 'Generating…' : 'Generate'}
              </button>
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={illustrationTransparent} onChange={e => setIllustrationTransparent(e.target.checked)}
                className="w-3.5 h-3.5 accent-violet-600 rounded" />
              <span className="text-[11px] text-zinc-500">Transparent background (PNG) — GPT Image 1 only</span>
            </label>
            {illustrationError && <p className="text-xs text-red-500">{illustrationError}</p>}
            {fields.illustrationUrl && (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={fields.illustrationUrl} alt="Illustration" className="w-full rounded-xl border border-zinc-200 object-contain max-h-40" />
                <div className="absolute top-2 right-2 flex gap-1">
                  <button onClick={downloadIllustration}
                    className="bg-white/80 hover:bg-white text-zinc-500 hover:text-violet-600 rounded-full p-1 transition-colors">
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => set('illustrationUrl', '')}
                    className="bg-white/80 hover:bg-white text-zinc-500 hover:text-red-500 rounded-full p-1 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </Section>

        </div>

        {/* ── Right: live preview ── */}
        <div className="space-y-3">
          {/* Size picker */}
          <div className="flex items-center gap-2">
            {(['4:5', '1:1', '9:16'] as CanvasSize[]).map(s => (
              <button key={s} onClick={() => switchCanvasSize(s)}
                className={cn('text-xs font-medium border rounded-lg px-3 py-1.5 transition-colors',
                  canvasSize === s ? 'bg-violet-600 text-white border-violet-600' : 'text-zinc-500 border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'
                )}>
                {s}
              </button>
            ))}
            <span className="text-xs text-zinc-400 ml-1">{canvasW}×{canvasH}px</span>
          </div>
          <p className="text-xs text-zinc-400">Preview at {Math.round(SCALE * 100)}% · Hover any element to grab and drag it</p>

          <div className="border border-zinc-200 shadow-sm rounded-2xl overflow-hidden"
            style={{ width: canvasW * SCALE, height: canvasH * SCALE, position: 'relative' }}>
            <div style={{ transform: `scale(${SCALE})`, transformOrigin: 'top left', width: canvasW, height: canvasH }}>
              <PosterTemplate fields={fields} logoUrl={logoUrl} brandName={brandName} primaryColor={primaryColor} lightColor={lightColor} posterRef={posterPreviewRef} setElementRef={setElementRef} canvasW={canvasW} canvasH={canvasH} />
            </div>
            {/* Screen-space drag overlay */}
            <div style={{ position: 'absolute', inset: 0, zIndex: 50, cursor: cursorStyle }}
              onMouseDown={handleOverlayMouseDown}
              onMouseMove={handleOverlayMouseMove}
              onMouseLeave={handleOverlayMouseLeave}
            />
          </div>
        </div>

        {/* Hidden export div */}
        <div style={{ position: 'fixed', left: -9999, top: -9999, pointerEvents: 'none', zIndex: -1 }}>
          <div ref={exportRef} style={{ width: canvasW, height: canvasH }}>
            <PosterTemplate fields={fields} logoUrl={logoUrl} brandName={brandName} primaryColor={primaryColor} lightColor={lightColor} canvasW={canvasW} canvasH={canvasH} />
          </div>
        </div>

      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const inputCls = 'w-full text-xs border border-zinc-200 rounded-lg px-3 py-2 bg-zinc-50 text-zinc-800 focus:outline-none focus:ring-1 focus:ring-violet-400 placeholder:text-zinc-400'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-medium text-zinc-500 block mb-1">{label}</label>
      {children}
    </div>
  )
}
