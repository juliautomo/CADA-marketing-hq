export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET() {
  try {
    const db = createServiceClient()
    const { data, error } = await db
      .from('cada_campaigns')
      .select('*, campaign_milestones(*)')
      .order('created_at', { ascending: false })
      .limit(20)
    if (error) throw error
    return NextResponse.json({ campaigns: data ?? [] })
  } catch (e) {
    return NextResponse.json({ campaigns: [], error: String(e) }, { status: 500 })
  }
}

