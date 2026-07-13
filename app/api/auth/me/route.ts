export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const clientId = req.headers.get('x-client-id')
  if (!clientId) return NextResponse.json({ client: null })
  const db = createServiceClient()
  const { data } = await db
    .from('cada_clients')
    .select('id, name, slug, logo_url')
    .eq('id', clientId)
    .single()
  return NextResponse.json({ client: data ?? null })
}
