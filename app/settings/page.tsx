'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Settings, Save, CheckCircle2, Globe,
  Palette, Users, FileText, Sparkles, Calendar, Eye, EyeOff, Link, Loader2, Image, Upload, X,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────────────────

interface BrandSettings {
  brand_name: string
  brand_handle: string
  brand_description: string
  brand_products_list: string
  brand_price_point: string
  brand_markets: string
  brand_channels: string
  brand_subject_description: string
  brand_hashtags: string
  brand_ecommerce_platform: string
  brand_industry: string
  brand_voice: string
  brand_guidelines: string
  brand_target_customer: string
  brand_campaign_theme: string
  brand_caption_examples: string
  image_quality: 'low' | 'medium' | 'high'
}

interface VisualKitSettings {
  brand_style_prefix: string
  brand_negative_prompts: string
  brand_color_description: string
  brand_shot_style: string
  brand_style_reference_url: string
  brand_color_swatch_url: string
  brand_model_reference_url: string
  brand_logo_url: string
  brand_colors: string // JSON array of hex strings e.g. ["#F5E6D3","#6B0F2B"]
}

interface ConnectionSettings {
  instagram_app_id: string
  instagram_app_secret: string
  instagram_access_token: string
  instagram_business_account_id: string
  instagram_user_token: string
  instagram_username: string
  tiktok_client_key: string
  tiktok_client_secret: string
  tiktok_access_token: string
  tiktok_open_id: string
  tiktok_post_mode: 'draft' | 'direct'
  tiktok_username: string
  drive_media_folder_id: string
  drive_media_upload_enabled: string
}

const BRAND_DEFAULTS: BrandSettings = {
  brand_name: '',
  brand_handle: '',
  brand_description: '',
  brand_products_list: '',
  brand_price_point: '',
  brand_markets: '',
  brand_channels: '',
  brand_subject_description: '',
  brand_hashtags: '',
  brand_ecommerce_platform: '',
  brand_industry: '',
  brand_voice: '',
  brand_guidelines: '',
  brand_target_customer: '',
  brand_campaign_theme: '',
  brand_caption_examples: '',
  image_quality: 'medium',
}

const VISUAL_KIT_DEFAULTS: VisualKitSettings = {
  brand_style_prefix: '',
  brand_negative_prompts: '',
  brand_color_description: '',
  brand_shot_style: '',
  brand_style_reference_url: '',
  brand_color_swatch_url: '',
  brand_model_reference_url: '',
  brand_logo_url: '',
  brand_colors: '["#F5E6D3","#6B0F2B","#C4A882","#8B7355","#F0EBE3"]',
}

