'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import {
  CheckCircle, XCircle, Edit2, Wand2, CalendarClock, ImageIcon,
  Send, RotateCcw, Clock, Play, Trash2, RefreshCw, Zap,
} from 'lucide-react'
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
  media_type: string | null
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

function PostsPageInner() {
  const searchParams = useSearchParams()

  const [posts, setPosts]         = useState<QueuedPost[]>([])
  const [loading, setLoading]     = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editCaption, setEditCaption]   = useState('')
  const [editConcept, setEditConcept]   = useState('')
  const [editDate, setEditDate]         = useState('')
  const [saving, setSaving]       = useState<string | null>(null)
  const [runResult, setRunResult] = useState<string | null>(null)
  const [running, setRunning]     = useState(false)
  const [publishingId, setPublishingId] = useState<string | null>(null)

  // Brief form — pre-fill from URL params (e.g. coming from Full Campaign)
  const [topic, setTopic]       = useState(searchParams.get('topic') ?? '')
  const [numPosts, setNumPosts] = useState(3)
  const [startDate, setStartDate] = useState(searchParams.get('startDate') ?? '')
  const [endDate, setEndDate]   = useState('')
  const [platform, setPlatform] = useState('instagram')
  const [tone, setTone]         = useState('')
  const [products, setProducts] = useState('')
  const [planning, setPlanning] = useState(false)
  const [planError, setPlanError] = useState('')
  const [formOpen, setFormOpen] = useState(true)

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

  async function publishNow(id: string) {
    setPublishingId(id)
    setRunResult(null)
    try {
      const res = await fetch(`/api/scheduled/publish-posts?post_id=${id}`)
      const data = await res.json()
      if (data.results?.[0]?.ok) {
        setRunResult('Post published successfully!')
      } else {
        setRunResult(`Failed: ${data.results?.[0]?.error ?? 'Unknown error'}`)
      }
      await loadPosts()
    } finally {
      setPublishingId(null)
    }
  }

  async function runScheduler() {
    setRunning(true)
    setRunResult(null)
    try {
      const res = await fetch('/api/scheduled/publish-posts?force=true')
      const data = await res.json()
      setRunResult(data.published === 0
        ? 'No pending posts to publish.'
        : `Published ${data.published} post${data.published !== 1 ? 's' : ''} successfully!`)
      await loadPosts()
    } finally {
      setRunning(false)
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
          id, action: 'edit',
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
      setFormOpen(false)
      await loadPosts()
    } finally {
      setPlanning(false)
    }
  }

  const draftPosts   = posts.filter(p => p.status === 'draft')
  const activePosts  = posts.filter(p => ['approved', 'generating', 'pending'].includes(p.status))
  const donePosts    = posts.filter(p => ['published', 'failed'].includes(p.status))

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Posts</h1>
          <p className="text-sm text-zinc-500 mt-1">Plan, approve, and auto-publish to Instagram or TikTok.</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="secondary" size="sm" onClick={loadPosts} disabled={loading} className="gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button size="sm" onClick={runScheduler} disabled={running} className="gap-1.5">
            <Zap className="w-3.5 h-3.5" /> {running ? 'Running…' : 'Publish now'}
          </Button>
        </div>
      </div>

      {runResult && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium ${runResult.includes('Failed') || runResult.includes('No pending') ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
          {runResult}
        </div>
      )}

      {/* Brief generator */}
      <section className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-zinc-50 transition-colors"
          onClick={() => setFormOpen(v => !v)}
        >
          <span className="text-sm font-semibold text-zinc-800 flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-violet-500" /> Generate post plan with AI
          </span>
          <span className="text-xs text-zinc-400">{formOpen ? '▲ collapse' : '▼ expand'}</span>
        </button>

        {formOpen && (
          <form onSubmit={handleGeneratePlan} className="px-6 pb-6 space-y-4 border-t border-zinc-100">
            <div className="pt-4">
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
                <label className="text-xs font-medium text-zinc-500 block mb-1">Tone</label>
                <input value={tone} onChange={e => setTone(e.target.value)} placeholder="playful, elegant…"
                  className="w-full text-sm bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-zinc-400" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500 block mb-1">Products to feature</label>
              <input value={products} onChange={e => setProducts(e.target.value)} placeholder="Rabokki Set, Kimchi Bundle…"
                className="w-full text-sm bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-zinc-400" />
            </div>
            {planError && <p className="text-xs text-red-500">{planError}</p>}
            <Button type="submit" variant="primary" disabled={planning} className="w-full">
              {planning ? 'Generating plan…' : 'Generate plan'}
            </Button>
          </form>
        )}
      </section>

      {/* Draft — awaiting approval */}
      {draftPosts.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Awaiting approval ({draftPosts.length})</h2>
          {draftPosts.map(post => (
            <PostCard key={post.id} post={post} saving={saving === post.id} editingId={editingId}
              editCaption={editCaption} editConcept={editConcept} editDate={editDate}
              setEditCaption={setEditCaption} setEditConcept={setEditConcept} setEditDate={setEditDate}
              onApprove={() => handleAction(post.id, 'approve')}
              onRemove={() => handleDelete(post.id)}
              onEdit={() => startEdit(post)} onSaveEdit={() => saveEdit(post.id)} onCancelEdit={() => setEditingId(null)} />
          ))}
        </section>
      )}

      {/* Scheduled — approved / generating / pending */}
      {activePosts.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Scheduled ({activePosts.length})</h2>
          {activePosts.map(post => (
            <PostCard key={post.id} post={post} saving={saving === post.id} editingId={editingId}
              editCaption={editCaption} editConcept={editConcept} editDate={editDate}
              setEditCaption={setEditCaption} setEditConcept={setEditConcept} setEditDate={setEditDate}
              onEdit={post.status === 'approved' ? () => startEdit(post) : undefined}
              onSaveEdit={() => saveEdit(post.id)} onCancelEdit={() => setEditingId(null)}
              onPublishNow={post.status === 'pending' ? () => publishNow(post.id) : undefined}
              onRemove={post.status === 'pending' ? () => handleDelete(post.id) : undefined}
              publishingNow={publishingId === post.id} />
          ))}
        </section>
      )}

      {/* Done — published / failed */}
      {donePosts.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Done ({donePosts.length})</h2>
          {donePosts.map(post => (
            <PostCard key={post.id} post={post} saving={false} editingId={editingId}
              editCaption={editCaption} editConcept={editConcept} editDate={editDate}
              setEditCaption={setEditCaption} setEditConcept={setEditConcept} setEditDate={setEditDate}
              onRemove={post.status === 'failed' ? () => handleDelete(post.id) : undefined} />
          ))}
        </section>
      )}

      {!loading && posts.length === 0 && (
        <p className="text-center text-sm text-zinc-400 py-12">No posts yet — generate a plan above.</p>
      )}
      {loading && <p className="text-center text-sm text-zinc-400 py-12">Loading…</p>}
    </div>
  )
}

