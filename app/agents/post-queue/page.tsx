'use client'

import { useState, useEffect, useCallback } from 'react'
import { format, parseISO } from 'date-fns'
import { CheckCircle, XCircle, Edit2, Wand2, CalendarClock, ImageIcon, Send, RotateCcw, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface QueuedPost {
  id: string
  title: string | null
  caption: string
  image_concept: string | null
  platform: string
  scheduled_at: string
  status: string
  media_url: string | null
  error_message: string | null
}

const STATUS_COLORS: Record<string, string> = {
  draft:      'bg-amber-50 text-amber-700 border-amber-200',
  approved:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  generating: 'bg-blue-50 text-blue-700 border-blue-200',
  pending:    'bg-violet-50 text-violet-700 border-violet-200',
  published:  'bg-zinc-100 text-zinc-500 border-zinc-200',
  failed:     'bg-red-50 text-red-700 border-red-200',
}

export default function PostQueuePage() {
  const [posts, setPosts]           = useState<QueuedPost[]>([])
  const [loading, setLoading]       = useState(true)
  const [editingId, setEditingId]   = useState<string | null>(null)
  const [editCaption, setEditCaption]   = useState('')
  const [editConcept, setEditConcept]   = useState('')
  const [editDate, setEditDate]         = useState('')
  const [saving, setSaving]         = useState<string | null>(null)

  // Brief form
  const [topic, setTopic]           = useState('')
  const [numPosts, setNumPosts]     = useState(3)
  const [startDate, setStartDate]   = useState('')
  const [endDate, setEndDate]       = useState('')
  const [platform, setPlatform]     = useState('instagram')
  const [tone, setTone]             = useState('')
  const [products, setProducts]     = useState('')
  const [planning, setPlanning]     = useState(false)
  const [planError, setPlanError]   = useState('')

  const loadPosts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/agents/post-queue')
      const data = await res.json()
      setPosts(data.posts ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadPosts() }, [loadPosts])

  async function handleAction(id: string, action: 'approve' | 'reject') {
    setSaving(id)
    try {
      await fetch('/api/agents/post-queue', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      })
      await loadPosts()
    } finally {
      setSaving(null)
    }
  }

  function startEdit(post: QueuedPost) {
    setEditingId(post.id)
    setEditCaption(post.caption)
    setEditConcept(post.image_concept ?? '')
    setEditDate(post.scheduled_at ? post.scheduled_at.slice(0, 16) : '')
  }

  async function saveEdit(id: string) {
    setSaving(id)
    try {
      await fetch('/api/agents/post-queue', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          action: 'edit',
          caption: editCaption,
          image_concept: editConcept,
          scheduled_at: editDate ? new Date(editDate).toISOString() : undefined,
        }),
      })
      setEditingId(null)
      await loadPosts()
    } finally {
      setSaving(null)
    }
  }

  async function handleDelete(id: string) {
    setSaving(id)
    try {
      await fetch('/api/agents/post-queue', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      await loadPosts()
    } finally {
      setSaving(null)
    }
  }

  async function handleGeneratePlan(e: React.FormEvent) {
    e.preventDefault()
    if (!topic || !startDate || !endDate) return
    setPlanning(true)
    setPlanError('')
    try {
      const res = await fetch('/api/agents/post-planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, numPosts, startDate, endDate, platform, tone, products }),
      })
      const data = await res.json()
      if (!res.ok) { setPlanError(data.error ?? 'Failed to generate plan'); return }
      await loadPosts()
    } finally {
      setPlanning(false)
    }
  }

  const draftPosts     = posts.filter(p => p.status === 'draft')
  const activePosts    = posts.filter(p => p.status === 'approved' || p.status === 'generating' || p.status === 'pending')
  const donePosts      = posts.filter(p => p.status === 'published' || p.status === 'failed')

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Post Queue</h1>
        <p className="text-sm text-zinc-500 mt-1">Plan posts, approve them, and they publish automatically at the scheduled time.</p>
      </div>

      {/* Brief generator */}
      <section className="bg-white rounded-2xl border border-zinc-200 p-6 space-y-4">
        <h2 className="text-base font-semibold text-zinc-800 flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-violet-500" /> Generate post plan
        </h2>
        <form onSubmit={handleGeneratePlan} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-zinc-500 block mb-1">Topic / campaign idea</label>
            <input
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="e.g. Ramadan bundle launch — showcase the rabokki set"
              className="w-full text-sm bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-zinc-400"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-zinc-500 block mb-1">Start date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full text-sm bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-zinc-400" required />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500 block mb-1">End date</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="w-full text-sm bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-zinc-400" required />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-zinc-500 block mb-1">Number of posts</label>
              <input type="number" min={1} max={10} value={numPosts} onChange={e => setNumPosts(parseInt(e.target.value) || 1)}
                className="w-full text-sm bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-zinc-400" />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500 block mb-1">Platform</label>
              <select value={platform} onChange={e => setPlatform(e.target.value)}
                className="w-full text-sm bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-zinc-400">
                <option value="instagram">Instagram</option>
                <option value="tiktok">TikTok</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500 block mb-1">Tone (optional)</label>
              <input value={tone} onChange={e => setTone(e.target.value)} placeholder="playful, elegant…"
                className="w-full text-sm bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-zinc-400" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-500 block mb-1">Products to feature (optional)</label>
            <input value={products} onChange={e => setProducts(e.target.value)} placeholder="Rabokki Set, Kimchi Bundle…"
              className="w-full text-sm bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-zinc-400" />
          </div>
          {planError && <p className="text-xs text-red-500">{planError}</p>}
          <Button type="submit" variant="primary" disabled={planning} className="w-full">
            {planning ? 'Generating plan…' : 'Generate plan'}
          </Button>
        </form>
      </section>

      {/* Draft posts — awaiting approval */}
      {draftPosts.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-600 uppercase tracking-wide">Awaiting approval ({draftPosts.length})</h2>
          {draftPosts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              saving={saving === post.id}
              editingId={editingId}
              editCaption={editCaption}
              editConcept={editConcept}
              editDate={editDate}
              setEditCaption={setEditCaption}
              setEditConcept={setEditConcept}
              setEditDate={setEditDate}
              onApprove={() => handleAction(post.id, 'approve')}
              onReject={() => handleDelete(post.id)}
              onEdit={() => startEdit(post)}
              onSaveEdit={() => saveEdit(post.id)}
              onCancelEdit={() => setEditingId(null)}
            />
          ))}
        </section>
      )}

      {/* Active — approved/generating/pending */}
      {activePosts.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-600 uppercase tracking-wide">Scheduled ({activePosts.length})</h2>
          {activePosts.map(post => (
            <PostCard key={post.id} post={post} saving={saving === post.id} editingId={editingId}
              editCaption={editCaption} editConcept={editConcept} editDate={editDate}
              setEditCaption={setEditCaption} setEditConcept={setEditConcept} setEditDate={setEditDate}
              onEdit={() => startEdit(post)} onSaveEdit={() => saveEdit(post.id)} onCancelEdit={() => setEditingId(null)} />
          ))}
        </section>
      )}

      {/* Done */}
      {donePosts.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-600 uppercase tracking-wide">Done ({donePosts.length})</h2>
          {donePosts.map(post => (
            <PostCard key={post.id} post={post} saving={false} editingId={editingId}
              editCaption={editCaption} editConcept={editConcept} editDate={editDate}
              setEditCaption={setEditCaption} setEditConcept={setEditConcept} setEditDate={setEditDate} />
          ))}
        </section>
      )}

      {!loading && posts.length === 0 && (
        <p className="text-center text-sm text-zinc-400 py-10">No posts yet — generate a plan above.</p>
      )}

      {loading && <p className="text-center text-sm text-zinc-400 py-10">Loading…</p>}
    </div>
  )
}

