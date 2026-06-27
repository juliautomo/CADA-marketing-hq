export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const KEYS = [
  'instagram_app_id',
  'instagram_app_secret',
  'instagram_access_token',
  'instagram_business_account_id',
  'instagram_user_token',
  'instagram_username',
  'tiktok_client_key',
  'tiktok_username',
  'tiktok_client_secret',
  'tiktok_access_token',
  'tiktok_open_id',
]

export async function GET() {
  const supabase = createServiceClient()
  const { data } = await supabase.from('cada_settings').select('key, value').in('key', KEYS)
  const result: Record<string, string> = {}
  for (const row of data ?? []) {
    result[row.key] = row.value === 'null' ? '' : (typeof row.value === 'string' ? row.value : JSON.stringify(row.value))
  }
  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const supabase = createServiceClient()
  const updates = KEYS
    .filter(k => k in body)
    .map(k => ({ key: k, value: body[k] || 'null', updated_at: new Date().toISOString() }))
  if (updates.length === 0) return NextResponse.json({ ok: true })
  await supabase.from('cada_settings').upsert(updates)
  return NextResponse.json({ ok: true })
}
