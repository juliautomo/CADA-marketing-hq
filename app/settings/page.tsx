'use client'

import { useState, useEffect } from 'react'
import { Settings, Save, CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface BrandSettings {
  brand_voice: string
  brand_guidelines: string
  brand_target_customer: string
  brand_campaign_theme: string
  brand_caption_examples: string
}

const DEFAULTS: BrandSettings = {
  brand_voice: '',
  brand_guidelines: '',
  brand_target_customer: '',
  brand_campaign_theme: '',
  brand_caption_examples: '',
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<BrandSettings>(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/settings/brand')
      .then(r => r.json())
      .then(data => { setSettings({ ...DEFAULTS, ...data }); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    await fetch('/api/settings/brand', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  function update(key: keyof BrandSettings, value: string) {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  if (loading) return <div className="text-sm text-zinc-400 p-8">Loading…</div>

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center">
            <Settings className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900">Brand Settings</h1>
        </div>
        <p className="text-sm text-zinc-500">These settings shape every caption and piece of content Claude generates for CADA.</p>
      </div>

      {/* Voice & Tone */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Brand Voice & Tone</CardTitle>
          <CardDescription>How CADA sounds — personality, language style, words to use or avoid.</CardDescription>
        </CardHeader>
        <CardContent>
          <textarea
            rows={5}
            value={settings.brand_voice}
            onChange={e => update('brand_voice', e.target.value)}
            placeholder="e.g. Warm, elegant, and aspirational — never preachy. Mix of English and Bahasa Indonesia is fine. Never use: revealing, sexy. Always use: modest, covered, effortless..."
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-800 placeholder-zinc-400 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
          />
        </CardContent>
      </Card>

      {/* Target Customer */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Target Customer</CardTitle>
          <CardDescription>Who you're speaking to — helps Claude write for the right person.</CardDescription>
        </CardHeader>
        <CardContent>
          <textarea
            rows={3}
            value={settings.brand_target_customer}
            onChange={e => update('brand_target_customer', e.target.value)}
            placeholder="e.g. Muslim women aged 20–35 in Indonesia and Singapore. Working professionals who want to look polished while being covered. Values quality and modesty without sacrificing style."
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-800 placeholder-zinc-400 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
          />
        </CardContent>
      </Card>

      {/* Content Guidelines */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Content Guidelines</CardTitle>
          <CardDescription>Rules for all content — coverage, hashtags, platform tone, pricing format.</CardDescription>
        </CardHeader>
        <CardContent>
          <textarea
            rows={5}
            value={settings.brand_guidelines}
            onChange={e => update('brand_guidelines', e.target.value)}
            placeholder="e.g. All clothing must be fully covered. Always show price in Rp. Hashtags: #CADA #wearcada #modestfashion. Instagram = editorial, TikTok = conversational..."
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-800 placeholder-zinc-400 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
          />
        </CardContent>
      </Card>

      {/* Caption Examples */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Caption Style Examples</CardTitle>
          <CardDescription>Paste 1–3 captions you love. Claude will match this voice and style.</CardDescription>
        </CardHeader>
        <CardContent>
          <textarea
            rows={6}
            value={settings.brand_caption_examples}
            onChange={e => update('brand_caption_examples', e.target.value)}
            placeholder="Paste example captions here — Claude will study the rhythm, tone, and structure and write in the same style..."
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-800 placeholder-zinc-400 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
          />
        </CardContent>
      </Card>

      {/* Campaign Theme */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Current Campaign Theme <span className="text-zinc-400 font-normal text-sm">(optional)</span></CardTitle>
          <CardDescription>A temporary focus for this week or month — overrides the default direction.</CardDescription>
        </CardHeader>
        <CardContent>
          <textarea
            rows={3}
            value={settings.brand_campaign_theme}
            onChange={e => update('brand_campaign_theme', e.target.value)}
            placeholder="e.g. This week: back-to-office looks. Focus on workwear styling, professional settings, confidence at work..."
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-800 placeholder-zinc-400 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
          />
        </CardContent>
      </Card>

      {/* Save */}
      <Button onClick={handleSave} loading={saving} className="w-full" size="lg">
        {saved
          ? <><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Saved!</>
          : <><Save className="w-4 h-4" /> Save Brand Settings</>
        }
      </Button>
    </div>
  )
}
