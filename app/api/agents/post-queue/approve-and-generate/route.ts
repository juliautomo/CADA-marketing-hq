export const dynamic = 'force-dynamic'
export const maxDuration = 120
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { generateImage, generateImageWithReference, generateImageDalle3, uploadBase64ToStorage } from '@/lib/openai'
import { generateImageGemini } from '@/lib/gemini'
import { getBrandContext } from '@/lib/brand'
import { generateText } from '@/lib/anthropic'

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
    const ctx = await getBrandContext((post.client_id as string | null) ?? clientId)
    const stylePrefix   = ctx.raw.brand_style_prefix ?? ''
    const colorDesc     = ctx.raw.brand_color_description ?? ''
    const shotStyle     = ctx.raw.brand_shot_style ?? ''
    const negatives     = ctx.raw.brand_negative_prompts ?? ''
    const quality       = (ctx.raw.image_quality as 'low' | 'medium' | 'high') ?? 'medium'
    const referenceUrl  = ctx.referenceImageUrl

    const imageModel = (post.image_model as string) ?? 'gpt-image-1'

    // Size maps per model
    const gptSizeMap: Record<string, '1024x1024' | '1024x1536'> = {
      '1:1': '1024x1024',
      '4:5': '1024x1536',
      '9:16': '1024x1536',
    }
    const dalle3SizeMap: Record<string, '1024x1024' | '1792x1024' | '1024x1792'> = {
      '1:1': '1024x1024',
      '16:9': '1792x1024',
      '9:16': '1024x1792',
    }
    const imageSize = imageModel === 'dall-e-3'
      ? (dalle3SizeMap[(post.image_size as string) ?? ''] ?? '1024x1024')
      : (gptSizeMap[(post.image_size as string) ?? ''] ?? '1024x1536')

    // Rewrite the image concept to match brand visual style before generating
    const brandStyleGuide = [
      stylePrefix && `Visual style: ${stylePrefix}`,
      shotStyle   && `Composition: ${shotStyle}`,
      colorDesc   && `Colors: ${colorDesc}`,
      negatives   && `Avoid: ${negatives}`,
    ].filter(Boolean).join('\n')

    const imageInstructions = ctx.raw.brand_image_instructions ?? ''

    const rewritePrompt = async (concept: string): Promise<string> => {
      if (!brandStyleGuide && !imageInstructions) return concept
      return generateText(
        `You rewrite image generation prompts to match a specific brand's visual style. Output ONLY the rewritten prompt — no explanation, no preamble.`,
        `BRAND VISUAL STYLE:\n${brandStyleGuide}${imageInstructions ? `\n\nIMAGE GENERATION RULES:\n${imageInstructions}` : ''}\n\nORIGINAL CONCEPT:\n${concept}\n\nRewrite this concept following the brand style and image generation rules above. Keep the same message and information. Output only the rewritten prompt.`
      )
    }

    // brand_logo_url may be stored as a JSON-encoded string ("\"https://...\"") — strip quotes
    const rawLogoUrl = ctx.raw.brand_logo_url || ''
    const logoUrl = rawLogoUrl.replace(/^"|"$/g, '') || undefined
    console.log('logoUrl resolved:', logoUrl ?? 'none')

    // Composite logo onto a generated image URL; returns the same URL if no logo or if sharp fails
    const applyLogo = async (url: string): Promise<string> => {
      if (!logoUrl) { console.log('applyLogo: no logoUrl, skipping'); return url }
      try {
        const { compositeLogoOntoImage } = await import('@/lib/watermark')
        const composited = await compositeLogoOntoImage(url, logoUrl, {
          position: 'bottom-right',
          logoMaxWidthPercent: 20,
          padding: 32,
        })
        console.log('applyLogo: logo composited successfully')
        return uploadBase64ToStorage(composited)
      } catch (err) {
        console.error('Logo composite failed, using original:', err)
        return url
      }
    }

    // Scale image down so all content fits, then add equal white padding on all sides.
    // Using extend-only would add space below already-clipped content; scale+extend
    // ensures the full original image is always visible inside the padding border.
    const addPadding = async (url: string, paddingPx = 60): Promise<string> => {
      try {
        const { default: sharp } = await import('sharp')
        const res = await fetch(url)
        if (!res.ok) return url
        const buffer = Buffer.from(await res.arrayBuffer())
        const meta = await sharp(buffer).metadata()
        const w = meta.width ?? 1024
        const h = meta.height ?? 1536
        const padded = await sharp(buffer)
          .resize(w - paddingPx * 2, h - paddingPx * 2, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
          .extend({ top: paddingPx, bottom: paddingPx, left: paddingPx, right: paddingPx, background: { r: 255, g: 255, b: 255, alpha: 1 } })
          .png()
          .toBuffer()
        console.log(`addPadding: added ${paddingPx}px on all sides, output ${w}x${h}`)
        return uploadBase64ToStorage(`data:image/png;base64,${padded.toString('base64')}`)
      } catch (err) {
        console.error('Padding failed, using original:', err)
        return url
      }
    }

    const slides = parseSlides(imagePrompt)
    const isMulti = slides.length > 1

    // Rewrite all slide concepts in parallel
    const rewrittenSlides = await Promise.all(slides.map(rewritePrompt))

    const buildPrompt = (base: string) => {
      const styleDirective = [
        stylePrefix && `STYLE: ${stylePrefix}`,
        shotStyle   && `COMPOSITION: ${shotStyle}`,
        colorDesc   && `COLORS: ${colorDesc}`,
        negatives   && `DO NOT include: ${negatives}`,
      ].filter(Boolean).join('\n')
      // Frame instruction: AI models respond better to "card on white background" framing
      // than abstract "leave padding" instructions — guarantees visible margin on all sides
      const frameInstruction = `FRAMING: The entire design is a rounded card or poster displayed on a pure white canvas. The white canvas extends at least 6% beyond each edge of the card — top, bottom, left and right — creating a visible white border on all sides. No content or text touches the outer white area.`
      const base2 = `${frameInstruction}\n\nCONTENT: ${base}`
      return styleDirective ? `${styleDirective}\n\n${base2}` : base2
    }

    // Map quality for dall-e-3 (only standard/hd)
    const dalle3Quality = quality === 'high' ? 'hd' : 'standard'

    const generate = (prompt: string) => {
      if (imageModel === 'dall-e-3') {
        return generateImageDalle3(prompt, imageSize as '1024x1024' | '1792x1024' | '1024x1792', dalle3Quality)
      }
      if (imageModel === 'gemini-imagen') {
        return generateImageGemini(prompt, (post.image_size as string) ?? '4:5')
      }
      return referenceUrl
        ? generateImageWithReference(prompt, referenceUrl, imageSize as '1024x1024' | '1024x1536', quality)
        : generateImage(prompt, imageSize as '1024x1024' | '1024x1536', quality)
    }

    // Save the final prompts sent to the image model for review
    const finalPrompts = rewrittenSlides.map(s => buildPrompt(s))
    await db.from('cada_scheduled_posts')
      .update({ image_prompt_used: finalPrompts.join('\n\n---\n\n') })
      .eq('id', id)

    if (isMulti) {
      // Generate slide 1 first, then use it as style reference for remaining slides
      // so all slides share the same visual style
      const firstRaw = await generate(finalPrompts[0])
      const generateWithStyle = (prompt: string) =>
        imageModel === 'dall-e-3'
          ? generateImageDalle3(prompt, imageSize as '1024x1024' | '1792x1024' | '1024x1792', dalle3Quality)
          : generateImageWithReference(prompt, firstRaw, imageSize as '1024x1024' | '1024x1536', quality)
      const remainingRaw = await Promise.all(
        finalPrompts.slice(1).map(generateWithStyle)
      )
      const rawUrls = [firstRaw, ...remainingRaw]
      // Add padding then apply logo to all slides in parallel
      const paddedUrls = await Promise.all(rawUrls.map(u => addPadding(u)))
      const urls = await Promise.all(paddedUrls.map(applyLogo))
      const { data } = await db
        .from('cada_scheduled_posts')
        .update({ status: 'image_review', media_url: urls[0], media_urls: urls, media_type: 'image' })
        .eq('id', id)
        .select()
        .single()
      return NextResponse.json({ post: data })
    } else {
      const rawUrl = await generate(finalPrompts[0])
      const paddedUrl = await addPadding(rawUrl)
      const mediaUrl = await applyLogo(paddedUrl)
      const { data } = await db
        .from('cada_scheduled_posts')
        .update({ status: 'image_review', media_url: mediaUrl, media_type: 'image' })
        .eq('id', id)
        .select()
        .single()
      return NextResponse.json({ post: data })
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const { data } = await db
      .from('cada_scheduled_posts')
      .update({ status: 'failed', error_message: `Image generation failed: ${msg}` })
      .eq('id', id)
      .select()
      .single()
    return NextResponse.json({ post: data, imageError: true })
  }
}
