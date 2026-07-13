import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const clientId = req.headers.get('x-client-id')
  const supabase = createServiceClient()
  let query = supabase.from('cada_scheduled_posts').select('*').order('scheduled_at', { ascending: true })
  if (clientId) query = query.eq('client_id', clientId)
  else query = query.is('client_id', null)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ posts: data })
}

export async function POST(req: NextRequest) {
  const clientId = req.headers.get('x-client-id')
  const body = await req.json()
  const { platform, media_url, media_type, caption, scheduled_at } = body

  if (!platform || !media_url || !media_type || !scheduled_at) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('cada_scheduled_posts')
    .insert({ platform, media_url, media_type, caption: caption ?? '', scheduled_at, client_id: clientId ?? null })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ post: data })
}
