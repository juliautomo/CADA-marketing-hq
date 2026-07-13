export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const clientId = req.headers.get('x-client-id')
  const db = createServiceClient()
  let query = db.from('cada_brand_photos').select('*').order('created_at', { ascending: false })
  if (clientId) query = query.eq('client_id', clientId)
  else query = query.is('client_id', null)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ photos: data })
}

export async function POST(req: NextRequest) {
  try {
    const clientId = req.headers.get('x-client-id')
    const db = createServiceClient()

    let countQuery = db.from('cada_brand_photos').select('*', { count: 'exact', head: true })
    if (clientId) countQuery = countQuery.eq('client_id', clientId)
    else countQuery = countQuery.is('client_id', null)
    const { count } = await countQuery
    if ((count ?? 0) >= 20) return NextResponse.json({ error: 'Maximum 20 photos in library' }, { status: 400 })

    const formData = await req.formData()
    const file = formData.get('photo') as File | null
    if (!file) return NextResponse.json({ error: 'No photo provided' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const path = `library/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`

    const { error: uploadError } = await db.storage.from('brand-kit').upload(path, buffer, {
      contentType: file.type || 'image/jpeg',
      upsert: false,
    })
    if (uploadError) throw uploadError

    const { data: { publicUrl } } = db.storage.from('brand-kit').getPublicUrl(path)

    const { data, error: insertError } = await db.from('cada_brand_photos').insert({
      url: publicUrl,
      filename: file.name,
      client_id: clientId ?? null,
    }).select().single()
    if (insertError) throw insertError

    return NextResponse.json({ photo: data })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Upload failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const clientId = req.headers.get('x-client-id')
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const db = createServiceClient()
    const { data: photo } = await db.from('cada_brand_photos').select('url').eq('id', id).single()

    if (photo?.url) {
      const path = photo.url.split('/brand-kit/')[1]
      if (path) await db.storage.from('brand-kit').remove([path])
    }

    let del = db.from('cada_brand_photos').delete().eq('id', id)
    if (clientId) del = del.eq('client_id', clientId)
    await del
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Delete failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
