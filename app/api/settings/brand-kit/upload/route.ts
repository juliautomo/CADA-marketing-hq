export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const clientId = req.headers.get('x-client-id')
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const key = formData.get('key') as string | null

    if (!file || !key) return NextResponse.json({ error: 'file and key required' }, { status: 400 })

    const allowed = ['brand_style_reference_url', 'brand_color_swatch_url', 'brand_model_reference_url', 'brand_logo_url']
    if (!allowed.includes(key)) return NextResponse.json({ error: 'invalid key' }, { status: 400 })

    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${key}-${Date.now()}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const supabase = createServiceClient()
    const { error } = await supabase.storage.from('brand-kit').upload(path, buffer, {
      contentType: file.type,
      upsert: true,
    })
    if (error) throw error

    const { data: { publicUrl } } = supabase.storage.from('brand-kit').getPublicUrl(path)

    // Save URL to settings
    await supabase.from('cada_settings').upsert({
      key,
      value: publicUrl,
      updated_at: new Date().toISOString(),
      client_id: clientId ?? null,
    }, { onConflict: 'key,client_id' })

    return NextResponse.json({ url: publicUrl })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Upload failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
