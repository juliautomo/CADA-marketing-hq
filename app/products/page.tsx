'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Package, Plus, Pencil, Trash2, X, Check,
  ExternalLink, Tag, Layers, Upload, Settings2,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Product } from '@/types'

const DEFAULT_CATEGORIES = ['General']
const DEFAULT_TAGS = ['Regular', 'Limited Edition']
const DEFAULT_LABELS = { fabric: 'Details', colors: 'Variants', season: 'Type' }

const EMPTY = {
  name: '', category: '', price: '', colors: [] as string[],
  fabric: '', season: '', description: '',
  shopee_url: '', tiktok_url: '', image_url: '', active: true,
}

interface CatalogConfig {
  categories: string[]
  tags: string[]
  labels: { fabric: string; colors: string; season: string }
}

export default function ProductsPage() {
  const [products, setProducts]     = useState<Product[]>([])
  const [loading, setLoading]       = useState(true)
  const [showForm, setShowForm]     = useState(false)
  const [editing, setEditing]       = useState<Product | null>(null)
  const [form, setForm]             = useState({ ...EMPTY })
  const [saving, setSaving]         = useState(false)
  const [deleting, setDeleting]     = useState<string | null>(null)
  const [tagInput, setTagInput]     = useState('')
  const [filter, setFilter]         = useState<string>('All')
  const [uploading, setUploading]   = useState(false)
  const fileInputRef                = useRef<HTMLInputElement>(null)

  const [config, setConfig] = useState<CatalogConfig>({
    categories: DEFAULT_CATEGORIES,
    tags: DEFAULT_TAGS,
    labels: DEFAULT_LABELS,
  })
  const [showCatalogSettings, setShowCatalogSettings] = useState(false)
  const [configDraft, setConfigDraft] = useState<CatalogConfig>(config)
  const [configSaving, setConfigSaving] = useState(false)
  const [newCat, setNewCat] = useState('')
  const [newTag, setNewTag] = useState('')

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/products')
      const data = await res.json()
      setProducts(data.products ?? [])
    } catch { /* silently fail */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    fetchProducts()
    fetch('/api/settings/brand')
      .then(r => r.json())
      .then(d => {
        const raw = d.settings ?? {}
        if (raw.product_catalog_config) {
          try {
            const parsed = JSON.parse(raw.product_catalog_config)
            setConfig(parsed)
            setConfigDraft(parsed)
          } catch { /* use defaults */ }
        }
      })
      .catch(() => {})
  }, [fetchProducts])

  async function saveConfig(next: CatalogConfig) {
    setConfigSaving(true)
    try {
      await fetch('/api/settings/brand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_catalog_config: JSON.stringify(next) }),
      })
      setConfig(next)
      setShowCatalogSettings(false)
    } catch { /* silently fail */ }
    finally { setConfigSaving(false) }
  }

  function openNew() {
    setEditing(null)
    setForm({ ...EMPTY, category: config.categories[0] ?? '', season: config.tags[0] ?? '' })
    setTagInput('')
    setShowForm(true)
  }

  function openEdit(p: Product) {
    setEditing(p)
    setForm({
      name: p.name, category: p.category, price: p.price ?? '',
      colors: p.colors ?? [], fabric: p.fabric ?? '',
      season: p.season, description: p.description ?? '',
      shopee_url: p.shopee_url ?? '', tiktok_url: p.tiktok_url ?? '',
      image_url: p.image_url ?? '', active: p.active,
    })
    setTagInput('')
    setShowForm(true)
  }

  function closeForm() { setShowForm(false); setEditing(null) }

  async function handleImageUpload(file: File) {
    setUploading(true)
    try {
      const ext  = file.name.split('.').pop()
      const path = `${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('product-images').upload(path, file, { upsert: true })
      if (error) throw error
      const { data } = supabase.storage.from('product-images').getPublicUrl(path)
      setForm(f => ({ ...f, image_url: data.publicUrl }))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  function addTag(c: string) {
    const trimmed = c.trim()
    if (!trimmed || form.colors.includes(trimmed)) return
    setForm(f => ({ ...f, colors: [...f.colors, trimmed] }))
    setTagInput('')
  }

  function removeTag(c: string) {
    setForm(f => ({ ...f, colors: f.colors.filter(x => x !== c) }))
  }

  async function handleSave() {
    if (!form.name || !form.category) return
    setSaving(true)
    try {
      const method = editing ? 'PUT' : 'POST'
      const body   = editing ? { id: editing.id, ...form } : form
      await fetch('/api/products', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      await fetchProducts()
      closeForm()
    } catch { /* silently fail */ }
    finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    try {
      await fetch('/api/products', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      await fetchProducts()
    } catch { /* silently fail */ }
    finally { setDeleting(null) }
  }

  async function toggleActive(p: Product) {
    await fetch('/api/products', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id, active: !p.active }),
    })
    fetchProducts()
  }

  const allCategories = ['All', ...config.categories]
  const filtered   = filter === 'All' ? products : products.filter(p => p.category === filter)
  const active     = products.filter(p => p.active).length

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center">
              <Package className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-zinc-900">Product Catalog</h1>
          </div>
          <p className="text-sm text-zinc-500">Your products — used as context by all AI agents</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-semibold text-zinc-900">{products.length} products</p>
            <p className="text-xs text-zinc-400">{active} active</p>
          </div>
          <button onClick={() => { setConfigDraft(config); setShowCatalogSettings(true) }}
            className="p-2 rounded-lg border border-zinc-200 text-zinc-500 hover:text-zinc-900 hover:border-zinc-400 transition-colors"
            title="Customize catalog">
            <Settings2 className="w-4 h-4" />
          </button>
          <Button onClick={openNew} className="flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Product
          </Button>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        {allCategories.map(cat => (
          <button key={cat} onClick={() => setFilter(cat)}
            className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
              filter === cat ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'
            )}>
            {cat}
            {cat !== 'All' && (
              <span className="ml-1 text-zinc-400">
                {products.filter(p => p.category === cat).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Product grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-zinc-300 border-t-zinc-700 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
          <Package className="w-10 h-10 mb-3 opacity-20" />
          <p className="text-sm font-medium">No products yet</p>
          <p className="text-xs mt-1">Click "Add Product" to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Card className={cn('h-full hover:shadow-sm transition-shadow', !p.active && 'opacity-50')}>
                {p.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image_url} alt={p.name} className="w-full h-36 object-cover rounded-t-2xl" />
                )}
                <CardContent className="pt-4 pb-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-zinc-900 leading-tight">{p.name}</p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <Badge variant="default">{p.category}</Badge>
                        {p.season && <Badge variant="info">{p.season}</Badge>}
                        {!p.active && <Badge variant="error">Inactive</Badge>}
                      </div>
                    </div>
                    {p.price && (
                      <p className="text-sm font-bold text-zinc-900 whitespace-nowrap">{p.price}</p>
                    )}
                  </div>

                  {p.colors.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {p.colors.map(c => (
                        <span key={c} className="text-xs bg-zinc-50 border border-zinc-200 px-2 py-0.5 rounded-full text-zinc-600">{c}</span>
                      ))}
                    </div>
                  )}

                  {p.fabric && (
                    <p className="text-xs text-zinc-500 flex items-center gap-1">
                      <Layers className="w-3 h-3" /> {p.fabric}
                    </p>
                  )}

                  {p.description && (
                    <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed">{p.description}</p>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <button onClick={() => openEdit(p)}
                      className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 transition-colors">
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                    <button onClick={() => toggleActive(p)}
                      className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 transition-colors">
                      <Tag className="w-3 h-3" /> {p.active ? 'Deactivate' : 'Activate'}
                    </button>
                    <div className="flex items-center gap-2 ml-auto">
                      {p.shopee_url && (
                        <a href={p.shopee_url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-orange-500 hover:underline">
                          Shopee <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      {p.tiktok_url && (
                        <a href={p.tiktok_url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-zinc-900 hover:underline">
                          TikTok <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                    <button onClick={() => handleDelete(p.id)} disabled={deleting === p.id}
                      className="ml-auto flex items-center gap-1 text-xs text-red-400 hover:text-red-600 transition-colors">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Catalog Settings modal */}
      <AnimatePresence>
        {showCatalogSettings && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40" onClick={() => setShowCatalogSettings(false)} />
            <motion.div
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }}
              className="fixed inset-x-4 top-8 bottom-8 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[480px] z-50 bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
                <h2 className="text-base font-semibold text-zinc-900">Customize Catalog</h2>
                <button onClick={() => setShowCatalogSettings(false)} className="text-zinc-400 hover:text-zinc-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

                {/* Categories */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-2">Categories</label>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {configDraft.categories.map(cat => (
                      <span key={cat} className="inline-flex items-center gap-1 text-xs bg-zinc-100 px-2.5 py-1 rounded-full text-zinc-700">
                        {cat}
                        <button onClick={() => setConfigDraft(d => ({ ...d, categories: d.categories.filter(c => c !== cat) }))}>
                          <X className="w-2.5 h-2.5 text-zinc-400 hover:text-red-500" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input value={newCat} onChange={e => setNewCat(e.target.value)}
                      placeholder="Add category…" className="text-xs"
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          const t = newCat.trim()
                          if (t && !configDraft.categories.includes(t)) {
                            setConfigDraft(d => ({ ...d, categories: [...d.categories, t] }))
                          }
                          setNewCat('')
                        }
                      }} />
                    <Button size="sm" variant="secondary" onClick={() => {
                      const t = newCat.trim()
                      if (t && !configDraft.categories.includes(t)) {
                        setConfigDraft(d => ({ ...d, categories: [...d.categories, t] }))
                      }
                      setNewCat('')
                    }}>Add</Button>
                  </div>
                </div>

                {/* Types / tags (season field) */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-2">
                    {configDraft.labels.season} options
                    <span className="text-zinc-400 font-normal ml-1">(shown as badge on each product)</span>
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {configDraft.tags.map(tag => (
                      <span key={tag} className="inline-flex items-center gap-1 text-xs bg-zinc-100 px-2.5 py-1 rounded-full text-zinc-700">
                        {tag}
                        <button onClick={() => setConfigDraft(d => ({ ...d, tags: d.tags.filter(t => t !== tag) }))}>
                          <X className="w-2.5 h-2.5 text-zinc-400 hover:text-red-500" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input value={newTag} onChange={e => setNewTag(e.target.value)}
                      placeholder="Add option…" className="text-xs"
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          const t = newTag.trim()
                          if (t && !configDraft.tags.includes(t)) {
                            setConfigDraft(d => ({ ...d, tags: [...d.tags, t] }))
                          }
                          setNewTag('')
                        }
                      }} />
                    <Button size="sm" variant="secondary" onClick={() => {
                      const t = newTag.trim()
                      if (t && !configDraft.tags.includes(t)) {
                        setConfigDraft(d => ({ ...d, tags: [...d.tags, t] }))
                      }
                      setNewTag('')
                    }}>Add</Button>
                  </div>
                </div>

                {/* Field labels */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-2">Field labels</label>
                  <div className="space-y-2">
                    {(['fabric', 'colors', 'season'] as const).map(field => (
                      <div key={field} className="flex items-center gap-3">
                        <span className="text-xs text-zinc-400 w-16 capitalize">{field}</span>
                        <Input
                          value={configDraft.labels[field]}
                          onChange={e => setConfigDraft(d => ({ ...d, labels: { ...d.labels, [field]: e.target.value } }))}
                          className="text-xs flex-1"
                          placeholder={DEFAULT_LABELS[field]}
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-zinc-400 mt-2">e.g. rename "Fabric" → "Ingredients", "Variants" → "Spice levels"</p>
                </div>

              </div>

              <div className="px-6 py-4 border-t border-zinc-100 flex gap-3">
                <Button variant="secondary" onClick={() => setShowCatalogSettings(false)} className="flex-1">Cancel</Button>
                <Button onClick={() => saveConfig(configDraft)} loading={configSaving} className="flex-1">Save</Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Add/Edit form modal */}
      <AnimatePresence>
        {showForm && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40" onClick={closeForm} />
            <motion.div
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }}
              className="fixed inset-x-4 top-8 bottom-8 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[560px] z-50 bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
                <h2 className="text-base font-semibold text-zinc-900">
                  {editing ? 'Edit Product' : 'Add Product'}
                </h2>
                <button onClick={closeForm} className="text-zinc-400 hover:text-zinc-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

                {/* Name */}
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1.5">Name *</label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Twigim Rice Bowl" />
                </div>

                {/* Category + Type */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 mb-1.5">Category *</label>
                    <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900">
                      {config.categories.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 mb-1.5">{config.labels.season}</label>
                    <select value={form.season} onChange={e => setForm(f => ({ ...f, season: e.target.value }))}
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900">
                      <option value="">—</option>
                      {config.tags.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                {/* Price + Details */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 mb-1.5">Price</label>
                    <Input value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                      placeholder="e.g. 22K / IDR 22.000" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 mb-1.5">{config.labels.fabric}</label>
                    <Input value={form.fabric} onChange={e => setForm(f => ({ ...f, fabric: e.target.value }))}
                      placeholder="e.g. oden, crabstick, dumpling" />
                  </div>
                </div>

                {/* Variants/Colors */}
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1.5">{config.labels.colors}</label>
                  <div className="flex gap-2">
                    <Input value={tagInput} onChange={e => setTagInput(e.target.value)}
                      placeholder={`Add ${config.labels.colors.toLowerCase()}…`} className="text-xs"
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput) } }} />
                    <Button size="sm" variant="secondary" onClick={() => addTag(tagInput)}>Add</Button>
                  </div>
                  {form.colors.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {form.colors.map(c => (
                        <span key={c} className="inline-flex items-center gap-1 text-xs bg-violet-50 border border-violet-200 text-violet-700 px-2 py-0.5 rounded-full">
                          {c}
                          <button onClick={() => removeTag(c)}><X className="w-2.5 h-2.5" /></button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1.5">
                    Description <span className="text-zinc-400 font-normal">(used by AI agents)</span>
                  </label>
                  <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Brief description — what it is, who it's for, what makes it special…" rows={3} />
                </div>

                {/* URLs */}
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 mb-1.5">Shopee URL <span className="text-zinc-400 font-normal">(optional)</span></label>
                    <Input value={form.shopee_url} onChange={e => setForm(f => ({ ...f, shopee_url: e.target.value }))}
                      placeholder="https://shopee.com/…" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 mb-1.5">TikTok Shop URL <span className="text-zinc-400 font-normal">(optional)</span></label>
                    <Input value={form.tiktok_url} onChange={e => setForm(f => ({ ...f, tiktok_url: e.target.value }))}
                      placeholder="https://www.tiktok.com/…" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 mb-1.5">
                      Product Image <span className="text-zinc-400 font-normal">(optional)</span>
                    </label>
                    <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f) }} />
                    {form.image_url ? (
                      <div className="relative rounded-xl overflow-hidden border border-zinc-200">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={form.image_url} alt="Product" className="w-full h-40 object-cover" />
                        <button onClick={() => setForm(f => ({ ...f, image_url: '' }))}
                          className="absolute top-2 right-2 bg-white rounded-full p-1 shadow hover:bg-red-50">
                          <X className="w-3.5 h-3.5 text-zinc-500" />
                        </button>
                      </div>
                    ) : (
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-violet-400', 'bg-violet-50') }}
                        onDragLeave={e => { e.currentTarget.classList.remove('border-violet-400', 'bg-violet-50') }}
                        onDrop={e => {
                          e.preventDefault()
                          e.currentTarget.classList.remove('border-violet-400', 'bg-violet-50')
                          const f = e.dataTransfer.files?.[0]
                          if (f) handleImageUpload(f)
                        }}
                        className="w-full rounded-xl border-2 border-dashed border-zinc-200 hover:border-violet-300 py-8 flex flex-col items-center gap-2 transition-colors cursor-pointer">
                        {uploading
                          ? <><div className="w-5 h-5 border-2 border-zinc-300 border-t-violet-500 rounded-full animate-spin" /><p className="text-xs text-zinc-400">Uploading…</p></>
                          : <><Upload className="w-5 h-5 text-zinc-300" /><p className="text-xs text-zinc-400">Click or drag &amp; drop JPG · PNG · WebP</p></>
                        }
                      </div>
                    )}
                  </div>
                </div>

                {/* Active toggle */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, active: !f.active }))}
                    className={cn(
                      'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
                      form.active ? 'bg-emerald-500' : 'bg-zinc-300'
                    )}
                  >
                    <span className={cn(
                      'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200',
                      form.active ? 'translate-x-5' : 'translate-x-0'
                    )} />
                  </button>
                  <span className="text-sm text-zinc-700">
                    {form.active ? 'Active — shown to agents' : 'Inactive — hidden from agents'}
                  </span>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-zinc-100 flex gap-3">
                <Button variant="secondary" onClick={closeForm} className="flex-1">Cancel</Button>
                <Button onClick={handleSave} loading={saving} disabled={!form.name || !form.category} className="flex-1">
                  {editing ? 'Save Changes' : 'Add Product'}
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
