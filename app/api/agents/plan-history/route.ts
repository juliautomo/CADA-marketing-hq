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

  // For each campaign, fetch its posts
  const results = await Promise.all(
    (campaigns ?? []).map(async (c) => {
      const { data: posts } = await db
        .from('cada_scheduled_posts')
        .select('id, caption, platform, scheduled_at, status, image_concept, media_url, title')
        .eq('campaign_id', c.id)
        .order('scheduled_at', { ascending: true })
      return { ...c, posts: posts ?? [] }
    })
  )

  return NextResponse.json({ plans: results })
}
