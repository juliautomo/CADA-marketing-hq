'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Package, Plus, Pencil, Trash2, X, Check,
  ExternalLink, Tag, Layers,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Product } from '@/types'

const CATEGORIES = ['Tops', 'Bottoms', 'Dresses', 'Abayas', 'Sets', 'Outerwear', 'Accessories']
const SEASONS    = ['Evergreen', 'Raya / Eid', 'Year-End', 'Back-to-School', 'Summer', 'Limited Edition']
const COLOR_PRESETS = ['Black', 'White', 'Cream', 'Beige', 'Sage', 'Dusty Rose', 'Navy', 'Brown', 'Grey', 'Olive', 'Maroon', 'Lilac']

const EMPTY: Omit<Product, 'id' | 'created_at' | 'updated_at'> = {
  name: '', category: 'Tops', price: '', colors: [],
  fabric: '', season: 'Evergreen', description: '',
  shopee_url: '', image_url: '', active: true,
}

export default function ProductsPage() {
  const [products, setProducts]     = useState<Product[]>([])
  const [loading, setLoading]       = useState(true)
  const [showForm, setShowForm]     = useState(false)
  const [editing, setEditing]       = useState<Product | null>(null)
  const [form, setForm]             = useState({ ...EMPTY })
  const [saving, setSaving]         = useState(false)
  const [deleting, setDeleting]     = useState<string | null>(null)
  const [colorInput, setColorInput] = useState('')
  const [filter, setFilter]         = useState<string>('All')

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/products')
      const data = await res.json()
      setProducts(data.products ?? [])
    } catch { /* silently fail */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchProducts() }, [fetchProducts])

  function openNew() {
    setEditing(null)
    setForm({ ...EMPTY })
    setColorInput('')
    setShowForm(true)
  }

  function openEdit(p: Product) {
    setEditing(p)
    setForm({
      name: p.name, category: p.category, price: p.price ?? '',
      colors: p.colors ?? [], fabric: p.fabric ?? '',
      season: p.season, description: p.description ?? '',
      shopee_url: p.shopee_url ?? '', image_url: p.image_url ?? '',
      active: p.active,
    })
    setColorInput('')
    setShowForm(true)
  }

  function closeForm() { setShowForm(false); setEditing(null) }

  function addColor(c: string) {
    const trimmed = c.trim()
    if (!trimmed || form.colors.includes(trimmed)) return
    setForm(f => ({ ...f, colors: [...f.colors, trimmed] }))
    setColorInput('')
  }

  function removeColor(c: string) {
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

  const categories = ['All', ...CATEGORIES]
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
          <Button onClick={openNew} className="flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Product
          </Button>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        {categories.map(cat => (
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Card className={cn('h-full hover:shadow-sm transition-shadow', !p.active && 'opacity-50')}>
                {p.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image_url} alt={p.name} className="w-full aspect-square object-cover rounded-t-2xl" />
                )}
                <CardContent className="pt-4 pb-4 space-y-3">
                  {/* Name + category */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-zinc-900 leading-tight">{p.name}</p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <Badge variant="default">{p.category}</Badge>
                        <Badge variant={p.season === 'Evergreen' ? 'success' : 'info'}>{p.season}</Badge>
                        {!p.active && <Badge variant="error">Inactive</Badge>}
                      </div>
                    </div>
                    {p.price && (
                      <p className="text-sm font-bold text-zinc-900 whitespace-nowrap">{p.price}</p>
                    )}
                  </div>

                  {/* Colors */}
                  {p.colors.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {p.colors.map(c => (
                        <span key={c} className="text-xs bg-zinc-50 border border-zinc-200 px-2 py-0.5 rounded-full text-zinc-600">{c}</span>
                      ))}
                    </div>
                  )}

                  {/* Fabric */}
                  {p.fabric && (
                    <p className="text-xs text-zinc-500 flex items-center gap-1">
                      <Layers className="w-3 h-3" /> {p.fabric}
                    </p>
                  )}

                  {/* Description */}
                  {p.description && (
                    <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed">{p.description}</p>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-1">
                    <button onClick={() => openEdit(p)}
                      className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 transition-colors">
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                    <button onClick={() => toggleActive(p)}
                      className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 transition-colors">
                      <Tag className="w-3 h-3" /> {p.active ? 'Deactivate' : 'Activate'}
                    </button>
                    {p.shopee_url && (
                      <a href={p.shopee_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-orange-500 hover:underline ml-auto">
                        Shopee <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
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
              {/* Modal header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
                <h2 className="text-base font-semibold text-zinc-900">
                  {editing ? 'Edit Product' : 'Add Product'}
                </h2>
                <button onClick={closeForm} className="text-zinc-400 hover:text-zinc-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal body */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

                {/* Name */}
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1.5">Product Name *</label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Linen Wide-Leg Pants" />
                </div>

                {/* Category + Season */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 mb-1.5">Category *</label>
                    <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900">
                      {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 mb-1.5">Season</label>
                    <select value={form.season} onChange={e => setForm(f => ({ ...f, season: e.target.value }))}
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900">
                      {SEASONS.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                {/* Price + Fabric */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 mb-1.5">Price</label>
                    <Input value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                      placeholder="e.g. RM 189 / IDR 350k" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 mb-1.5">Fabric</label>
                    <Input value={form.fabric} onChange={e => setForm(f => ({ ...f, fabric: e.target.value }))}
                      placeholder="e.g. 100% linen" />
                  </div>
                </div>

                {/* Colors */}
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1.5">Available Colours</label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {COLOR_PRESETS.map(c => (
                      <button key={c} onClick={() => addColor(c)}
                        className={cn('px-2.5 py-1 rounded-full text-xs border transition-colors',
                          form.colors.includes(c)
                            ? 'bg-zinc-900 text-white border-zinc-900'
                            : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'
                        )}>
                        {form.colors.includes(c) ? <><Check className="w-2.5 h-2.5 inline mr-0.5" />{c}</> : c}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input value={colorInput} onChange={e => setColorInput(e.target.value)}
                      placeholder="Add custom colour…" className="text-xs"
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addColor(colorInput) } }} />
                    <Button size="sm" variant="secondary" onClick={() => addColor(colorInput)}>Add</Button>
                  </div>
                  {form.colors.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {form.colors.map(c => (
                        <span key={c} className="inline-flex items-center gap-1 text-xs bg-violet-50 border border-violet-200 text-violet-700 px-2 py-0.5 rounded-full">
                          {c}
                          <button onClick={() => removeColor(c)}><X className="w-2.5 h-2.5" /></button>
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
                    placeholder="Brief product description — fabric feel, who it's for, how to style it…" rows={3} />
                </div>

                {/* URLs */}
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1.5">Shopee URL <span className="text-zinc-400 font-normal">(optional)</span></label>
                  <Input value={form.shopee_url} onChange={e => setForm(f => ({ ...f, shopee_url: e.target.value }))}
                    placeholder="https://shopee.com.my/…" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1.5">Product Image URL <span className="text-zinc-400 font-normal">(optional)</span></label>
                  <Input value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))}
                    placeholder="https://…" />
                </div>

                {/* Active toggle */}
                <div className="flex items-center gap-3">
                  <button onClick={() => setForm(f => ({ ...f, active: !f.active }))}
                    className={cn('w-10 h-6 rounded-full transition-colors relative',
                      form.active ? 'bg-emerald-500' : 'bg-zinc-300'
                    )}>
                    <span className={cn('absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform',
                      form.active ? 'translate-x-5' : 'translate-x-1'
                    )} />
                  </button>
                  <label className="text-sm text-zinc-700">{form.active ? 'Active — shown to agents' : 'Inactive — hidden from agents'}</label>
                </div>
              </div>

              {/* Modal footer */}
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
