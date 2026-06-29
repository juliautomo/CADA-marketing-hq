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

  // Auto-fetch Instagram username if missing
  if (!result.instagram_username && result.instagram_user_token) {
    try {
      const token = result.instagram_page_token ?? result.instagram_user_token
      const igUserId = result.instagram_business_account_id
      if (igUserId) {
        const r = await fetch(`https://graph.facebook.com/v25.0/${igUserId}?fields=username&access_token=${token}`)
        const d = await r.json()
        if (d.username) {
          result.instagram_username = d.username
          await supabase.from('cada_settings').upsert([{ key: 'instagram_username', value: d.username, updated_at: new Date().toISOString() }])
        }
      }
    } catch { /* non-critical */ }
  }

  // Auto-fetch TikTok username if missing
  if (!result.tiktok_username && result.tiktok_access_token) {
    try {
      const r = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=display_name,username', {
        headers: { Authorization: `Bearer ${result.tiktok_access_token}` },
      })
      const d = await r.json()
      const username = d.data?.user?.username ?? d.data?.user?.display_name
      if (username) {
        result.tiktok_username = username
        await supabase.from('cada_settings').upsert([{ key: 'tiktok_username', value: username, updated_at: new Date().toISOString() }])
      }
    } catch { /* non-critical */ }
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