function PostCard({
  post, saving, editingId,
  editCaption, editConcept, editDate,
  setEditCaption, setEditConcept, setEditDate,
  onApprove, onReject, onEdit, onSaveEdit, onCancelEdit,
}: {
  post: QueuedPost
  saving: boolean
  editingId: string | null
  editCaption: string
  editConcept: string
  editDate: string
  setEditCaption: (v: string) => void
  setEditConcept: (v: string) => void
  setEditDate: (v: string) => void
  onApprove?: () => void
  onReject?: () => void
  onEdit?: () => void
  onSaveEdit?: () => void
  onCancelEdit?: () => void
}) {
  const isEditing = editingId === post.id
  const statusCls = STATUS_COLORS[post.status] ?? 'bg-zinc-100 text-zinc-500 border-zinc-200'

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-zinc-800 truncate">{post.title ?? 'Untitled post'}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={`inline-flex items-center gap-1 text-xs border rounded-full px-2 py-0.5 ${statusCls}`}>
              {post.status === 'generating' && <RotateCcw className="w-3 h-3 animate-spin" />}
              {post.status === 'published' && <CheckCircle className="w-3 h-3" />}
              {post.status === 'failed' && <XCircle className="w-3 h-3" />}
              {post.status === 'approved' && <CheckCircle className="w-3 h-3" />}
              {post.status === 'pending' && <Clock className="w-3 h-3" />}
              {post.status}
            </span>
            <span className="text-xs text-zinc-400 flex items-center gap-1">
              <CalendarClock className="w-3 h-3" />
              {post.scheduled_at ? format(parseISO(post.scheduled_at), 'MMM d, h:mm a') : '—'}
            </span>
            <span className="text-xs text-zinc-400 capitalize">{post.platform}</span>
          </div>
        </div>
        {post.media_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.media_url} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
        )}
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <div>
            <label className="text-xs text-zinc-500 font-medium">Caption</label>
            <textarea value={editCaption} onChange={e => setEditCaption(e.target.value)} rows={4}
              className="w-full mt-1 text-xs text-zinc-700 bg-zinc-50 border border-zinc-200 rounded-lg p-2 resize-none focus:outline-none focus:ring-1 focus:ring-zinc-400" />
          </div>
          <div>
            <label className="text-xs text-zinc-500 font-medium flex items-center gap-1"><ImageIcon className="w-3 h-3" /> Image concept</label>
            <textarea value={editConcept} onChange={e => setEditConcept(e.target.value)} rows={2}
              className="w-full mt-1 text-xs text-zinc-700 bg-zinc-50 border border-zinc-200 rounded-lg p-2 resize-none focus:outline-none focus:ring-1 focus:ring-zinc-400" />
          </div>
          <div>
            <label className="text-xs text-zinc-500 font-medium">Schedule date & time</label>
            <input type="datetime-local" value={editDate} onChange={e => setEditDate(e.target.value)}
              className="w-full mt-1 text-xs bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-zinc-400" />
          </div>
          <div className="flex gap-2">
            <button onClick={onSaveEdit} disabled={saving}
              className="flex-1 text-xs font-medium bg-zinc-800 text-white rounded-xl py-2 hover:bg-zinc-700 disabled:opacity-40 transition-colors">
              Save changes
            </button>
            <button onClick={onCancelEdit} className="flex-1 text-xs text-zinc-500 border border-zinc-200 rounded-xl py-2 hover:bg-zinc-50 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-xs text-zinc-600 line-clamp-3 whitespace-pre-wrap">{post.caption}</p>
          {post.image_concept && (
            <p className="text-xs text-zinc-400 italic flex items-start gap-1">
              <ImageIcon className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span className="line-clamp-2">{post.image_concept}</span>
            </p>
          )}
          {post.error_message && (
            <p className="text-xs text-red-500 flex items-center gap-1"><XCircle className="w-3 h-3" /> {post.error_message}</p>
          )}
          {(post.status === 'draft' || post.status === 'approved') && (
            <div className="flex gap-2 pt-1">
              {post.status === 'draft' && onApprove && (
                <button onClick={onApprove} disabled={saving}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium bg-emerald-600 text-white rounded-xl py-2 hover:bg-emerald-500 disabled:opacity-40 transition-colors">
                  <Send className="w-3 h-3" /> Approve &amp; schedule
                </button>
              )}
              {post.status === 'draft' && onReject && (
                <button onClick={onReject} disabled={saving}
                  className="flex items-center justify-center gap-1.5 px-3 text-xs text-zinc-500 border border-zinc-200 rounded-xl py-2 hover:bg-zinc-50 transition-colors">
                  <XCircle className="w-3 h-3" /> Remove
                </button>
              )}
              {onEdit && (
                <button onClick={onEdit}
                  className="flex items-center justify-center gap-1.5 px-3 text-xs text-zinc-500 border border-zinc-200 rounded-xl py-2 hover:bg-zinc-50 transition-colors">
                  <Edit2 className="w-3 h-3" /> Edit
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
