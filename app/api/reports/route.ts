export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(req: import('next/server').NextRequest) {
  try {
    const clientId = req.headers.get('x-client-id')
    const db = createServiceClient()
    let query = db.from('cada_performance_reports').select('*').order('created_at', { ascending: false }).limit(20)
    if (clientId) query = query.eq('client_id', clientId)
    else query = query.is('client_id', null)
    const { data, error } = await query
    if (error) throw error
    return NextResponse.json({ reports: data ?? [] })
  } catch (e) {
    return NextResponse.json({ reports: [], error: String(e) }, { status: 500 })
  }
}

