export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const clientId = req.headers.get('x-client-id') ?? null
  const db = createServiceClient()

  let query = db
    .from('cada_trend_reports')
    .select('id, title, summary, colors, styles, trending_hashtags, trending_creators, trending_content, created_at')
    .order('created_at', { ascending: false })
    .limit(5)

  if (clientId) query = query.eq('client_id', clientId)
  else query = query.is('client_id', null)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reports: data ?? [] })
}
