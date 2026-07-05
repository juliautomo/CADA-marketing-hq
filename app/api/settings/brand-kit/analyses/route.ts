export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET() {
  const db = createServiceClient()
  const { data, error } = await db
    .from('cada_brand_kit_analyses')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ analyses: data })
}
