'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { toPng } from 'html-to-image'
import { Download, Loader2, Plus, Trash2, Sparkles, ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type VisualType = 'timeline' | 'comparison' | 'checklist' | 'steps' | 'illustration-only'
type IllustrationPosition = 'center' | 'right-float' | 'background'

interface TimelineItem { time: string; text: string }
interface ComparisonItem { left: string; right: string }
interface ChecklistItem { text: string; checked: boolean }
interface StepItem { number: string; text: string }

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
  visualX: number
  visualY: number
  visualW: number
  visualH: number
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
  visualX: 0,
  visualY: 0,
  visualW: 100,
  visualH: 100,
}

// ─── Poster Template Component ────────────────────────────────────────────────

function PosterTemplate({ fields, logoUrl, visualAreaRef }: { fields: TemplateFields; logoUrl: string; visualAreaRef?: React.RefObject<HTMLDivElement> }) {
  const W = 1080
  const H = 1350

  return (
    <div
      style={{
        width: W,
        height: H,
        background: '#FFFFFF',
        fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
        position: 'relative',
        overflow: 'hidden',
        padding: '60px 72px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
      }}
    >
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="Logo" style={{ height: 28, objectFit: 'contain' }} />
        ) : (
          <span style={{ fontSize: 20, fontWeight: 800, color: '#5B3FC4', letterSpacing: '-0.5px' }}>BelajarClaude</span>
        )}
      </div>

      {/* Category pill */}
      <div style={{ marginBottom: 20 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: '#E9E3FA', color: '#5B3FC4',
          fontSize: 13, fontWeight: 700, letterSpacing: '0.06em',
          borderRadius: 999, padding: '7px 16px',
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: '#5B3FC4', display: 'inline-block', flexShrink: 0,
          }} />
          {fields.category}
        </span>
      </div>

      {/* Headline */}
      <h1 style={{
        fontSize: 62, fontWeight: 800, lineHeight: 1.1,
        color: '#1A1523', margin: '0 0 16px',
        letterSpacing: '-1.5px',
      }}>
        {fields.headline}
      </h1>

      {/* Subheadline */}
      <p style={{
        fontSize: 26, fontStyle: 'italic', fontWeight: 500,
        color: '#5B3FC4', margin: '0 0 16px', lineHeight: 1.3,
      }}>
        {fields.subheadline}
      </p>

      {/* Body */}
      <p style={{
        fontSize: 18, color: '#4A4458', lineHeight: 1.6,
        margin: '0 0 32px', fontWeight: 400,
      }}>
        {fields.body}
      </p>

      {/* Main visual */}
      <div ref={visualAreaRef} style={{ flex: 1, minHeight: 0, marginBottom: 28, position: 'relative' }}>
        <DraggableResizable x={fields.visualX} y={fields.visualY} w={fields.visualW} h={fields.visualH}>
          {fields.visualType === 'timeline' && <TimelineVisual items={fields.timeline} />}
          {fields.visualType === 'comparison' && <ComparisonVisual data={fields.comparison} />}
          {fields.visualType === 'checklist' && <ChecklistVisual items={fields.checklist} />}
          {fields.visualType === 'steps' && <StepsVisual items={fields.steps} />}
          {fields.visualType === 'illustration-only' && (
            <IllustrationVisual url={fields.illustrationUrl} position={fields.illustrationPosition} />
          )}
        </DraggableResizable>
      </div>

      {/* Tips Praktis bar */}
      {fields.tipsText && (
        <div style={{
          background: '#F5F2FC', borderRadius: 20,
          padding: '18px 24px', display: 'flex', alignItems: 'center', gap: 16,
          marginBottom: 28,
        }}>
          <span style={{ fontSize: 26, flexShrink: 0 }}>💡</span>
          <p style={{ fontSize: 16, color: '#27232D', margin: 0, lineHeight: 1.5 }}>
            <strong>Tips Praktis: </strong>{fields.tipsText}
          </p>
        </div>
      )}

      {/* Footer */}
      <div style={{
        background: '#FFFFFF', borderRadius: 20,
        border: '1.5px solid #ECE8F8',
        padding: '16px 24px',
        display: 'flex', alignItems: 'center', gap: 0,
        boxShadow: '0 2px 12px rgba(91,63,196,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 22, color: '#5B3FC4', fontWeight: 700, flexShrink: 0 }}>↗</span>
          <span style={{ fontSize: 13, color: '#4A4458', lineHeight: 1.4 }}>
            Belajar Claude AI secara praktis<br />bahasa Indonesia untuk semua level
          </span>
        </div>
        <div style={{ width: 1.5, background: '#ECE8F8', alignSelf: 'stretch', margin: '0 20px', flexShrink: 0 }} />
        <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
          {[
            { icon: '🇮🇩', label: 'Bahasa Indonesia' },
            { icon: '⭐', label: 'Untuk semua level' },
            { icon: '✅', label: 'Langsung praktik' },
          ].map(b => (
            <div key={b.label} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: '#F5F2FC', borderRadius: 10,
              padding: '6px 12px', fontSize: 12, color: '#5B3FC4', fontWeight: 600,
            }}>
              <span style={{ fontSize: 14 }}>{b.icon}</span>
              {b.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Draggable + Resizable wrapper ───────────────────────────────────────────

function DraggableResizable({ x, y, w, h, children }: {
  x: number; y: number; w: number; h: number; children: React.ReactNode
}) {
  return (
    <div style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%` }}>
      <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>{children}</div>
      {/* visual indicator only — drag is handled by the external overlay */}
      <div style={{
        position: 'absolute', inset: 0, border: '2px dashed rgba(91,63,196,0.4)',
        borderRadius: 8, pointerEvents: 'none',
      }} />
    </div>
  )
}

function TimelineVisual({ items }: { items: TimelineItem[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, height: '100%', alignContent: 'start' }}>
      {items.map((item, i) => (
        <div key={i} style={{
          background: '#FFFFFF', border: '1.5px solid #F0EDF8',
          borderRadius: 20, padding: '20px 24px',
          display: 'flex', alignItems: 'center', gap: 16,
          boxShadow: '0 2px 12px rgba(91,63,196,0.06)',
        }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 26, fontWeight: 800, color: '#5B3FC4', margin: 0, letterSpacing: '-0.5px' }}>{item.time}</p>
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
        { label: data.leftLabel, items: data.items.map(i => i.left), accent: '#E5484D', bg: '#FFF5F5' },
        { label: data.rightLabel, items: data.items.map(i => i.right), accent: '#22A06B', bg: '#F0FFF8' },
      ].map(col => (
        <div key={col.label} style={{ background: col.bg, borderRadius: 20, padding: 24 }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: col.accent, marginBottom: 16, letterSpacing: '0.04em', textTransform: 'uppercase' as const }}>{col.label}</p>
          {col.items.map((item, i) => (
            <div key={i} style={{
              background: '#FFFFFF', borderRadius: 12, padding: '12px 16px',
              marginBottom: 10, fontSize: 15, color: '#27232D', lineHeight: 1.4,
            }}>{item}</div>
          ))}
        </div>
      ))}
    </div>
  )
}

function ChecklistVisual({ items }: { items: ChecklistItem[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%', justifyContent: 'flex-start' }}>
      {items.map((item, i) => (
        <div key={i} style={{
          background: '#FFFFFF', border: '1.5px solid #F0EDF8',
          borderRadius: 16, padding: '16px 20px',
          display: 'flex', alignItems: 'center', gap: 16,
          boxShadow: '0 1px 8px rgba(91,63,196,0.05)',
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
            background: item.checked ? '#5B3FC4' : '#F0EDF8',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {item.checked && <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>✓</span>}
          </div>
          <span style={{ fontSize: 17, color: item.checked ? '#27232D' : '#8B80A0', fontWeight: item.checked ? 500 : 400 }}>{item.text}</span>
        </div>
      ))}
    </div>
  )
}

function StepsVisual({ items }: { items: StepItem[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {items.map((item, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'flex-start', gap: 20,
          background: '#FAFAFA', borderRadius: 16, padding: '18px 22px',
          border: '1.5px solid #F0EDF8',
        }}>
          <span style={{
            fontSize: 28, fontWeight: 900, color: '#E9E3FA',
            letterSpacing: '-1px', flexShrink: 0, lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}>{item.number}</span>
          <p style={{ fontSize: 17, color: '#27232D', margin: 0, lineHeight: 1.5, fontWeight: 500 }}>{item.text}</p>
        </div>
      ))}
    </div>
  )
}

function IllustrationVisual({ url, position }: { url: string; position: IllustrationPosition }) {
  if (!url) {
    return (
      <div style={{
        width: '100%', height: '100%', minHeight: 200,
        border: '2.5px dashed #C4B5FD', borderRadius: 24,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: '#FAFAFF', gap: 12,
      }}>
        <div style={{ fontSize: 48 }}>🖼️</div>
        <p style={{ fontSize: 16, color: '#A78BFA', fontWeight: 600, margin: 0 }}>Illustration appears here</p>
        <p style={{ fontSize: 13, color: '#C4B5FD', margin: 0 }}>
          {position === 'center' && 'Centered'}
          {position === 'right-float' && 'Right side'}
          {position === 'background' && 'Faded background'}
        </p>
      </div>
    )
  }
  const isBackground = position === 'background'
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" draggable={false} style={{
      width: '100%', height: '100%',
      objectFit: 'contain',
      opacity: isBackground ? 0.15 : 1,
      borderRadius: 16,
      display: 'block',
    }} />
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface QueuePost { id: string; title: string | null; caption: string; image_concept: string | null; status: string; cada_campaigns?: { name: string } | null }

export default function TemplatePage() {
  const [fields, setFields] = useState<TemplateFields>(DEFAULT)
  const [logoUrl, setLogoUrl] = useState('')
  const [exporting, setExporting] = useState(false)
  const posterRef = useRef<HTMLDivElement>(null)

  // Load from post
  const [posts, setPosts] = useState<QueuePost[]>([])
  const [loadingPost, setLoadingPost] = useState(false)
  const [selectedPostId, setSelectedPostId] = useState('')

  // Illustration generation
  const [illustrationPrompt, setIllustrationPrompt] = useState('')
  const [illustrationModel, setIllustrationModel] = useState('gpt-image-1')
  const [generatingIllustration, setGeneratingIllustration] = useState(false)

  const set = useCallback(<K extends keyof TemplateFields>(key: K, value: TemplateFields[K]) => {
    setFields(prev => ({ ...prev, [key]: value }))
  }, [])

  const visualAreaRef = useRef<HTMLDivElement>(null)
  const fieldsRef = useRef(fields)
  fieldsRef.current = fields
  const [draggingVisual, setDraggingVisual] = useState(false)
  const [overVisual, setOverVisual] = useState(false)


  const handlePreviewMouseDown = useCallback((e: React.MouseEvent) => {
    if (!visualAreaRef.current) return
    const va = visualAreaRef.current.getBoundingClientRect()
    if (e.clientX < va.left || e.clientX > va.right || e.clientY < va.top || e.clientY > va.bottom) return
    e.preventDefault()
    setDraggingVisual(true)
    const { visualX, visualY } = fieldsRef.current
    const smx = e.clientX, smy = e.clientY
    const onMv = (ev: MouseEvent) => {
      const dxPct = (ev.clientX - smx) / va.width * 100
      const dyPct = (ev.clientY - smy) / va.height * 100
      setFields(prev => ({
        ...prev,
        visualX: Math.max(0, Math.min(100 - prev.visualW, visualX + dxPct)),
        visualY: Math.max(0, Math.min(100 - prev.visualH, visualY + dyPct)),
      }))
    }
    const onUp = () => { setDraggingVisual(false); document.removeEventListener('mousemove', onMv); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMv); document.addEventListener('mouseup', onUp)
  }, [])

  const handlePreviewMouseMove = useCallback((e: React.MouseEvent) => {
    if (!visualAreaRef.current) return
    const va = visualAreaRef.current.getBoundingClientRect()
    setOverVisual(e.clientX >= va.left && e.clientX <= va.right && e.clientY >= va.top && e.clientY <= va.bottom)
  }, [])

  useEffect(() => {
    fetch('/api/settings/brand')
      .then(r => r.json())
      .then(d => {
        const raw = d.brand_logo_url ?? ''
        setLogoUrl(raw.replace(/^"|"$/g, ''))
      })
      .catch(() => {})
    fetch('/api/agents/post-queue')
      .then(r => r.json())
      .then(d => setPosts((d.posts ?? []).filter((p: QueuePost) => p.image_concept || p.caption)))
      .catch(() => {})
  }, [])

  async function loadFromPost(postId: string) {
    const post = posts.find(p => p.id === postId)
    if (!post) return
    setLoadingPost(true)
    try {
      const res = await fetch('/api/template/parse-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_concept: post.image_concept, caption: post.caption }),
      })
      const data = await res.json()
      if (data.fields) {
        setFields(prev => ({
          ...DEFAULT,
          ...data.fields,
          illustrationUrl: prev.illustrationUrl,
          visualX: 0, visualY: 0, visualW: 100, visualH: 100,
        }))
      }
    } finally {
      setLoadingPost(false)
    }
  }

  async function generateIllustration() {
    if (!illustrationPrompt.trim()) return
    setGeneratingIllustration(true)
    try {
      const res = await fetch('/api/template/generate-illustration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: illustrationPrompt, model: illustrationModel }),
      })
      const data = await res.json()
      if (data.url) {
        set('illustrationUrl', data.url)
        set('visualType', 'illustration-only')
      }
    } finally {
      setGeneratingIllustration(false)
    }
  }

  async function handleExport() {
    if (!posterRef.current) return
    setExporting(true)
    try {
      const dataUrl = await toPng(posterRef.current, { pixelRatio: 1 })
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `belajarclaude-${fields.category.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.png`
      a.click()
    } finally {
      setExporting(false)
    }
  }

  const SCALE = 0.42 // preview scale: 1080 * 0.42 ≈ 454px wide

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Image Template</h1>
          <p className="text-sm text-zinc-500 mt-1">Design a post template, then export as PNG. No AI needed for text edits.</p>
        </div>
        <Button onClick={handleExport} disabled={exporting} className="gap-2">
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {exporting ? 'Exporting…' : 'Download PNG'}
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-6 items-start">

        {/* ── Left: form ── */}
        <div className="space-y-4 bg-white rounded-2xl border border-zinc-200 p-5">

          {/* Load from post queue */}
          <Section title="Load from post queue">
            <p className="text-[10px] text-zinc-400 -mt-1">Pick a post and AI fills all the fields for you.</p>
            <div className="flex gap-2">
              <select
                value={selectedPostId}
                onChange={e => setSelectedPostId(e.target.value)}
                className={cn(inputCls, 'flex-1')}
              >
                <option value="">— Choose a post —</option>
                {posts.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.cada_campaigns?.name ? `${p.cada_campaigns.name} · ` : ''}{p.title ?? p.caption.slice(0, 40)} ({p.status})
                  </option>
                ))}
              </select>
              <button
                onClick={() => loadFromPost(selectedPostId)}
                disabled={!selectedPostId || loadingPost}
                className="flex items-center gap-1.5 text-xs font-medium bg-violet-600 text-white rounded-xl px-3 py-2 hover:bg-violet-500 disabled:opacity-40 transition-colors whitespace-nowrap flex-shrink-0"
              >
                {loadingPost ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {loadingPost ? 'Loading…' : 'Auto-fill'}
              </button>
            </div>
          </Section>

          <div className="h-px bg-zinc-100" />

          <Section title="Text Content">
            <Field label="Category pill">
              <input value={fields.category} onChange={e => set('category', e.target.value)}
                className={inputCls} placeholder="AKTIVITAS HARIAN" />
            </Field>
            <Field label="Headline">
              <textarea value={fields.headline} onChange={e => set('headline', e.target.value)}
                rows={2} className={inputCls + ' resize-none'} />
            </Field>
            <Field label="Subheadline (italic)">
              <input value={fields.subheadline} onChange={e => set('subheadline', e.target.value)}
                className={inputCls} />
            </Field>
            <Field label="Body text">
              <textarea value={fields.body} onChange={e => set('body', e.target.value)}
                rows={2} className={inputCls + ' resize-none'} />
            </Field>
            <Field label="Tips Praktis">
              <input value={fields.tipsText} onChange={e => set('tipsText', e.target.value)}
                className={inputCls} />
            </Field>
          </Section>

          <Section title="Visual Type">
            <div className="grid grid-cols-2 gap-2">
              {([
                ['timeline', 'Timeline (hours)'],
                ['comparison', 'Before / After'],
                ['checklist', 'Checklist'],
                ['steps', 'Steps'],
                ['illustration-only', 'Illustration only'],
              ] as [VisualType, string][]).map(([v, label]) => (
                <button key={v} onClick={() => set('visualType', v)}
                  className={cn('text-xs rounded-xl border py-2.5 px-3 text-left transition-colors font-medium',
                    fields.visualType === v
                      ? 'border-violet-400 bg-violet-50 text-violet-700'
                      : 'border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:bg-zinc-50'
                  )}>
                  {label}
                </button>
              ))}
            </div>
          </Section>

          {fields.visualType === 'timeline' && (
            <Section title="Timeline items">
              {fields.timeline.map((item, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <input value={item.time} onChange={e => {
                    const t = [...fields.timeline]; t[i] = { ...t[i], time: e.target.value }; set('timeline', t)
                  }} placeholder="07:00" className={cn(inputCls, 'w-20 flex-shrink-0')} />
                  <input value={item.text} onChange={e => {
                    const t = [...fields.timeline]; t[i] = { ...t[i], text: e.target.value }; set('timeline', t)
                  }} className={cn(inputCls, 'flex-1')} />
                  <button onClick={() => set('timeline', fields.timeline.filter((_, j) => j !== i))}
                    className="text-zinc-300 hover:text-red-400 mt-2 flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              <button onClick={() => set('timeline', [...fields.timeline, { time: '', text: '' }])}
                className="text-xs text-violet-600 flex items-center gap-1 mt-1">
                <Plus className="w-3.5 h-3.5" /> Add item
              </button>
            </Section>
          )}

          {fields.visualType === 'comparison' && (
            <Section title="Comparison">
              <div className="grid grid-cols-2 gap-2 mb-2">
                <Field label="Left label">
                  <input value={fields.comparison.leftLabel} onChange={e => set('comparison', { ...fields.comparison, leftLabel: e.target.value })}
                    className={inputCls} />
                </Field>
                <Field label="Right label">
                  <input value={fields.comparison.rightLabel} onChange={e => set('comparison', { ...fields.comparison, rightLabel: e.target.value })}
                    className={inputCls} />
                </Field>
              </div>
              {fields.comparison.items.map((item, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <input value={item.left} onChange={e => {
                    const items = [...fields.comparison.items]; items[i] = { ...items[i], left: e.target.value }
                    set('comparison', { ...fields.comparison, items })
                  }} placeholder="Without Claude" className={cn(inputCls, 'flex-1')} />
                  <input value={item.right} onChange={e => {
                    const items = [...fields.comparison.items]; items[i] = { ...items[i], right: e.target.value }
                    set('comparison', { ...fields.comparison, items })
                  }} placeholder="With Claude" className={cn(inputCls, 'flex-1')} />
                  <button onClick={() => set('comparison', { ...fields.comparison, items: fields.comparison.items.filter((_, j) => j !== i) })}
                    className="text-zinc-300 hover:text-red-400 mt-2 flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              <button onClick={() => set('comparison', { ...fields.comparison, items: [...fields.comparison.items, { left: '', right: '' }] })}
                className="text-xs text-violet-600 flex items-center gap-1 mt-1">
                <Plus className="w-3.5 h-3.5" /> Add row
              </button>
            </Section>
          )}

          {fields.visualType === 'checklist' && (
            <Section title="Checklist items">
              {fields.checklist.map((item, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input type="checkbox" checked={item.checked}
                    onChange={e => { const t = [...fields.checklist]; t[i] = { ...t[i], checked: e.target.checked }; set('checklist', t) }}
                    className="w-4 h-4 accent-violet-600 flex-shrink-0" />
                  <input value={item.text} onChange={e => {
                    const t = [...fields.checklist]; t[i] = { ...t[i], text: e.target.value }; set('checklist', t)
                  }} className={cn(inputCls, 'flex-1')} />
                  <button onClick={() => set('checklist', fields.checklist.filter((_, j) => j !== i))}
                    className="text-zinc-300 hover:text-red-400 flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              <button onClick={() => set('checklist', [...fields.checklist, { text: '', checked: false }])}
                className="text-xs text-violet-600 flex items-center gap-1 mt-1">
                <Plus className="w-3.5 h-3.5" /> Add item
              </button>
            </Section>
          )}

          {fields.visualType === 'steps' && (
            <Section title="Steps">
              {fields.steps.map((item, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <input value={item.number} onChange={e => {
                    const t = [...fields.steps]; t[i] = { ...t[i], number: e.target.value }; set('steps', t)
                  }} placeholder="01" className={cn(inputCls, 'w-14 flex-shrink-0')} />
                  <input value={item.text} onChange={e => {
                    const t = [...fields.steps]; t[i] = { ...t[i], text: e.target.value }; set('steps', t)
                  }} className={cn(inputCls, 'flex-1')} />
                  <button onClick={() => set('steps', fields.steps.filter((_, j) => j !== i))}
                    className="text-zinc-300 hover:text-red-400 mt-2 flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              <button onClick={() => set('steps', [...fields.steps, { number: String(fields.steps.length + 1).padStart(2, '0'), text: '' }])}
                className="text-xs text-violet-600 flex items-center gap-1 mt-1">
                <Plus className="w-3.5 h-3.5" /> Add step
              </button>
            </Section>
          )}

          <div className="h-px bg-zinc-100" />

          {/* Visual position & size */}
          <Section title="Visual position & size">
            <p className="text-[10px] text-zinc-400 -mt-1">Adjust where the visual sits inside the poster. 0% = top/left, 100% = full width/height.</p>
            <div className="grid grid-cols-2 gap-3">
              {([
                ['X position', 'visualX', 0, 80] as const,
                ['Y position', 'visualY', 0, 80] as const,
                ['Width',      'visualW', 20, 100] as const,
                ['Height',     'visualH', 20, 100] as const,
              ]).map(([label, key, min, max]) => (
                <div key={key}>
                  <div className="flex justify-between mb-1">
                    <label className="text-[10px] font-medium text-zinc-500">{label}</label>
                    <span className="text-[10px] text-zinc-400">{Math.round(fields[key])}%</span>
                  </div>
                  <input type="range" min={min} max={max} value={fields[key]}
                    onChange={e => set(key, Number(e.target.value))}
                    className="w-full accent-violet-600 h-1" />
                </div>
              ))}
            </div>
            <button onClick={() => setFields(prev => ({ ...prev, visualX: 0, visualY: 0, visualW: 100, visualH: 100 }))}
              className="text-[10px] text-violet-500 hover:text-violet-700 transition-colors">
              Reset to full area
            </button>
          </Section>

          <div className="h-px bg-zinc-100" />

          {/* Illustration generator */}
          <Section title="Generate illustration (AI)">
            <p className="text-[10px] text-zinc-400 -mt-1">Generate a 3D hero image. The preview shows placement before you generate.</p>
            <div className="grid grid-cols-3 gap-1.5">
              {([
                ['center',      'Centered',      'Fills the visual area'],
                ['right-float', 'Right float',   'Right side, text left'],
                ['background',  'Background',    'Faded behind content'],
              ] as [IllustrationPosition, string, string][]).map(([v, label, desc]) => (
                <button key={v}
                  onClick={() => { set('illustrationPosition', v); set('visualType', 'illustration-only') }}
                  className={cn('text-left rounded-xl border p-2.5 transition-colors',
                    fields.illustrationPosition === v && fields.visualType === 'illustration-only'
                      ? 'border-violet-400 bg-violet-50'
                      : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'
                  )}>
                  <p className={cn('text-xs font-semibold', fields.illustrationPosition === v && fields.visualType === 'illustration-only' ? 'text-violet-700' : 'text-zinc-600')}>{label}</p>
                  <p className="text-[10px] text-zinc-400 mt-0.5">{desc}</p>
                </button>
              ))}
            </div>
            <textarea
              value={illustrationPrompt}
              onChange={e => setIllustrationPrompt(e.target.value)}
              rows={2}
              placeholder='e.g. "A friendly purple 3D robot sitting at a laptop, looking happy and productive"'
              className={cn(inputCls, 'resize-none')}
            />
            <div className="flex gap-2 items-center">
              <select
                value={illustrationModel}
                onChange={e => setIllustrationModel(e.target.value)}
                className={cn(inputCls, 'flex-1')}
              >
                <option value="gpt-image-1">GPT Image 1</option>
                <option value="dall-e-3">DALL·E 3</option>
                <option value="gemini-nano-banana-2">Nano Banana 2 (Gemini)</option>
                <option value="gemini-nano-banana-2-lite">Nano Banana 2 Lite</option>
                <option value="gemini-nano-banana-pro">Nano Banana Pro</option>
              </select>
              <button
                onClick={generateIllustration}
                disabled={!illustrationPrompt.trim() || generatingIllustration}
                className="flex items-center gap-1.5 text-xs font-medium bg-violet-600 text-white rounded-xl px-3 py-2 hover:bg-violet-500 disabled:opacity-40 transition-colors whitespace-nowrap flex-shrink-0"
              >
                {generatingIllustration ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
                {generatingIllustration ? 'Generating…' : 'Generate'}
              </button>
            </div>
            {fields.illustrationUrl && (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={fields.illustrationUrl} alt="Illustration" className="w-full rounded-xl border border-zinc-200 object-contain max-h-40" />
                <button onClick={() => set('illustrationUrl', '')}
                  className="absolute top-2 right-2 bg-white/80 hover:bg-white text-zinc-500 hover:text-red-500 rounded-full p-1 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </Section>

        </div>

        {/* ── Right: live preview ── */}
        <div className="space-y-3">
          <p className="text-xs text-zinc-400">Preview at {Math.round(SCALE * 100)}% · Final size 1080×1350px</p>

          {/* Visible scaled preview */}
          <div
            className="border border-zinc-200 shadow-sm rounded-2xl overflow-hidden"
            style={{ width: 1080 * SCALE, height: 1350 * SCALE, position: 'relative' }}
          >
            <div style={{ transform: `scale(${SCALE})`, transformOrigin: 'top left', width: 1080, height: 1350 }}>
              <PosterTemplate fields={fields} logoUrl={logoUrl} visualAreaRef={visualAreaRef} />
            </div>
            {/* Drag overlay — lives in screen space, not scaled space */}
            <div
              style={{ position: 'absolute', inset: 0, zIndex: 50, cursor: draggingVisual ? 'grabbing' : overVisual ? 'grab' : 'default' }}
              onMouseDown={handlePreviewMouseDown}
              onMouseMove={handlePreviewMouseMove}
              onMouseLeave={() => setOverVisual(false)}
            />
          </div>
        </div>

        {/* Hidden off-screen div used only for PNG export */}
        <div style={{ position: 'fixed', left: -9999, top: -9999, pointerEvents: 'none', zIndex: -1 }}>
          <div ref={posterRef} style={{ width: 1080, height: 1350 }}>
            <PosterTemplate fields={fields} logoUrl={logoUrl} visualAreaRef={undefined} />
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