export default function PostsPage() {
  return (
    <Suspense>
      <PostsPageInner />
    </Suspense>
  )
}

// ─── PostCard ─────────────────────────────────────────────────────────────────

function PostCard({
  post, saving, editingId,
  editCaption, editConcept, editDate,
  setEditCaption, setEditConcept, setEditDate,
  onApprove, onRemove, onEdit, onSaveEdit, onCancelEdit, onPublishNow, publishingNow,
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
  onRemove?: () => void
  onEdit?: () => void
  onSaveEdit?: () => void
  onCancelEdit?: () => void
  onPublishNow?: () => void
  publishingNow?: boolean
}) {
  const isEditing = editingId === post.id
  const statusCls = STATUS_COLORS[post.status] ?? 'bg-zinc-100 text-zinc-500 border-zinc-200'

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 p-4 space-y-3">
      {/* Top row */}
      <div className="flex items-start gap-3">
        {post.media_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.media_url} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0 border border-zinc-100" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-zinc-800 truncate">{post.title ?? 'Untitled post'}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`inline-flex items-center gap-1 text-xs border rounded-full px-2 py-0.5 ${statusCls}`}>
              {post.status === 'generating' && <RotateCcw className="w-3 h-3 animate-spin" />}
              {post.status === 'published'  && <CheckCircle className="w-3 h-3" />}
              {post.status === 'failed'     && <XCircle className="w-3 h-3" />}
              {post.status === 'approved'   && <CheckCircle className="w-3 h-3" />}
              {post.status === 'pending'    && <Clock className="w-3 h-3" />}
              {post.status}
            </span>
            <span className="text-xs text-zinc-400 flex items-center gap-1">
              <CalendarClock className="w-3 h-3" />
              {post.scheduled_at ? format(parseISO(post.scheduled_at), 'MMM d, h:mm a') : '—'}
            </span>
            <span className="text-xs text-zinc-400 capitalize">{post.platform}</span>
          </div>
        </div>
      </div>

      {/* Edit form */}
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
            <label className="text-xs text-zinc-500 font-medium">Schedule date &amp; time</label>
            <input type="datetime-local" value={editDate} onChange={e => setEditDate(e.target.value)}
              className="w-full mt-1 text-xs bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-zinc-400" />
          </div>
          <div className="flex gap-2">
            <button onClick={onSaveEdit} disabled={saving}
              className="flex-1 text-xs font-medium bg-zinc-800 text-white rounded-xl py-2 hover:bg-zinc-700 disabled:opacity-40 transition-colors">
              Save
            </button>
            <button onClick={onCancelEdit}
              className="flex-1 text-xs text-zinc-500 border border-zinc-200 rounded-xl py-2 hover:bg-zinc-50 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-xs text-zinc-600 line-clamp-3 whitespace-pre-wrap">{post.caption}</p>

          {post.image_concept && !post.media_url && (
            <p className="text-xs text-zinc-400 italic flex items-start gap-1">
              <ImageIcon className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span className="line-clamp-2">{post.image_concept}</span>
            </p>
          )}

          {post.error_message && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <XCircle className="w-3 h-3" /> {post.error_message}
            </p>
          )}

          {/* Action buttons */}
          {(onApprove || onRemove || onEdit || onPublishNow) && (
            <div className="flex gap-2 pt-1">
              {onApprove && (
                <button onClick={onApprove} disabled={saving}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium bg-emerald-600 text-white rounded-xl py-2 hover:bg-emerald-500 disabled:opacity-40 transition-colors">
                  <Send className="w-3 h-3" /> Approve &amp; schedule
                </button>
              )}
              {onPublishNow && (
                <button onClick={onPublishNow} disabled={publishingNow}
                  className="flex items-center justify-center gap-1.5 px-3 text-xs text-violet-600 border border-violet-200 rounded-xl py-2 hover:bg-violet-50 disabled:opacity-40 transition-colors">
                  <Play className="w-3 h-3" /> {publishingNow ? 'Publishing…' : 'Publish now'}
                </button>
              )}
              {onEdit && (
                <button onClick={onEdit}
                  className="flex items-center justify-center gap-1.5 px-3 text-xs text-zinc-500 border border-zinc-200 rounded-xl py-2 hover:bg-zinc-50 transition-colors">
                  <Edit2 className="w-3 h-3" /> Edit
                </button>
              )}
              {onRemove && (
                <button onClick={onRemove} disabled={saving}
                  className="flex items-center justify-center gap-1.5 px-3 text-xs text-zinc-400 hover:text-red-500 border border-zinc-200 rounded-xl py-2 hover:bg-red-50 transition-colors">
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
