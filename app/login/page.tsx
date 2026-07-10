'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Layers, Plus, X, Eye, EyeOff, ArrowRight, Check } from 'lucide-react'

interface Client {
  id: string
  name: string
  slug: string
  logo_url?: string
  created_at: string
}

function LoginPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? '/'

  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Client | null>(null)
  const [pin, setPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [error, setError] = useState('')
  const [logging, setLogging] = useState(false)

  // New client form
  const [showForm, setShowForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newSlug, setNewSlug] = useState('')
  const [newPin, setNewPin] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  useEffect(() => {
    fetch('/api/clients')
      .then(r => r.json())
      .then(d => {
        setClients(d.clients ?? [])
        setLoading(false)
        if (d.clients?.length === 0) setShowForm(true)
      })
  }, [])

  // Auto-generate slug from name
  useEffect(() => {
    setNewSlug(newName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
  }, [newName])

  async function handleLogin() {
    if (!selected || !pin) return
    setLogging(true)
    setError('')
    const res = await fetch('/api/auth/client-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: selected.id, pin }),
    })
    const data = await res.json()
    if (res.ok) {
      router.push(next)
      router.refresh()
    } else {
      setError(data.error ?? 'Login failed')
      setLogging(false)
    }
  }

  async function handleCreate() {
    if (!newName || !newSlug || !newPin) return
    setCreating(true)
    setCreateError('')
    const res = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, slug: newSlug, pin: newPin }),
    })
    const data = await res.json()
    if (res.ok) {
      setClients(c => [...c, data.client])
      setSelected(data.client)
      setShowForm(false)
      setNewName(''); setNewSlug(''); setNewPin('')
    } else {
      setCreateError(data.error ?? 'Failed to create client')
    }
    setCreating(false)
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">

        {/* Logo */}
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl bg-zinc-900 flex items-center justify-center mx-auto mb-3">
            <Layers className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900">Marketing HQ</h1>
          <p className="text-sm text-zinc-500 mt-1">Select a client to continue</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-2 border-zinc-300 border-t-zinc-700 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Client grid */}
            {clients.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {clients.map(c => {
                  const active = selected?.id === c.id
                  return (
                    <button key={c.id} onClick={() => { setSelected(c); setPin(''); setError('') }}
                      className={`relative flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all text-center ${active ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white hover:border-zinc-300 text-zinc-700'}`}>
                      {active && <Check className="absolute top-2 right-2 w-4 h-4 text-white" />}
                      {c.logo_url
                        ? <img src={c.logo_url} alt={c.name} className="w-14 h-14 rounded-xl object-cover" />
                        : (
                          <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl font-bold ${active ? 'bg-white/20' : 'bg-zinc-100'}`}>
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                      <span className="text-sm font-semibold leading-tight">{c.name}</span>
                    </button>
                  )
                })}
                {/* Add new client button */}
                <button onClick={() => setShowForm(true)}
                  className="flex flex-col items-center gap-3 p-4 rounded-2xl border-2 border-dashed border-zinc-200 hover:border-zinc-400 text-zinc-400 hover:text-zinc-600 transition-all">
                  <div className="w-14 h-14 rounded-xl bg-zinc-100 flex items-center justify-center">
                    <Plus className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-medium">Add client</span>
                </button>
              </div>
            )}

            {/* PIN entry */}
            {selected && (
              <div className="bg-white rounded-2xl border border-zinc-200 p-5 space-y-4">
                <p className="text-sm font-medium text-zinc-700">Enter PIN for <span className="font-bold">{selected.name}</span></p>
                <div className="relative">
                  <input
                    type={showPin ? 'text' : 'password'}
                    value={pin}
                    onChange={e => { setPin(e.target.value); setError('') }}
                    onKeyDown={e => e.key === 'Enter' && handleLogin()}
                    placeholder="Enter PIN"
                    autoFocus
                    className="w-full border border-zinc-200 rounded-xl px-4 py-3 pr-11 text-sm outline-none focus:border-zinc-400 tracking-widest"
                  />
                  <button onClick={() => setShowPin(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {error && <p className="text-xs text-red-500">{error}</p>}
                <button onClick={handleLogin} disabled={!pin || logging}
                  className="w-full flex items-center justify-center gap-2 bg-zinc-900 text-white rounded-xl py-3 text-sm font-semibold hover:bg-zinc-700 transition-colors disabled:opacity-50">
                  {logging ? 'Logging in…' : <>Continue <ArrowRight className="w-4 h-4" /></>}
                </button>
              </div>
            )}

            {/* New client form */}
            {showForm && (
              <div className="bg-white rounded-2xl border border-zinc-200 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-zinc-800">Add new client</p>
                  {clients.length > 0 && (
                    <button onClick={() => setShowForm(false)} className="text-zinc-400 hover:text-zinc-600">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="space-y-3">
                  <input value={newName} onChange={e => setNewName(e.target.value)}
                    placeholder="Client name (e.g. Topoci)" autoFocus
                    className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-zinc-400" />
                  <input value={newSlug} onChange={e => setNewSlug(e.target.value)}
                    placeholder="Slug (e.g. topoci)"
                    className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-zinc-400 text-zinc-500" />
                  <input type="password" value={newPin} onChange={e => setNewPin(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleCreate()}
                    placeholder="Set a PIN (e.g. 1234)"
                    className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-zinc-400 tracking-widest" />
                </div>
                {createError && <p className="text-xs text-red-500">{createError}</p>}
                <button onClick={handleCreate} disabled={!newName || !newSlug || !newPin || creating}
                  className="w-full bg-zinc-900 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-zinc-700 transition-colors disabled:opacity-50">
                  {creating ? 'Creating…' : 'Create client'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  )
}
