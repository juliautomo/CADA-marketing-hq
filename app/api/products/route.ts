export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const clientId = req.headers.get('x-client-id')
  const db = createServiceClient()
  let query = db.from('cada_products').select('*').order('created_at', { ascending: false })
  if (clientId) query = query.eq('client_id', clientId)
  else query = query.is('client_id', null)
  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ products: data ?? [] })
}

export async function POST(req: NextRequest) {
  const clientId = req.headers.get('x-client-id')
  const db = createServiceClient()
  const body = await req.json()
  const { data, error } = await db
    .from('cada_products')
    .insert({ ...body, client_id: clientId ?? null })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ product: data })
}

export async function PUT(req: NextRequest) {
  const db = createServiceClient()
  const body = await req.json()
  const { id, ...fields } = body
  const { data, error } = await db
    .from('cada_products')
    .update(fields)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ product: data })
}

export async function DELETE(req: NextRequest) {
  const db = createServiceClient()
  const { id } = await req.json()
  const { error } = await db.from('cada_products').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

