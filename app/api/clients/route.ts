export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { hashPin } from '@/lib/client-auth'

export async function GET() {
  const db = createServiceClient()
  const { data } = await db
    .from('cada_clients')
    .select('id, name, slug, logo_url, created_at')
    .order('created_at', { ascending: true })
  return NextResponse.json({ clients: data ?? [] })
}

export async function POST(req: NextRequest) {
  const { name, slug, pin, logo_url } = await req.json()
  if (!name || !slug || !pin) return NextResponse.json({ error: 'name, slug and pin are required' }, { status: 400 })

  const db = createServiceClient()
  const { data, error } = await db
    .from('cada_clients')
    .insert({ name, slug, pin: hashPin(pin), logo_url: logo_url ?? null })
    .select('id, name, slug, logo_url, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ client: data })
}
