export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const clientId = req.headers.get('x-client-id') ?? null
  const db = createServiceClient()

  let query = db
    .from('cada_campaigns')
    .select('id, name, description, start_date, end_date, created_at, google_drive_url')
    .order('created_at', { ascending: false })
    .limit(20)

  if (clientId) query = query.eq('client_id', clientId)
  else query = query.is('client_id', null)

  const { data: campaigns, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // For each campaign, fetch its posts (by campaign_id, or by date range if none linked)
  const results = await Promise.all(
    (campaigns ?? []).map(async (c) => {
      let { data: posts } = await db
        .from('cada_scheduled_posts')
        .select('id, caption, platform, scheduled_at, status, image_concept, media_url, title')
        .eq('campaign_id', c.id)
        .order('scheduled_at', { ascending: true })

      // Fallback: posts created within 10 minutes of the campaign (old data before campaign_id was set)
      if (!posts || posts.length === 0) {
        const createdAt = new Date(c.created_at)
        const rangeStart = new Date(createdAt.getTime() - 2 * 60 * 1000).toISOString()
        const rangeEnd   = new Date(createdAt.getTime() + 10 * 60 * 1000).toISOString()
        let q = db
          .from('cada_scheduled_posts')
          .select('id, caption, platform, scheduled_at, status, image_concept, media_url, title')
          .gte('created_at', rangeStart)
          .lte('created_at', rangeEnd)
          .order('scheduled_at', { ascending: true })
        if (clientId) q = q.eq('client_id', clientId)
        else q = q.is('client_id', null)
        const { data: fallback } = await q
        posts = fallback ?? []
      }

      return { ...c, posts: posts ?? [] }
    })
  )

  return NextResponse.json({ plans: results })
}
