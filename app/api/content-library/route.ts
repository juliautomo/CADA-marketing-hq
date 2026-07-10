export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(req: import('next/server').NextRequest) {
  try {
    const clientId = req.headers.get('x-client-id')
    const db = createServiceClient()
    let query = db.from('cada_content_items').select('*').order('created_at', { ascending: false }).limit(50)
    if (clientId) query = query.eq('client_id', clientId)
    else query = query.is('client_id', null)
    const { data: items, error } = await query

    if (error) throw error
    return NextResponse.json({ items: items ?? [] })
  } catch (error) {
    return NextResponse.json({ items: [], error: String(error) }, { status: 500 })
  }
}

