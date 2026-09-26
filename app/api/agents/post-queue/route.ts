export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// GET — list draft + approved posts for the queue
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const clientId = req.headers.get('x-client-id') ?? null
  const campaignId = searchParams.get('campaign_id')

  const db = createServiceClient()
  let query = db
    .from('cada_scheduled_posts')
    .select('*, cada_campaigns(name)')
    .in('status', ['draft', 'pending_approval', 'generating', 'image_review', 'approved', 'pending', 'published', 'failed'])
    .order('scheduled_at', { ascending: true })

  if (clientId) query = query.eq('client_id', clientId)
  if (campaignId) query = query.eq('campaign_id', campaignId)

  const { data, error } = await query.limit(100)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ posts: data ?? [] })
}

// PATCH — approve / reject / edit a queued post
export async function PATCH(req: NextRequest) {
  const { id, action, caption, image_concept, scheduled_at } = await req.json()

  if (!id || !action) {
    return NextResponse.json({ error: 'id and action are required' }, { status: 400 })
  }

  const db = createServiceClient()

  const updates: Record<string, unknown> = {}

  if (action === 'approve') {
    updates.status = 'approved'
  } else if (action === 'reject') {
    updates.status = 'failed'
    updates.error_message = 'Rejected by user'
  } else if (action === 'edit') {
    if (caption !== undefined) updates.caption = caption
    if (image_concept !== undefined) updates.image_concept = image_concept
    if (scheduled_at !== undefined) updates.scheduled_at = scheduled_at
  } else {
    return NextResponse.json({ error: 'action must be approve | reject | edit' }, { status: 400 })
  }

  const { data, error } = await db
    .from('cada_scheduled_posts')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ post: data })
}

// DELETE — remove a draft post
export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const db = createServiceClient()
  const { error } = await db.from('cada_scheduled_posts').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
