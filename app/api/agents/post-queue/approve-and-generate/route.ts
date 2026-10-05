export const dynamic = 'force-dynamic'
export const maxDuration = 120
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { generateImage, generateImageWithReference, generateImageWithReferences, generateImageDalle3, uploadBase64ToStorage, generateTextOpenAI } from '@/lib/openai'
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
  const { id, imageModel: imageModelOverride, correctionNote } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const clientId = req.headers.get('x-client-id') ?? null
  const db = createServiceClient()

  const { data: post, error: fetchErr } = await db
    .from('cada_scheduled_posts')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchErr || !post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

  const generatingUpdate: Record<string, unknown> = { status: 'generating' }
  if (imageModelOverride) generatingUpdate.image_model = imageModelOverride
  await db.from('cada_scheduled_posts').update(generatingUpdate).eq('id', id)

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

    const imageModel  = imageModelOverride ?? (post.image_model as string) ?? 'gpt-image-1'
    const promptModel = (post.prompt_model as string) ?? 'claude'

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

    // brand_logo_url may be stored as a JSON-encoded string ("\"https://...\"") — strip quotes
    // Always resolves to a URL — falls back to placeholder so logo placement is always consistent
    const rawLogoUrl = ctx.raw.brand_logo_url || ''
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const logoUrl = rawLogoUrl.replace(/^"|"$/g, '') || `${appUrl}/placeholder-logo.svg`
    console.log('logoUrl resolved:', logoUrl)

    const logoRule = `- A brand logo image is provided as one of the input images. Place it exactly as-is in the top-left corner — do not redraw, recreate, recolor, or approximate the logo as text or art.
- The category label (badge, chip, tag, pill) goes on its own line directly below the logo, left-aligned. Never place it beside the logo on the same horizontal line. It must not touch or overlap the logo — leave a clear gap between them.`

    const GLOBAL_IMAGE_RULES = `- Never place a literal bullet point (•) Unicode character or typographic dot before text labels. Drawn shape elements (a filled circle rendered as a graphic) are fine as decorative elements inside pills or badges.
- Do not add watermarks, copyright symbols, or placeholder icons.
${logoRule}
- Leave at least 10% of canvas height as empty white space below the very last element (including footer/CTA). Every element — checklist, tips bar, footer — must be fully visible and not cut off at the bottom edge.`

    const rewritePrompt = async (concept: string): Promise<string> => {
      const sys = `You rewrite image generation prompts to match a specific brand's visual style. Output ONLY the rewritten prompt — no explanation, no preamble.`
      const usr = `GLOBAL IMAGE RULES (always apply):\n${GLOBAL_IMAGE_RULES}${brandStyleGuide ? `\n\nBRAND VISUAL STYLE:\n${brandStyleGuide}` : ''}${imageInstructions ? `\n\nIMAGE GENERATION RULES:\n${imageInstructions}` : ''}\n\nORIGINAL CONCEPT:\n${concept}\n\nRewrite this concept following all rules above. Keep the same message and information. Output only the rewritten prompt.`
      if (promptModel === 'gpt-4o' || promptModel === 'gpt-4o-mini') {
        return generateTextOpenAI(sys, usr, promptModel as 'gpt-4o' | 'gpt-4o-mini')
      }
      return generateText(sys, usr)
    }

    // Composite logo onto a generated image URL; returns the same URL if no logo or if sharp fails
    // Skipped when using gpt-image-1 (logo passed directly to AI as input image)
    const applyLogo = async (url: string): Promise<string> => {
      if (imageModel !== 'dall-e-3' && imageModel !== 'gemini-imagen' && imageModel !== 'gemini-nano-banana-2' && imageModel !== 'gemini-nano-banana-2-lite' && imageModel !== 'gemini-nano-banana-pro') {
        console.log('applyLogo: logo passed to AI directly, skipping composite')
        return url
      }
      try {
        const { compositeLogoOntoImage } = await import('@/lib/watermark')
        const logoPosition = (ctx.raw.brand_logo_position as 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right') || 'bottom-right'
        const logoSize = Math.min(40, Math.max(10, parseInt(ctx.raw.brand_logo_size ?? '25', 10) || 25))
        const composited = await compositeLogoOntoImage(url, logoUrl, {
          position: logoPosition,
          logoMaxWidthPercent: logoSize,
          paddingPercent: 3,
        })
        console.log('applyLogo: logo composited successfully')
        return uploadBase64ToStorage(composited)
      } catch (err) {
        const msg = err instanceof Error ? `${err.message}\n${err.stack}` : String(err)
        console.error('Logo composite failed, using original. Error:', msg, '| imageUrl:', url, '| logoUrl:', logoUrl)
        return url
      }
    }


    const slides = parseSlides(imagePrompt)
    const isMulti = slides.length > 1

    // Rewrite all slide concepts in parallel
    const rewrittenSlides = await Promise.all(slides.map(rewritePrompt))

    const buildPrompt = (base: string) => {
      const correctionDirective = correctionNote ? `\n\nCORRECTION (apply this fix): ${correctionNote}` : ''
      const postImageSize = post.image_size as string | undefined
      const ratioLabel = postImageSize === '1:1' ? 'square (1:1 ratio, equal width and height)'
        : postImageSize === '9:16' ? 'tall portrait (9:16 ratio, much taller than wide)'
        : 'portrait (4:5 ratio, taller than wide)'
      const logoDirective = `- A brand logo image is provided as one of the input images. Place it in the top-left corner of the canvas with ~3% padding from the edges. Scale it proportionally to fit — maintain its original aspect ratio exactly, do not stretch, squash, crop, or distort it. Preserve its exact colors, letterforms, and design — do not stylize, recolor, blur, or modify it in any way.
- The category label (badge/chip/tag) goes on its own line directly below the logo, left-aligned. The category label must not touch or overlap the logo — leave at least 2% of canvas height as a clear gap between the bottom edge of the logo and the top edge of the category label.`
      const canvasFill = `CANVAS & LAYOUT RULES (highest priority — follow exactly):
- Canvas shape: ${ratioLabel}. Distribute elements to fill the full height.
- Pure white #FFFFFF background filling the entire canvas. No floating card, no dark background, no drop shadow, no letterboxing, no rounded outer border.
- Minimum 6% safe-zone padding on all four sides. No element may touch or bleed off the canvas edge.
${logoDirective}
- Leave at least 10% of canvas height as empty white space below the very last element (including footer/CTA). Every element must be fully visible — nothing cut off at the bottom.

CONTENT: ${base}` + correctionDirective
      return canvasFill
    }

    // Map quality for dall-e-3 (only standard/hd)
    const dalle3Quality = quality === 'high' ? 'hd' : 'standard'

    const generate = (prompt: string) => {
      if (imageModel === 'dall-e-3') {
        return generateImageDalle3(prompt, imageSize as '1024x1024' | '1792x1024' | '1024x1792', dalle3Quality)
      }
      if (imageModel === 'gemini-imagen' || imageModel === 'gemini-nano-banana-2' || imageModel === 'gemini-nano-banana-2-lite' || imageModel === 'gemini-nano-banana-pro') {
        const geminiModelMap: Record<string, string> = {
          'gemini-nano-banana-2':      'gemini-3.1-flash-image',
          'gemini-nano-banana-2-lite': 'gemini-3.1-flash-lite-image',
          'gemini-nano-banana-pro':    'gemini-3-pro-image',
          'gemini-imagen':             'gemini-3.1-flash-image', // legacy alias
        }
        return generateImageGemini(prompt, (post.image_size as string) ?? '4:5', geminiModelMap[imageModel] ?? 'gemini-3.1-flash-image')
      }
      // Build reference image list: style reference first, then logo (if available)
      const refs = [referenceUrl, logoUrl].filter(Boolean) as string[]
      if (refs.length > 1) return generateImageWithReferences(prompt, refs, imageSize as '1024x1024' | '1024x1536', quality)
      if (refs.length === 1) return generateImageWithReference(prompt, refs[0], imageSize as '1024x1024' | '1024x1536', quality)
      return generateImage(prompt, imageSize as '1024x1024' | '1024x1536', quality)
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
          : logoUrl
            ? generateImageWithReferences(prompt, [firstRaw, logoUrl], imageSize as '1024x1024' | '1024x1536', quality)
            : generateImageWithReference(prompt, firstRaw, imageSize as '1024x1024' | '1024x1536', quality)
      const remainingRaw = await Promise.all(
        finalPrompts.slice(1).map(generateWithStyle)
      )
      const rawUrls = [firstRaw, ...remainingRaw]
      // Apply logo watermark
      const urls = await Promise.all(rawUrls.map(applyLogo))
      const { data } = await db
        .from('cada_scheduled_posts')
        .update({ status: 'image_review', media_url: urls[0], media_urls: urls, media_type: 'image' })
        .eq('id', id)
        .select()
        .single()
      // Save revision history
      await db.from('cada_image_revisions').insert({
        post_id: id,
        client_id: (post.client_id as string | null) ?? clientId,
        media_url: urls[0],
        media_urls: urls,
        image_model: imageModel,
        prompt_used: finalPrompts.join('\n\n---\n\n'),
        correction_note: correctionNote ?? null,
      })
      return NextResponse.json({ post: data })
    } else {
      const rawUrl = await generate(finalPrompts[0])
      // Apply logo watermark
      const mediaUrl = await applyLogo(rawUrl)
      const { data } = await db
        .from('cada_scheduled_posts')
        .update({ status: 'image_review', media_url: mediaUrl, media_type: 'image' })
        .eq('id', id)
        .select()
        .single()
      // Save revision history
      await db.from('cada_image_revisions').insert({
        post_id: id,
        client_id: (post.client_id as string | null) ?? clientId,
        media_url: mediaUrl,
        media_urls: null,
        image_model: imageModel,
        prompt_used: finalPrompts[0],
        correction_note: correctionNote ?? null,
      })
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
