import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET() {
  try {
    const db = createServiceClient()
    const { data, error } = await db
      .from('performance_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)
    if (error) throw error
    return NextResponse.json({ reports: data ?? [] })
  } catch (e) {
    return NextResponse.json({ reports: [], error: String(e) }, { status: 500 })
  }
}
