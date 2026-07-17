export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = createServiceClient()

  const { data: campaign } = await db
    .from('cada_campaigns')
    .select('*')
    .eq('id', id)
    .single()

  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: milestones } = await db
    .from('cada_campaign_milestones')
    .select('*')
    .eq('campaign_id', id)
    .order('due_date', { ascending: true })

  // For each milestone, check if content has been generated
  const { data: contentItems } = await db
    .from('cada_content_items')
    .select('id, type, image_url, video_url, created_at, milestone_index, tags')
    .eq('campaign_id', id)

  // Check scheduled posts for any of these content items
  const contentIds = (contentItems ?? []).map(c => c.id)
  let scheduledMap: Record<string, boolean> = {}
  if (contentIds.length > 0) {
    const { data: scheduled } = await db
      .from('cada_scheduled_posts')
      .select('metadata')
      .in('status', ['pending', 'published'])
    // scheduled posts don't have content_item_id — use milestone_index from content items
    scheduledMap = {}
    for (const s of scheduled ?? []) {
      const meta = s.metadata as Record<string, unknown> | null
      if (meta?.content_item_id && typeof meta.content_item_id === 'string') {
        scheduledMap[meta.content_item_id] = true
      }
    }
  }

  // Build milestone list with status
  const milestonesWithStatus = (milestones ?? []).map((m, i) => {
    const linked = (contentItems ?? []).filter(c => c.milestone_index === i)
    const isScheduled = linked.some(c => scheduledMap[c.id])
    const status = linked.length === 0 ? 'not_started' : isScheduled ? 'scheduled' : 'generated'
    return { ...m, linked_content: linked, computed_status: status }
  })

  return NextResponse.json({ campaign, milestones: milestonesWithStatus })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = createServiceClient()
  const body = await req.json()

  const { status, summary, objective } = body

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (status !== undefined) updates.status = status
  if (summary !== undefined) updates.summary = summary
  if (objective !== undefined) updates.objective = objective

  const { error } = await db.from('cada_campaigns').update(updates).eq('id', id)
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
