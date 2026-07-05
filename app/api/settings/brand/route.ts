export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const KEYS = [
  'brand_name', 'brand_handle', 'brand_description',
  'brand_products_list', 'brand_price_point', 'brand_markets', 'brand_channels',
  'brand_subject_description', 'brand_hashtags', 'brand_ecommerce_platform', 'brand_industry',
  'brand_voice', 'brand_guidelines', 'brand_target_customer', 'brand_campaign_theme', 'brand_caption_examples', 'image_quality',
  'brand_style_prefix', 'brand_negative_prompts', 'brand_color_description', 'brand_shot_style',
  'brand_style_reference_url', 'brand_color_swatch_url', 'brand_model_reference_url', 'brand_logo_url',
  'brand_colors',
  'product_catalog_config',
]

export async function GET() {
  const supabase = createServiceClient()
  const { data } = await supabase.from('cada_settings').select('key, value').in('key', KEYS)
  const result: Record<string, string> = {}
  for (const row of data ?? []) {
    result[row.key] = row.value === 'null' ? '' : (typeof row.value === 'string' ? row.value : JSON.stringify(row.value))
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
