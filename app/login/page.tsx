'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Layers, Eye, EyeOff, ArrowRight } from 'lucide-react'

function LoginPageInner() {
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? '/'

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [logging, setLogging] = useState(false)

  async function handleLogin() {
    if (!username.trim() || !password) return
    setLogging(true)
    setError('')

    // Look up client by slug (username)
    const listRes = await fetch('/api/clients')
    const listData = await listRes.json()
    const client = (listData.clients ?? []).find(
      (c: { slug: string }) => c.slug.toLowerCase() === username.trim().toLowerCase()
    )

    if (!client) {
      setError('Invalid username or password')
      setLogging(false)
      return
    }

    const res = await fetch('/api/auth/client-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: client.id, pin: password }),
    })
    const data = await res.json()
    if (res.ok) {
      window.location.href = next
    } else {
      setError('Invalid username or password')
      setLogging(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">

        {/* Logo */}
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl bg-zinc-900 flex items-center justify-center mx-auto mb-3">
            <Layers className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900">Marketing HQ</h1>
          <p className="text-sm text-zinc-500 mt-1">Sign in to continue</p>
        </div>

        {/* Login form */}
        <div className="bg-white rounded-2xl border border-zinc-200 p-6 space-y-4">
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-zinc-500 block mb-1.5">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => { setUsername(e.target.value); setError('') }}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="Enter username"
                autoFocus
                autoComplete="username"
                className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500 block mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  placeholder="••••••"
                  autoComplete="current-password"
                  className="w-full border border-zinc-200 rounded-xl px-4 py-3 pr-11 text-sm outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100"
                />
                <button onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button
            onClick={handleLogin}
            disabled={!username.trim() || !password || logging}
            className="w-full flex items-center justify-center gap-2 bg-zinc-900 text-white rounded-xl py-3 text-sm font-semibold hover:bg-zinc-700 transition-colors disabled:opacity-50"
          >
            {logging ? 'Signing in…' : <>Sign in <ArrowRight className="w-4 h-4" /></>}
          </button>
        </div>

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
