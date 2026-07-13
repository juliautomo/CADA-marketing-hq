'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Layers, Plus, X, Eye, EyeOff, ArrowRight, Check, KeyRound, RotateCcw } from 'lucide-react'

interface Client {
  id: string
  name: string
  slug: string
  logo_url?: string
  created_at: string
}

type View = 'clients' | 'pin' | 'forgot' | 'add'

function LoginPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? '/'

  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Client | null>(null)
  const [view, setView] = useState<View>('clients')

  // PIN login
  const [pin, setPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [logging, setLogging] = useState(false)

  // Forgot PIN / reset
  const [adminCode, setAdminCode] = useState('')
  const [newPin, setNewPin] = useState('')
  const [showNewPin, setShowNewPin] = useState(false)
  const [resetError, setResetError] = useState('')
  const [resetSuccess, setResetSuccess] = useState(false)
  const [resetting, setResetting] = useState(false)

  // New client form
  const [newName, setNewName] = useState('')
  const [newSlug, setNewSlug] = useState('')
  const [addPin, setAddPin] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  useEffect(() => {
    fetch('/api/clients')
      .then(r => r.json())
      .then(d => {
        setClients(d.clients ?? [])
        setLoading(false)
        if (d.clients?.length === 0) setView('add')
      })
  }, [])

  useEffect(() => {
    setNewSlug(newName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
  }, [newName])

  function selectClient(c: Client) {
    setSelected(c)
    setPin('')
    setLoginError('')
    setView('pin')
  }

  async function handleLogin() {
    if (!selected || !pin) return
    setLogging(true)
    setLoginError('')
    const res = await fetch('/api/auth/client-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: selected.id, pin }),
    })
    const data = await res.json()
    if (res.ok) {
      window.location.href = next
    } else {
      setLoginError(data.error ?? 'Login failed')
      setLogging(false)
    }
  }

  async function handleReset() {
    if (!selected || !adminCode || !newPin) return
    setResetting(true)
    setResetError('')
    const res = await fetch('/api/auth/reset-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: selected.id, adminSecret: adminCode, newPin }),
    })
    const data = await res.json()
    if (res.ok) {
      setResetSuccess(true)
    } else {
      setResetError(data.error ?? 'Reset failed')
    }
    setResetting(false)
  }

  async function handleCreate() {
    if (!newName || !newSlug || !addPin) return
    setCreating(true)
    setCreateError('')
    const res = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, slug: newSlug, pin: addPin }),
    })
    const data = await res.json()
    if (res.ok) {
      const newClient = data.client
      setClients(c => [...c, newClient])
      setNewName(''); setNewSlug(''); setAddPin('')
      setSelected(newClient)
      setView('pin')
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
          <p className="text-sm text-zinc-500 mt-1">
            {view === 'clients' && 'Select a client to continue'}
            {view === 'pin' && <>Signing in as <span className="font-semibold text-zinc-700">{selected?.name}</span></>}
            {view === 'forgot' && 'Reset PIN'}
            {view === 'add' && 'Add a new client'}
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-2 border-zinc-300 border-t-zinc-700 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* ── Client grid ── */}
            {view === 'clients' && (
              <div className="grid grid-cols-2 gap-3">
                {clients.map(c => (
                  <button key={c.id} onClick={() => selectClient(c)}
                    className="flex flex-col items-center gap-3 p-4 rounded-2xl border-2 border-zinc-200 bg-white hover:border-zinc-400 hover:shadow-sm text-zinc-700 transition-all text-center">
                    {c.logo_url
                      ? <img src={c.logo_url} alt={c.name} className="w-14 h-14 rounded-xl object-cover" />
                      : (
                        <div className="w-14 h-14 rounded-xl bg-zinc-100 flex items-center justify-center text-2xl font-bold text-zinc-500">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    <span className="text-sm font-semibold leading-tight">{c.name}</span>
                  </button>
                ))}
                <button onClick={() => setView('add')}
                  className="flex flex-col items-center gap-3 p-4 rounded-2xl border-2 border-dashed border-zinc-200 hover:border-zinc-400 text-zinc-400 hover:text-zinc-600 transition-all">
                  <div className="w-14 h-14 rounded-xl bg-zinc-100 flex items-center justify-center">
                    <Plus className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-medium">Add client</span>
                </button>
              </div>
            )}

            {/* ── PIN entry ── */}
            {view === 'pin' && selected && (
              <div className="bg-white rounded-2xl border border-zinc-200 p-5 space-y-4">
                {/* Client badge */}
                <div className="flex items-center gap-3 pb-3 border-b border-zinc-100">
                  {selected.logo_url
                    ? <img src={selected.logo_url} alt={selected.name} className="w-10 h-10 rounded-lg object-cover" />
                    : <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center text-lg font-bold text-zinc-500">{selected.name.charAt(0)}</div>
                  }
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">{selected.name}</p>
                    <button onClick={() => setView('clients')} className="text-xs text-zinc-400 hover:text-zinc-600">← Change client</button>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Enter PIN</label>
                  <div className="relative">
                    <input
                      type={showPin ? 'text' : 'password'}
                      value={pin}
                      onChange={e => { setPin(e.target.value); setLoginError('') }}
                      onKeyDown={e => e.key === 'Enter' && handleLogin()}
                      placeholder="••••••"
                      autoFocus
                      className="w-full border border-zinc-200 rounded-xl px-4 py-3 pr-11 text-sm outline-none focus:border-zinc-400 tracking-widest"
                    />
                    <button onClick={() => setShowPin(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                      {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {loginError && <p className="text-xs text-red-500">{loginError}</p>}
                </div>

                <button onClick={handleLogin} disabled={!pin || logging}
                  className="w-full flex items-center justify-center gap-2 bg-zinc-900 text-white rounded-xl py-3 text-sm font-semibold hover:bg-zinc-700 transition-colors disabled:opacity-50">
                  {logging ? 'Signing in…' : <>Sign in <ArrowRight className="w-4 h-4" /></>}
                </button>

                <div className="text-center">
                  <button onClick={() => { setView('forgot'); setResetError(''); setResetSuccess(false); setAdminCode(''); setNewPin('') }}
                    className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors">
                    Forgot PIN?
                  </button>
                </div>
              </div>
            )}

            {/* ── Forgot / Reset PIN ── */}
            {view === 'forgot' && selected && (
              <div className="bg-white rounded-2xl border border-zinc-200 p-5 space-y-4">
                <div className="flex items-center gap-3 pb-3 border-b border-zinc-100">
                  <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center">
                    <KeyRound className="w-5 h-5 text-zinc-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">Reset PIN for {selected.name}</p>
                    <button onClick={() => setView('pin')} className="text-xs text-zinc-400 hover:text-zinc-600">← Back to sign in</button>
                  </div>
                </div>

                {resetSuccess ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 rounded-xl px-4 py-3">
                      <Check className="w-4 h-4 flex-shrink-0" />
                      <p className="text-sm font-medium">PIN reset successfully!</p>
                    </div>
                    <button onClick={() => { setView('pin'); setPin('') }}
                      className="w-full bg-zinc-900 text-white rounded-xl py-3 text-sm font-semibold hover:bg-zinc-700 transition-colors">
                      Sign in with new PIN
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-zinc-500">Enter the admin reset code (set in your Vercel environment as <code className="bg-zinc-100 px-1 rounded">ADMIN_SECRET</code>).</p>
                    <input
                      type="password"
                      value={adminCode}
                      onChange={e => setAdminCode(e.target.value)}
                      placeholder="Admin reset code"
                      autoFocus
                      className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-zinc-400"
                    />
                    <div className="relative">
                      <input
                        type={showNewPin ? 'text' : 'password'}
                        value={newPin}
                        onChange={e => { setNewPin(e.target.value); setResetError('') }}
                        onKeyDown={e => e.key === 'Enter' && handleReset()}
                        placeholder="New PIN"
                        className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 pr-11 text-sm outline-none focus:border-zinc-400 tracking-widest"
                      />
                      <button onClick={() => setShowNewPin(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                        {showNewPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {resetError && <p className="text-xs text-red-500">{resetError}</p>}
                    <button onClick={handleReset} disabled={!adminCode || !newPin || resetting}
                      className="w-full flex items-center justify-center gap-2 bg-zinc-900 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-zinc-700 transition-colors disabled:opacity-50">
                      <RotateCcw className="w-4 h-4" />
                      {resetting ? 'Resetting…' : 'Reset PIN'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── Add client form ── */}
            {view === 'add' && (
              <div className="bg-white rounded-2xl border border-zinc-200 p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                  <p className="text-sm font-semibold text-zinc-800">New client</p>
                  {clients.length > 0 && (
                    <button onClick={() => setView('clients')} className="text-zinc-400 hover:text-zinc-600">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="space-y-3">
                  <input value={newName} onChange={e => setNewName(e.target.value)}
                    placeholder="Client name (e.g. Acme Fashion)" autoFocus
                    className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-zinc-400" />
                  <input type="password" value={addPin} onChange={e => setAddPin(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleCreate()}
                    placeholder="Set a PIN"
                    className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-zinc-400 tracking-widest" />
                </div>
                {createError && <p className="text-xs text-red-500">{createError}</p>}
                <button onClick={handleCreate} disabled={!newName || !newSlug || !addPin || creating}
                  className="w-full flex items-center justify-center gap-2 bg-zinc-900 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-zinc-700 transition-colors disabled:opacity-50">
                  {creating ? 'Creating…' : <><Check className="w-4 h-4" /> Create client</>}
                </button>
              </div>
            )}
          </>
        )}

        <p className="text-center text-xs text-zinc-400">Powered by Claude AI</p>
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
