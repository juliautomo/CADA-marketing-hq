export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const clientId = req.headers.get('x-client-id')
  const db = createServiceClient()
  let query = db.from('cada_brand_kit_analyses').select('*').order('created_at', { ascending: false }).limit(10)
  if (clientId) query = query.eq('client_id', clientId)
  else query = query.is('client_id', null)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ analyses: data })
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const db = createServiceClient()
  const { error } = await db.from('cada_brand_kit_analyses').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
