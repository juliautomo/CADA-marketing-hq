export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const clientId = req.headers.get('x-client-id')
    const db = createServiceClient()
    let query = db.from('cada_campaigns').select('*, milestones:cada_campaign_milestones(*)').order('created_at', { ascending: false }).limit(20)
    if (clientId) query = query.eq('client_id', clientId)
    else query = query.is('client_id', null)
    const { data, error } = await query
    if (error) throw error
    return NextResponse.json({ campaigns: data ?? [] })
  } catch (e) {
    return NextResponse.json({ campaigns: [], error: String(e) }, { status: 500 })
  }
}
