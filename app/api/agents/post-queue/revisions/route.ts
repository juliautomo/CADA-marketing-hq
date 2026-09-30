export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// GET /api/agents/post-queue/revisions?post_id=xxx
export async function GET(req: NextRequest) {
  const postId = req.nextUrl.searchParams.get('post_id')
  if (!postId) return NextResponse.json({ error: 'post_id required' }, { status: 400 })

  const db = createServiceClient()
  const { data, error } = await db
    .from('cada_image_revisions')
    .select('id, media_url, media_urls, image_model, prompt_used, correction_note, created_at')
    .eq('post_id', postId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ revisions: data ?? [] })
}

// POST /api/agents/post-queue/revisions  { post_id, revision_id }
// Restores a revision as the current image on the post
export async function POST(req: NextRequest) {
  const { post_id, revision_id } = await req.json()
  if (!post_id || !revision_id) return NextResponse.json({ error: 'post_id and revision_id required' }, { status: 400 })

  const db = createServiceClient()
  const { data: rev, error: revErr } = await db
    .from('cada_image_revisions')
    .select('media_url, media_urls')
    .eq('id', revision_id)
    .single()

  if (revErr || !rev) return NextResponse.json({ error: 'Revision not found' }, { status: 404 })

  const update: Record<string, unknown> = { media_url: rev.media_url, status: 'image_review' }
  if (rev.media_urls) update.media_urls = rev.media_urls

  const { data, error } = await db
    .from('cada_scheduled_posts')
    .update(update)
    .eq('id', post_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ post: data })
}
