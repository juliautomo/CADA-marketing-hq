export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const clientId = req.headers.get('x-client-id')
  const supabase = createServiceClient()
  let query = supabase.from('cada_settings').select('key, value').in('key', ['automation_monday_trend_enabled', 'automation_daily_content_enabled'])
  if (clientId) query = query.eq('client_id', clientId)
  else query = query.is('client_id', null)
  const { data } = await query

  const result: Record<string, boolean> = {
    'monday-trend': true,
    'daily-content': true,
  }
  for (const row of data ?? []) {
    const val = row.value !== false && row.value !== 'false'
    if (row.key === 'automation_monday_trend_enabled') result['monday-trend'] = val
    if (row.key === 'automation_daily_content_enabled') result['daily-content'] = val
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

  const clientId = req.headers.get('x-client-id')
  const supabase = createServiceClient()
  await supabase.from('cada_settings').upsert({ key, value: enabled, updated_at: new Date().toISOString(), client_id: clientId ?? null }, { onConflict: 'key,client_id' })
  return NextResponse.json({ ok: true })
}

