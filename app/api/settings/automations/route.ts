export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET() {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('cada_settings')
    .select('key, value')
    .in('key', ['automation_monday_trend_enabled', 'automation_daily_content_enabled'])

  const result: Record<string, boolean> = {
    'monday-trend': true,
    'daily-content': true,
  }
  for (const row of data ?? []) {
    if (row.key === 'automation_monday_trend_enabled') result['monday-trend'] = row.value === true
    if (row.key === 'automation_daily_content_enabled') result['daily-content'] = row.value === true
  }
  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const { id, enabled } = await req.json()
  const keyMap: Record<string, string> = {
    'monday-trend': 'automation_monday_trend_enabled',
    'daily-content': 'automation_daily_content_enabled',
  }
  const key = keyMap[id]
  if (!key) return NextResponse.json({ error: 'Unknown automation' }, { status: 400 })

  const supabase = createServiceClient()
  await supabase.from('cada_settings').upsert({ key, value: enabled, updated_at: new Date().toISOString() })
  return NextResponse.json({ ok: true })
}

