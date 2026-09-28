export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { generateImage, generateImageWithReference } from '@/lib/openai'
import { getBrandContext } from '@/lib/brand'

// Split a prompt on SLIDE markers → ['slide 1 prompt', 'slide 2 prompt', ...]
function parseSlides(prompt: string): string[] {
  const slideRegex = /SLIDE\s*\d+\s*:/gi
  if (!slideRegex.test(prompt)) return [prompt]
  // Reset regex lastIndex
  const parts = prompt.split(/(?=SLIDE\s*\d+\s*:)/gi).filter(s => s.trim())
  return parts.map(p => p.replace(/^SLIDE\s*\d+\s*:\s*/i, '').trim()).filter(Boolean)
}

export async function POST(req: NextRequest) {
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const clientId = req.headers.get('x-client-id') ?? null
  const db = createServiceClient()

  const { data: post, error: fetchErr } = await db
    .from('cada_scheduled_posts')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchErr || !post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

  await db.from('cada_scheduled_posts').update({ status: 'generating' }).eq('id', id)

  const imagePrompt = post.image_concept as string | null

  if (!imagePrompt) {
    const { data } = await db
      .from('cada_scheduled_posts')
      .update({ status: 'image_review' })
      .eq('id', id)
      .select()
      .single()
    return NextResponse.json({ post: data })
  }

  try {
    const ctx = await getBrandContext(clientId)
    const stylePrefix   = ctx.raw.brand_style_prefix ?? ''
    const colorDesc     = ctx.raw.brand_color_description ?? ''
    const shotStyle     = ctx.raw.brand_shot_style ?? ''
    const negatives     = ctx.raw.brand_negative_prompts ?? ''
    const quality       = (ctx.raw.image_quality as 'low' | 'medium' | 'high') ?? 'medium'
    const referenceUrl  = ctx.referenceImageUrl

    const slides = parseSlides(imagePrompt)
    const isMulti = slides.length > 1

    const buildPrompt = (base: string) => {
      const styleDirective = [
        stylePrefix && `STYLE: ${stylePrefix}`,
        shotStyle   && `COMPOSITION: ${shotStyle}`,
        colorDesc   && `COLORS: ${colorDesc}`,
        negatives   && `DO NOT include: ${negatives}`,
      ].filter(Boolean).join('\n')
      return styleDirective ? `${styleDirective}\n\nCONTENT: ${base}` : base
    }

    const generate = (prompt: string) =>
      referenceUrl
        ? generateImageWithReference(prompt, referenceUrl, '1024x1536', quality)
        : generateImage(prompt, '1024x1536', quality)

    if (isMulti) {
      // Generate all slide images in parallel
      const urls = await Promise.all(
        slides.map(slide => generate(buildPrompt(slide)))
      )
      const { data } = await db
        .from('cada_scheduled_posts')
        .update({
          status: 'image_review',
          media_url: urls[0],       // first slide as primary
          media_urls: urls,
          media_type: 'image',
        })
        .eq('id', id)
        .select()
        .single()
      return NextResponse.json({ post: data })
    } else {
      const mediaUrl = await generate(buildPrompt(imagePrompt))
      const { data } = await db
        .from('cada_scheduled_posts')
        .update({ status: 'image_review', media_url: mediaUrl, media_type: 'image' })
        .eq('id', id)
        .select()
        .single()
      return NextResponse.json({ post: data })
    }
  } catch (err) {
    const { data } = await db
      .from('cada_scheduled_posts')
      .update({
        status: 'image_review',
        error_message: `Image generation failed: ${err instanceof Error ? err.message : String(err)}`,
      })
      .eq('id', id)
      .select()
      .single()
    return NextResponse.json({ post: data, imageError: true })
  }
}
