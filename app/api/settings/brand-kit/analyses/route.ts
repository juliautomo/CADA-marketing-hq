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
