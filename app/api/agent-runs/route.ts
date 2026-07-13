export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const clientId = req.headers.get('x-client-id')
    const db = createServiceClient()
    let query = db.from('cada_agent_runs').select('*').order('created_at', { ascending: false }).limit(50)
    if (clientId) query = query.eq('client_id', clientId)
    else query = query.is('client_id', null)
    const { data: runs, error } = await query
    if (error) throw error
    return NextResponse.json({ runs: runs ?? [] })
  } catch (e) {
    return NextResponse.json({ runs: [], error: String(e) }, { status: 500 })
  }
}