const CONNECTION_DEFAULTS: ConnectionSettings = {
  instagram_app_id: '',
  instagram_app_secret: '',
  instagram_access_token: '',
  instagram_business_account_id: '',
  instagram_user_token: '',
  instagram_username: '',
  tiktok_client_key: '',
  tiktok_client_secret: '',
  tiktok_access_token: '',
  tiktok_open_id: '',
  tiktok_post_mode: 'draft',
  tiktok_username: '',
  drive_media_folder_id: '',
  drive_media_upload_enabled: 'false',
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function PhotoAnalyzer({ onResult }: {
  onResult: (r: { style_prefix: string; color_description: string; shot_style: string; negative_prompts: string; summary: string }) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<File[]>([])
  const [analyzing, setAnalyzing] = useState(false)
  const [summary, setSummary] = useState('')
  const [error, setError] = useState('')

  function handleFiles(selected: FileList | null) {
    if (!selected) return
    const arr = Array.from(selected).slice(0, 20)
    setFiles(arr)
    setSummary('')
    setError('')
  }

  async function analyze() {
    if (!files.length) return
    setAnalyzing(true)
    setError('')
    setSummary('')
    try {
      const fd = new FormData()
      files.forEach(f => fd.append('photos', f))
      const res = await fetch('/api/settings/brand-kit/analyze-photos', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Analysis failed')
      onResult(data.analysis)
      setSummary(data.analysis.summary)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div className="space-y-3">
      <div
        className="rounded-xl border-2 border-dashed border-violet-200 bg-white p-4 text-center cursor-pointer hover:border-violet-400 transition-colors"
        onClick={() => inputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
      >
        <Upload className="w-5 h-5 text-violet-400 mx-auto mb-1.5" />
        <p className="text-sm font-medium text-violet-700">
          {files.length > 0 ? `${files.length} photo${files.length > 1 ? 's' : ''} selected` : 'Click or drop 5–20 brand photos'}
        </p>
        <p className="text-xs text-zinc-400 mt-0.5">JPG, PNG — up to 20 photos</p>
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleFiles(e.target.files)} />

      {files.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {files.slice(0, 8).map((f, i) => (
            <div key={i} className="w-12 h-12 rounded-lg bg-zinc-100 overflow-hidden border border-zinc-200">
              <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
            </div>
          ))}
          {files.length > 8 && <div className="w-12 h-12 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center text-xs text-zinc-500 font-medium">+{files.length - 8}</div>}
        </div>
      )}

      <button
        onClick={analyze}
        disabled={files.length < 1 || analyzing}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 transition-colors"
      >
        {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        {analyzing ? 'Analyzing your photos…' : 'Analyze & Auto-fill'}
      </button>

      {summary && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-emerald-700 mb-0.5">Style fields filled in!</p>
              <p className="text-xs text-emerald-700">{summary}</p>
              <p className="text-xs text-zinc-400 mt-1">Review the fields below and click Save Changes.</p>
            </div>
          </div>
        </div>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

function ColorPaletteEditor({ value, onChange }: {
  value: string
  onChange: (v: string) => void
}) {
  const colors: string[] = (() => {
    try { return JSON.parse(value) } catch { return ['#F5E6D3','#6B0F2B','#C4A882','#8B7355','#F0EBE3'] }
  })()

  function update(i: number, hex: string) {
    const next = [...colors]
    next[i] = hex
    onChange(JSON.stringify(next))
  }

  function addColor() {
    if (colors.length >= 8) return
    onChange(JSON.stringify([...colors, '#CCCCCC']))
  }

  function removeColor(i: number) {
    if (colors.length <= 1) return
    const next = colors.filter((_, idx) => idx !== i)
    onChange(JSON.stringify(next))
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {colors.map((hex, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5 group">
            <div className="relative">
              {/* Color swatch — click to open native color picker */}
              <label className="block w-12 h-12 rounded-xl border-2 border-zinc-200 cursor-pointer shadow-sm hover:scale-105 transition-transform overflow-hidden"
                style={{ backgroundColor: hex }}>
                <input
                  type="color"
                  value={hex}
                  onChange={e => update(i, e.target.value)}
                  className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                />
              </label>
              <button
                type="button"
                onClick={() => removeColor(i)}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-zinc-200 text-zinc-500 hover:bg-red-100 hover:text-red-500 items-center justify-center hidden group-hover:flex transition-colors"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
            {/* Hex input */}
            <input
              type="text"
              value={hex}
              onChange={e => {
                const v = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`
                if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) update(i, v)
              }}
              maxLength={7}
              className="w-12 text-center text-[10px] font-mono border border-zinc-200 rounded-lg px-1 py-0.5 bg-zinc-50 focus:outline-none focus:ring-1 focus:ring-violet-400"
            />
          </div>
        ))}

        {/* Add color button */}
        {colors.length < 8 && (
          <button
            type="button"
            onClick={addColor}
            className="w-12 h-12 rounded-xl border-2 border-dashed border-zinc-300 text-zinc-400 hover:border-violet-400 hover:text-violet-500 transition-colors flex items-center justify-center text-lg font-light"
          >
            +
          </button>
        )}
      </div>
      <p className="text-[10px] text-zinc-400">Click a swatch to open color picker · hover to remove · up to 8 colors</p>
    </div>
  )
}

function ImageUploadField({
  label, description, settingKey, value, onChange,
}: {
  label: string
  description?: string
  settingKey: string
  value: string
  onChange: (url: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function handleFile(file: File) {
    setUploading(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('key', settingKey)
      const res = await fetch('/api/settings/brand-kit/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Upload failed')
      onChange(data.url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-zinc-700">{label}</label>
      {description && <p className="text-xs text-zinc-400">{description}</p>}
      <div
        className={cn(
          'relative rounded-xl border-2 border-dashed transition-colors',
          value ? 'border-emerald-200 bg-emerald-50/40' : 'border-zinc-200 bg-zinc-50 hover:border-violet-300 hover:bg-violet-50/30'
        )}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
      >
        {value ? (
          <div className="flex items-center gap-3 p-3">
            <img src={value} alt={label} className="w-14 h-14 object-cover rounded-lg border border-zinc-200 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-emerald-700 truncate">Uploaded</p>
              <p className="text-[10px] text-zinc-400 truncate">{value.split('/').pop()}</p>
            </div>
            <button
              type="button"
              onClick={() => onChange('')}
              className="text-zinc-400 hover:text-red-500 transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex flex-col items-center gap-1.5 w-full py-5 text-zinc-400 hover:text-violet-500 transition-colors"
          >
            {uploading
              ? <Loader2 className="w-5 h-5 animate-spin" />
              : <Upload className="w-5 h-5" />
            }
            <span className="text-xs">{uploading ? 'Uploading…' : 'Click or drop image here'}</span>
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />
    </div>
  )
}

function Field({
  label, description, placeholder, value, onChange, rows = 4, secret = false, lockable = false,
}: {
  label: string
  description?: string
  placeholder: string
  value: string
  onChange: (v: string) => void
  rows?: number
  secret?: boolean
  lockable?: boolean
}) {
  const [show, setShow] = useState(false)
  const [editing, setEditing] = useState(false)
  const isLocked = lockable && !!value && !editing

  if (secret || lockable) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-semibold text-zinc-700">{label}</label>
          {isLocked && (
            <button type="button" onClick={() => setEditing(true)} className="text-xs text-zinc-400 hover:text-violet-600 underline">Edit</button>
          )}
        </div>
        {description && <p className="text-xs text-zinc-400">{description}</p>}
        <div className="relative">
          <input
            type={secret && !show ? 'password' : 'text'}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={isLocked}
            className={cn(
              'w-full rounded-xl border bg-zinc-50 px-3 py-2.5 text-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent font-mono',
              isLocked ? 'border-zinc-100 text-zinc-400 cursor-not-allowed' : 'border-zinc-200 text-zinc-800 pr-10'
            )}
          />
          {secret && !isLocked && (
            <button
              type="button"
              onClick={() => setShow(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
            >
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-zinc-700">{label}</label>
      {description && <p className="text-xs text-zinc-400">{description}</p>}
      <textarea
        rows={rows}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-800 placeholder-zinc-400 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
      />
    </div>
  )
}

function SaveBar({ onSave, saving, saved }: { onSave: () => void; saving: boolean; saved: boolean }) {
  return (
    <div className="pt-2">
      <Button onClick={onSave} loading={saving} className="w-full" size="lg">
        {saved
          ? <><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Saved!</>
          : <><Save className="w-4 h-4" /> Save Changes</>
        }
      </Button>
    </div>
  )
}

// ── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'brand',       label: 'Brand',       icon: Palette },
  { id: 'visual-kit',  label: 'Visual Kit',  icon: Image },
  { id: 'connections', label: 'Connections',  icon: Globe },
]

// ── Page ─────────────────────────────────────────────────────────────────────

function SettingsContent() {
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<'brand' | 'visual-kit' | 'connections'>(
    searchParams.get('tab') === 'connections' ? 'connections' : 'brand'
  )
  const [brand, setBrand] = useState<BrandSettings>(BRAND_DEFAULTS)
  const [visualKit, setVisualKit] = useState<VisualKitSettings>(VISUAL_KIT_DEFAULTS)
  const [connections, setConnections] = useState<ConnectionSettings>(CONNECTION_DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeMsg, setAnalyzeMsg] = useState('')
  const [tiktokStatus, setTiktokStatus] = useState<'success' | 'error' | null>(
    searchParams.get('success') === 'tiktok' ? 'success' :
    searchParams.get('error')?.startsWith('tiktok') ? 'error' : null
  )
  const [instagramStatus, setInstagramStatus] = useState<'success' | 'error' | null>(
    searchParams.get('success') === 'instagram' ? 'success' :
    searchParams.get('error')?.startsWith('instagram') ? 'error' : null
  )

  useEffect(() => {
    Promise.all([
      fetch('/api/settings/brand').then(r => r.json()),
      fetch('/api/settings/connections').then(r => r.json()),
    ]).then(([b, c]) => {
      setBrand({ ...BRAND_DEFAULTS, ...b })
      setVisualKit({ ...VISUAL_KIT_DEFAULTS, ...b })
      setConnections({ ...CONNECTION_DEFAULTS, ...c })
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    const endpoint = tab === 'connections' ? '/api/settings/connections' : '/api/settings/brand'
    const body = tab === 'brand' ? brand : tab === 'visual-kit' ? visualKit : connections
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  function updateBrand(key: keyof BrandSettings, value: string) {
    setBrand(prev => ({ ...prev, [key]: value }))
  }

  function updateVisualKit(key: keyof VisualKitSettings, value: string) {
    setVisualKit(prev => ({ ...prev, [key]: value }))
  }

  function updateConnections(key: keyof ConnectionSettings, value: string) {
    setConnections(prev => ({ ...prev, [key]: value }))
  }

  async function analyzeFromWebsite() {
    if (!websiteUrl) return
    setAnalyzing(true)
    setAnalyzeMsg('')
    try {
      const res = await fetch('/api/settings/analyze-brand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: websiteUrl }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setBrand(prev => ({ ...prev, ...data.brand }))
      setAnalyzeMsg('Brand context filled in! Review and save.')
    } catch (e) {
      setAnalyzeMsg(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setAnalyzing(false)
    }
  }

  if (loading) return <div className="text-sm text-zinc-400 p-8">Loading…</div>

  return (
    <div className="space-y-6 max-w-2xl">

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center">
            <Settings className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900">Settings</h1>
        </div>
        <p className="text-sm text-zinc-500">Configure your brand context and platform connections.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-zinc-100 p-1 rounded-xl w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => { setTab(id as typeof tab); setSaved(false) }}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              tab === id ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Brand Tab ── */}
      {tab === 'brand' && (
        <div className="space-y-5">

          {/* Business Identity */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-zinc-500" />
                <CardTitle className="text-base">Business Identity</CardTitle>
              </div>
              <CardDescription>Core facts about your brand — name, handle, what you sell, where. Leave blank to use CADA defaults.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Brand Name"
                  placeholder="e.g. CADA"
                  value={brand.brand_name}
                  onChange={v => updateBrand('brand_name', v)}
                  rows={1}
                />
                <Field
                  label="Handle / Username"
                  placeholder="e.g. wear_cada"
                  value={brand.brand_handle}
                  onChange={v => updateBrand('brand_handle', v)}
                  rows={1}
                />
              </div>
              <Field
                label="Brand Description"
                placeholder="e.g. An Indonesian modest fashion brand selling elegant, covered womenswear for Muslim women."
                value={brand.brand_description}
                onChange={v => updateBrand('brand_description', v)}
                rows={3}
              />
              <Field
                label="Products"
                description="One product per line: Name | Price | Notes"
                placeholder={"Pleated Linen Pants | Rp 350,000 | Wide-leg, high-waist, navy\nDenim Maxi Skirt | Rp 385,000 | Full coverage, A-line, dark wash"}
                value={brand.brand_products_list}
                onChange={v => updateBrand('brand_products_list', v)}
                rows={4}
              />
              <div className="grid grid-cols-1 gap-3">
                <Field
                  label="Price Point"
                  placeholder="e.g. affordable-mid (Rp 280,000 – Rp 400,000 / SGD 25–35)"
                  value={brand.brand_price_point}
                  onChange={v => updateBrand('brand_price_point', v)}
                  rows={1}
                />
                <Field
                  label="Markets"
                  placeholder="e.g. Indonesia, Singapore"
                  value={brand.brand_markets}
                  onChange={v => updateBrand('brand_markets', v)}
                  rows={1}
                />
                <Field
                  label="Sales Channels"
                  placeholder="e.g. Shopee, TikTok Shop, Instagram"
                  value={brand.brand_channels}
                  onChange={v => updateBrand('brand_channels', v)}
                  rows={1}
                />
              </div>
            </CardContent>
          </Card>

          {/* Content Defaults */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-500" />
                <CardTitle className="text-base">Content Defaults</CardTitle>
              </div>
              <CardDescription>Defaults used in every generation. Leave blank to let the AI decide.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field
                label="Subject Description"
                description="Who appears in your images and videos. Leave blank for product-only shots."
                placeholder="e.g. Muslim woman wearing hijab  — or leave blank for product/flat-lay shots"
                value={brand.brand_subject_description}
                onChange={v => updateBrand('brand_subject_description', v)}
                rows={2}
              />
              <Field
                label="Default Hashtags"
                description="Added to every caption. Use your brand hashtags here."
                placeholder="e.g. #CADA #wearcada #modestfashion #hijabfashion #ootdmodest"
                value={brand.brand_hashtags}
                onChange={v => updateBrand('brand_hashtags', v)}
                rows={2}
              />
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="E-commerce Platform"
                  description="Used in product descriptions and email CTAs."
                  placeholder="e.g. Shopee"
                  value={brand.brand_ecommerce_platform}
                  onChange={v => updateBrand('brand_ecommerce_platform', v)}
                  rows={1}
                />
                <Field
                  label="Industry / Niche"
                  description="Used in trend research and analysis."
                  placeholder="e.g. modest fashion"
                  value={brand.brand_industry}
                  onChange={v => updateBrand('brand_industry', v)}
                  rows={1}
                />
              </div>
            </CardContent>
          </Card>

          {/* Website analyzer */}
          <Card className="border-violet-100 bg-violet-50/40">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Link className="w-4 h-4 text-violet-500" />
                <CardTitle className="text-base">Auto-fill from Website</CardTitle>
              </div>
              <CardDescription>Paste your website URL and Claude will analyze it to fill in your brand context automatically.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="url"
                  value={websiteUrl}
                  onChange={e => setWebsiteUrl(e.target.value)}
                  placeholder="https://wearcada.com"
                  className="flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
                <button
                  onClick={analyzeFromWebsite}
                  disabled={!websiteUrl || analyzing}
                  className="flex items-center gap-2 px-4 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {analyzing ? 'Analyzing…' : 'Analyze'}
                </button>
              </div>
              {analyzeMsg && (
                <p className={`text-xs ${analyzeMsg.includes('!') ? 'text-emerald-600' : 'text-red-500'}`}>
                  {analyzeMsg}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-500" />
                <CardTitle className="text-base">Brand Voice & Tone</CardTitle>
              </div>
              <CardDescription>How your brand sounds — personality, language style, words to use or avoid.</CardDescription>
            </CardHeader>
            <CardContent>
              <Field
                label="Voice & Tone"
                placeholder="e.g. Warm, elegant, aspirational — never preachy. Mix of English and Bahasa Indonesia is fine. Never use: revealing, sexy. Always use: modest, covered, effortless..."
                value={brand.brand_voice}
                onChange={v => updateBrand('brand_voice', v)}
                rows={5}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-500" />
                <CardTitle className="text-base">Target Customer</CardTitle>
              </div>
              <CardDescription>Who you're speaking to — helps Claude write for the right person.</CardDescription>
            </CardHeader>
            <CardContent>
              <Field
                label="Customer Profile"
                placeholder="e.g. Muslim women aged 20–35 in Indonesia and Singapore. Working professionals who want to look polished while being covered. Values quality and modesty without sacrificing style."
                value={brand.brand_target_customer}
                onChange={v => updateBrand('brand_target_customer', v)}
                rows={3}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-500" />
                <CardTitle className="text-base">Content Guidelines</CardTitle>
              </div>
              <CardDescription>Rules for all content — coverage, hashtags, platform tone, pricing format.</CardDescription>
            </CardHeader>
            <CardContent>
              <Field
                label="Guidelines"
                placeholder="e.g. All clothing must be fully covered. Always show price in Rp. Hashtags: #CADA #wearcada #modestfashion. Instagram = editorial, TikTok = conversational..."
                value={brand.brand_guidelines}
                onChange={v => updateBrand('brand_guidelines', v)}
                rows={5}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-pink-500" />
                <CardTitle className="text-base">Caption Style Examples</CardTitle>
              </div>
              <CardDescription>Paste 1–3 captions you love. Claude will match this voice and style.</CardDescription>
            </CardHeader>
            <CardContent>
              <Field
                label="Example Captions"
                placeholder="Paste example captions here — Claude will study the rhythm, tone, and structure and write in the same style..."
                value={brand.brand_caption_examples}
                onChange={v => updateBrand('brand_caption_examples', v)}
                rows={6}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-500" />
                <CardTitle className="text-base">Current Campaign Theme <span className="text-zinc-400 font-normal text-sm">(optional)</span></CardTitle>
              </div>
              <CardDescription>A temporary focus for this week or month. Clears when the campaign ends.</CardDescription>
            </CardHeader>
            <CardContent>
              <Field
                label="Campaign Theme"
                placeholder="e.g. This week: back-to-office looks. Focus on workwear styling, professional settings, confidence at work..."
                value={brand.brand_campaign_theme}
                onChange={v => updateBrand('brand_campaign_theme', v)}
                rows={3}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-zinc-500" />
                <CardTitle className="text-base">AI Image Quality</CardTitle>
              </div>
              <CardDescription>Higher quality = better images but higher cost per generation.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                {([
                  { value: 'low',    label: 'Low',    cost: '~$0.01' },
                  { value: 'medium', label: 'Medium', cost: '~$0.04' },
                  { value: 'high',   label: 'High',   cost: '~$0.17' },
                ] as const).map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => updateBrand('image_quality', opt.value)}
                    className={cn(
                      'flex-1 rounded-xl border py-2.5 text-xs font-medium transition-all',
                      brand.image_quality === opt.value
                        ? 'border-zinc-900 bg-zinc-900 text-white'
                        : 'border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300'
                    )}
                  >
                    <div>{opt.label}</div>
                    <div className={cn('text-[10px] mt-0.5', brand.image_quality === opt.value ? 'text-zinc-300' : 'text-zinc-400')}>{opt.cost}</div>
                  </button>
                ))}
              </div>
              <p className="text-xs text-zinc-400">
                {brand.image_quality === 'low' && 'Good for quick drafts and ideation.'}
                {brand.image_quality === 'medium' && 'Recommended — great quality for social media at a fraction of the cost.'}
                {brand.image_quality === 'high' && 'Best quality for final posts and campaigns.'}
              </p>
            </CardContent>
          </Card>

          <SaveBar onSave={handleSave} saving={saving} saved={saved} />
        </div>
      )}

      {/* ── Visual Kit Tab ── */}
      {tab === 'visual-kit' && (
        <div className="space-y-5">

          {/* Auto-fill from photos */}
          <Card className="border-violet-100 bg-violet-50/40">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-500" />
                <CardTitle className="text-base">Auto-fill from Your Photos</CardTitle>
              </div>
              <CardDescription>Upload 5–20 of your best CADA product photos. Claude will analyze them all together and automatically fill in your style settings below.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <PhotoAnalyzer onResult={(r) => {
                updateVisualKit('brand_style_prefix', r.style_prefix)
                updateVisualKit('brand_color_description', r.color_description)
                updateVisualKit('brand_shot_style', r.shot_style)
                updateVisualKit('brand_negative_prompts', r.negative_prompts)
              }} />
            </CardContent>
          </Card>

          {/* Reference images */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Image className="w-4 h-4 text-violet-500" />
                <CardTitle className="text-base">Reference Images</CardTitle>
              </div>
              <CardDescription>Upload once — used automatically as visual references in every image generation.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <ImageUploadField
                label="Style Reference"
                description="Your hero image — defines the overall CADA aesthetic."
                settingKey="brand_style_reference_url"
                value={visualKit.brand_style_reference_url}
                onChange={v => updateVisualKit('brand_style_reference_url', v)}
              />
              <ImageUploadField
                label="Color Swatch"
                description="A color palette image with your brand colors."
                settingKey="brand_color_swatch_url"
                value={visualKit.brand_color_swatch_url}
                onChange={v => updateVisualKit('brand_color_swatch_url', v)}
              />
              <ImageUploadField
                label="Model Reference"
                description="Consistent model look — face, hijab style, body type."
                settingKey="brand_model_reference_url"
                value={visualKit.brand_model_reference_url}
                onChange={v => updateVisualKit('brand_model_reference_url', v)}
              />
              <ImageUploadField
                label="Logo"
                description="Your brand logo (PNG with transparent background preferred)."
                settingKey="brand_logo_url"
                value={visualKit.brand_logo_url}
                onChange={v => updateVisualKit('brand_logo_url', v)}
              />
            </CardContent>
          </Card>

          {/* Color palette */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-pink-500" />
                <CardTitle className="text-base">Brand Color Palette</CardTitle>
              </div>
              <CardDescription>Pick your exact brand colors. These are converted to descriptive language and injected into every image prompt.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ColorPaletteEditor
                value={visualKit.brand_colors}
                onChange={v => updateVisualKit('brand_colors', v)}
              />
              <Field
                label="Color Description (auto-filled or edit manually)"
                description="How your colors are described to the AI. Auto-filled from photos or edit yourself."
                placeholder="e.g. Warm cream, muted terracotta, sage green, soft dusty rose, earth tones — no neon or saturated colors"
                value={visualKit.brand_color_description}
                onChange={v => updateVisualKit('brand_color_description', v)}
                rows={2}
              />
            </CardContent>
          </Card>

          {/* Prompt fields */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-500" />
                <CardTitle className="text-base">Style Prompt Settings</CardTitle>
              </div>
              <CardDescription>These are prepended to every image prompt automatically.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field
                label="Style Prefix"
                description="Photography style, lighting, and mood — injected at the start of every image prompt."
                placeholder="e.g. Soft natural daylight, warm editorial lighting, modest fashion photography, clean minimalist background, professional brand photography"
                value={visualKit.brand_style_prefix}
                onChange={v => updateVisualKit('brand_style_prefix', v)}
                rows={3}
              />
              <Field
                label="Shot Style"
                description="Camera angle, focal length, framing — keeps every image technically consistent."
                placeholder="e.g. Eye-level, front-lit, 35mm lens, full-length or three-quarter shot, shallow depth of field, 8k resolution, commercial photography"
                value={visualKit.brand_shot_style}
                onChange={v => updateVisualKit('brand_shot_style', v)}
                rows={2}
              />
              <Field
                label="Negative Prompts"
                description="What to exclude from every generation — keeps images clean and on-brand."
                placeholder="e.g. no text, no logos, no revealing clothing, no dark shadows, no blurry background, no cartoon, no illustration, no low quality"
                value={visualKit.brand_negative_prompts}
                onChange={v => updateVisualKit('brand_negative_prompts', v)}
                rows={2}
              />
            </CardContent>
          </Card>

          <SaveBar onSave={handleSave} saving={saving} saved={saved} />
        </div>
      )}

      {/* ── Connections Tab ── */}
      {tab === 'connections' && (
        <div className="space-y-5">

          {/* Instagram */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold">
                  IG
                </div>
                <div>
                  <CardTitle className="text-base">Instagram</CardTitle>
                  <CardDescription className="mt-0.5">Connect via Meta to publish posts and read performance data.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">

              {/* OAuth status banners */}
              {instagramStatus === 'success' && (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 flex items-center gap-2 text-sm text-emerald-700">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  Instagram connected! Your page and business account have been saved.
                </div>
              )}
              {instagramStatus === 'error' && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  Instagram connection failed or was denied. Please try again.
                </div>
              )}

              {/* Connect button */}
              {connections.instagram_user_token ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-emerald-700">Instagram connected</p>
                        {connections.instagram_username && (
                          <p className="text-xs text-emerald-600">@{connections.instagram_username}</p>
                        )}
                      </div>
                    </div>
                    <a href="/api/auth/instagram" className="text-xs text-zinc-500 underline hover:text-zinc-700">
                      Reconnect
                    </a>
                  </div>
                  <Field
                    label="Business Account ID"
                    description="Find it at business.facebook.com → Settings → Instagram accounts → @wear_cada"
                    placeholder="17841400000000000"
                    value={connections.instagram_business_account_id}
                    onChange={v => updateConnections('instagram_business_account_id', v)}
                    rows={1}
                    lockable
                  />
                </div>
              ) : (
                <a
                  href="/api/auth/instagram"
                  className="flex items-center justify-center gap-2 w-full rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 text-white text-sm font-semibold py-2.5 hover:opacity-90 transition-opacity"
                >
                  <div className="w-4 h-4 rounded-sm bg-white/20 flex items-center justify-center text-[10px] font-bold">IG</div>
                  Connect with Instagram
                </a>
              )}
            </CardContent>
          </Card>

          {/* TikTok */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-zinc-900 flex items-center justify-center text-white text-xs font-bold">
                  TT
                </div>
                <div>
                  <CardTitle className="text-base">TikTok</CardTitle>
                  <CardDescription className="mt-0.5">Connect via TikTok Content Posting API to publish videos and read analytics.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">

              {/* OAuth status banners */}
              {tiktokStatus === 'success' && (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 flex items-center gap-2 text-sm text-emerald-700">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  TikTok connected successfully! Your access token has been saved.
                </div>
              )}
              {tiktokStatus === 'error' && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  TikTok connection failed or was denied. Please try again.
                </div>
              )}


              {/* Post mode toggle */}
              <div className="border-t border-zinc-100 pt-4 space-y-2">
                <p className="text-xs font-semibold text-zinc-700">Post Mode</p>
                <div className="flex gap-2">
                  {(['draft', 'direct'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => updateConnections('tiktok_post_mode', mode)}
                      className={cn(
                        'flex-1 rounded-xl border py-2.5 text-xs font-medium transition-all',
                        connections.tiktok_post_mode === mode
                          ? 'border-zinc-900 bg-zinc-900 text-white'
                          : 'border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300'
                      )}
                    >
                      {mode === 'draft' ? 'Draft to Inbox' : 'Direct Post'}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-zinc-400">
                  {connections.tiktok_post_mode === 'draft'
                    ? 'Video goes to TikTok drafts — you review and publish manually.'
                    : 'Video posts directly to TikTok. Requires app approval from TikTok.'}
                </p>
              </div>

              {/* Connect button — at bottom */}
              <div className="border-t border-zinc-100 pt-4">
                {connections.tiktok_access_token ? (
                  <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-emerald-700">TikTok connected</p>
                        {connections.tiktok_username && (
                          <p className="text-xs text-emerald-600">@{connections.tiktok_username}</p>
                        )}
                      </div>
                    </div>
                    <a href="/api/auth/tiktok" className="text-xs text-zinc-500 underline hover:text-zinc-700">
                      Reconnect
                    </a>
                  </div>
                ) : (
                  <a
                    href="/api/auth/tiktok"
                    className="flex items-center justify-center gap-2 w-full rounded-xl bg-zinc-900 text-white text-sm font-semibold py-2.5 hover:bg-zinc-700 transition-colors"
                  >
                    <div className="w-4 h-4 rounded-sm bg-white/20 flex items-center justify-center text-[10px] font-bold">TT</div>
                    Connect with TikTok
                  </a>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Google Drive */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center text-white text-xs font-bold">G</div>
                <div>
                  <CardTitle className="text-base">Google Drive — Media Storage</CardTitle>
                  <CardDescription className="mt-0.5">Auto-upload generated images and videos to Drive for permanent storage.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                {(['false', 'true'] as const).map(val => (
                  <button key={val}
                    onClick={() => updateConnections('drive_media_upload_enabled', val)}
                    className={cn(
                      'flex-1 rounded-xl border py-2.5 text-xs font-medium transition-all',
                      connections.drive_media_upload_enabled === val
                        ? 'border-zinc-900 bg-zinc-900 text-white'
                        : 'border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300'
                    )}>
                    {val === 'true' ? 'Enabled' : 'Disabled'}
                  </button>
                ))}
              </div>
              {connections.drive_media_upload_enabled === 'true' && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-zinc-700">Folder ID</label>
                  <p className="text-xs text-zinc-400">Open your Drive folder → copy the ID from the URL: drive.google.com/drive/folders/<strong>THIS_PART</strong></p>
                  <input
                    type="text"
                    value={connections.drive_media_folder_id}
                    onChange={e => updateConnections('drive_media_folder_id', e.target.value)}
                    placeholder="e.g. 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs"
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-800 placeholder-zinc-400 font-mono focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <SaveBar onSave={handleSave} saving={saving} saved={saved} />
        </div>
      )}
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="text-sm text-zinc-400 p-8">Loading…</div>}>
      <SettingsContent />
    </Suspense>
  )
}
