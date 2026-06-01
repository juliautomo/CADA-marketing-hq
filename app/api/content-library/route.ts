import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET() {
  try {
    const db = createServiceClient()
    const { data: items, error } = await db
      .from('cada_content_items')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error
    return NextResponse.json({ items: items ?? [] })
  } catch (error) {
    return NextResponse.json({ items: [], error: String(error) }, { status: 500 })
  }
}
