export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const clientId = req.headers.get('x-client-id')
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

  let query = supabase.from('cada_settings').delete().in('key', keys)
  if (clientId) query = query.eq('client_id', clientId)
  else query = query.is('client_id', null)
  await query

  return NextResponse.json({ ok: true })
}
