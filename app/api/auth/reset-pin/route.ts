import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { hashPin } from '@/lib/client-auth'

export async function POST(req: NextRequest) {
  const { clientId, adminSecret, newPin } = await req.json()
  if (!clientId || !adminSecret || !newPin) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const expected = process.env.ADMIN_SECRET ?? 'cada-admin-reset'
  if (adminSecret !== expected) {
    return NextResponse.json({ error: 'Invalid admin code' }, { status: 401 })
  }

  const db = createServiceClient()
  const { error } = await db
    .from('cada_clients')
    .update({ pin: hashPin(newPin) })
    .eq('id', clientId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
