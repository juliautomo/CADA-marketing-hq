export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { generateImage } from '@/lib/openai'
import { getBrandContext } from '@/lib/brand'

export async function POST(req: NextRequest) {
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const clientId = req.headers.get('x-client-id') ?? null
  const db = createServiceClient()

  // Fetch the post
  const { data: post, error: fetchErr } = await db
    .from('cada_scheduled_posts')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchErr || !post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

  // Mark as generating immediately
  await db.from('cada_scheduled_posts').update({ status: 'generating' }).eq('id', id)

  const imagePrompt = post.image_concept as string | null

  if (!imagePrompt) {
    // No image concept — just approve
    const { data } = await db
      .from('cada_scheduled_posts')
      .update({ status: 'approved' })
      .eq('id', id)
      .select()
      .single()
    return NextResponse.json({ post: data })
  }

  try {
    // Load brand visual style to enhance the prompt
    const ctx = await getBrandContext(clientId)
    const stylePrefix = ctx.raw.brand_style_prefix ?? ''
    const colorDesc   = ctx.raw.brand_color_description ?? ''
    const shotStyle   = ctx.raw.brand_shot_style ?? ''
    const negatives   = ctx.raw.brand_negative_prompts ?? ''

    const fullPrompt = [
      stylePrefix,
      imagePrompt,
      shotStyle,
      colorDesc,
      negatives ? `Avoid: ${negatives}` : '',
    ].filter(Boolean).join('. ')

    const quality = (ctx.raw.image_quality as 'low' | 'medium' | 'high') ?? 'medium'
    const mediaUrl = await generateImage(fullPrompt, '1024x1536', quality)

    const { data } = await db
      .from('cada_scheduled_posts')
      .update({ status: 'approved', media_url: mediaUrl, media_type: 'image' })
      .eq('id', id)
      .select()
      .single()

    return NextResponse.json({ post: data })
  } catch (err) {
    // Image generation failed — still approve, just without image
    const { data } = await db
      .from('cada_scheduled_posts')
      .update({
        status: 'approved',
        error_message: `Image generation failed: ${err instanceof Error ? err.message : String(err)}`,
      })
      .eq('id', id)
      .select()
      .single()

    return NextResponse.json({ post: data, imageError: true })
  }
}
