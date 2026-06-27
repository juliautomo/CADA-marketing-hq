'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Settings, Save, CheckCircle2, Globe,
  Palette, Users, FileText, Sparkles, Calendar, Eye, EyeOff,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────────────────

interface BrandSettings {
  brand_voice: string
  brand_guidelines: string
  brand_target_customer: string
  brand_campaign_theme: string
  brand_caption_examples: string
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
}

const BRAND_DEFAULTS: BrandSettings = {
  brand_voice: '',
  brand_guidelines: '',
  brand_target_customer: '',
  brand_campaign_theme: '',
  brand_caption_examples: '',
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
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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
  { id: 'connections', label: 'Connections',  icon: Globe },
]

// ── Page ─────────────────────────────────────────────────────────────────────

function SettingsContent() {
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<'brand' | 'connections'>(
    searchParams.get('tab') === 'connections' ? 'connections' : 'brand'
  )
  const [brand, setBrand] = useState<BrandSettings>(BRAND_DEFAULTS)
  const [connections, setConnections] = useState<ConnectionSettings>(CONNECTION_DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
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
      setConnections({ ...CONNECTION_DEFAULTS, ...c })
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    const endpoint = tab === 'brand' ? '/api/settings/brand' : '/api/settings/connections'
    const body = tab === 'brand' ? brand : connections
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

  function updateConnections(key: keyof ConnectionSettings, value: string) {
    setConnections(prev => ({ ...prev, [key]: value }))
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
                    <div className="flex items-center gap-2 text-sm text-emerald-700">
                      <CheckCircle2 className="w-4 h-4" />
                      {connections.instagram_username ? `@${connections.instagram_username}` : 'Instagram connected'}
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
                    <div className="flex items-center gap-2 text-sm text-emerald-700">
                      <CheckCircle2 className="w-4 h-4" />
                      TikTok account connected
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
