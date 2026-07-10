export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { hashPin, setClientCookie } from '@/lib/client-auth'

export async function POST(req: NextRequest) {
  const { clientId, pin } = await req.json()
  if (!clientId || !pin) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const db = createServiceClient()
  const { data: client } = await db
    .from('cada_clients')
    .select('id, name, slug, pin')
    .eq('id', clientId)
    .single()

  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  if (client.pin !== hashPin(pin)) return NextResponse.json({ error: 'Incorrect PIN' }, { status: 401 })

  await setClientCookie(client.id)
  return NextResponse.json({ ok: true, clientId: client.id, name: client.name })
}
