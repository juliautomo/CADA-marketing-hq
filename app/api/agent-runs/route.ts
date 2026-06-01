import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET() {
  try {
    const db = createServiceClient()
    const { data: runs, error } = await db
      .from('agent_runs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) throw error
    return NextResponse.json({ runs: runs ?? [] })
  } catch (e) {
    return NextResponse.json({ runs: [], error: String(e) }, { status: 500 })
  }
}
