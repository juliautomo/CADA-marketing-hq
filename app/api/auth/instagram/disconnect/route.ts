export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST() {
  const supabase = createServiceClient()

  const keys = [
    'instagram_user_token',
    'instagram_page_id',
    'instagram_page_name',
    'instagram_page_token',
    'instagram_business_account_id',
    'instagram_username',
    'instagram_pages',
  ]

  await supabase.from('cada_settings').delete().in('key', keys)

  return NextResponse.json({ ok: true })
}
