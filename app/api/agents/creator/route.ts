export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { generateText } from '@/lib/anthropic'
import { generateImage, generateImageWithReference } from '@/lib/openai'
import { generateImageFlux } from '@/lib/fal'
import { runVirtualTryOn } from '@/lib/fashn'
import { uploadFileToDrive } from '@/lib/google'
import { generateVideoRunway, generateVideoRunwayRef } from '@/lib/runway'
import { generateVideoKling } from '@/lib/kling'
import { createDesignFromTemplate } from '@/lib/canva'
import { createServiceClient } from '@/lib/supabase'
import { getBrandContext } from '@/lib/brand'
import type { CreatorInput } from '@/types'

async function uploadMediaToDrive(mediaUrl: string, fileName: string, folderId?: string): Promise<string | null> {
  try {
    let buffer: Buffer
    let mimeType: string
    if (mediaUrl.startsWith('data:')) {
      const [header, b64] = mediaUrl.split(',')
      mimeType = header.match(/:(.*?);/)?.[1] ?? 'image/png'
      buffer = Buffer.from(b64, 'base64')
    } else {
      const res = await fetch(mediaUrl)
      if (!res.ok) return null
      mimeType = res.headers.get('content-type') ?? 'video/mp4'
      buffer = Buffer.from(await res.arrayBuffer())
    }
    return await uploadFileToDrive({ fileName, buffer, mimeType, folderId })
  } catch { return null }
}

const LANG_INSTRUCTION: Record<string, string> = {
  'english':          'Write entirely in English.',
  'bahasa-indonesia': 'Write entirely in Bahasa Indonesia. Use natural, modern Indonesian as spoken by young Muslim women aged 20â€“35.',
  'bahasa-melayu':    'Write entirely in Bahasa Melayu (Malaysian). Use natural, modern Malay as spoken by young Muslim women aged 20â€“35.',
}

const LENGTH_INSTRUCTION: Record<string, string> = {
  short:    'Keep it short and punchy â€” under 80 words (not counting hashtags).',
  standard: 'Write a standard length caption â€” 100 to 180 words (not counting hashtags).',
  long:     'Write a detailed, storytelling caption â€” 200 to 300 words (not counting hashtags).',
}

export async function POST(req: NextRequest) {
  const start = Date.now()
  const body: CreatorInput = await req.json()
  const db = createServiceClient()

  const langNote = LANG_INSTRUCTION[body.language ?? 'english']
  const lenNote  = LENGTH_INSTRUCTION[body.captionLength ?? 'standard']

  const { data: run } = await db
    .from('cada_agent_runs')
    .insert({ agent: 'creator', status: 'running', input: body })
    .select()
    .single()

  const ctx = await getBrandContext()
  const brandName     = ctx.raw.brand_name || 'Your Brand'
  const brandSubject  = ctx.raw.brand_subject_description || ''
  const brandHashtags = ctx.raw.brand_hashtags || ''
  const brandEcommerce = ctx.raw.brand_ecommerce_platform || ''
  const brandIndustry  = ctx.raw.brand_industry || ''
  const SYSTEM_PROMPT = ctx.systemPrompt('Content Creator') + `
You are an expert copywriter specialising in ${brandIndustry} content.
Write content that is warm, elegant, and aspirational. Always output ONLY the requested content — no preamble or meta-commentary.`
  const imgQuality = ctx.imageQuality
  const driveEnabled = ctx.driveEnabled
  const driveFolderId = ctx.driveFolderId

  try {
    let result: Record<string, unknown> = {}

    switch (body.task) {
      case 'caption': {
        const text = await generateText(
          SYSTEM_PROMPT,
          `Write a ${body.platform ?? 'Instagram'} caption for ${brandName}'s product: ${body.product}.
Tone: ${body.tone ?? 'elegant and aspirational'}.
${body.additionalContext ? `IMPORTANT — use the following context to shape the caption's setting, mood, and angle. Do NOT write a generic product description; let the visual reference drive the creative direction:\n${body.additionalContext}\n` : ''}
${langNote}
${lenNote}
Include relevant hashtags at the end (${brandHashtags}).`
        )
        const { data } = await db.from('cada_content_items')
          .insert({ type: 'caption', title: `Caption: ${body.product}`, body: text, tags: [body.platform ?? 'instagram', 'cada'] })
          .select().single()
        result = { text, item: data }
        break
      }

      case 'description': {
        const text = await generateText(
          SYSTEM_PROMPT,
          `Write a ${brandEcommerce} product description for ${brandName}'s product: ${body.product}.
Tone: ${body.tone ?? 'warm and persuasive'}.
${body.additionalContext ?? ''}
${langNote}
${lenNote}
Include: key features, fabric/material benefits, who it's for, how to style it.
End with sizing/care notes placeholder.`
        )
        const { data } = await db.from('cada_content_items')
          .insert({ type: 'description', title: `Description: ${body.product}`, body: text, tags: ['shopee', 'cada'] })
          .select().single()
        result = { text, item: data }
        break
      }

      case 'email': {
        const text = await generateText(
          SYSTEM_PROMPT,
          `Write a promotional email for ${brandName} about: ${body.product ?? body.prompt}.
Tone: ${body.tone ?? 'warm and exclusive'}.
${body.additionalContext ?? ''}
${langNote}
Include:
- Subject line (compelling, under 50 chars)
- Preview text (under 90 chars)
- Full email body with greeting, product highlight, styling tips, and CTA to ${brandEcommerce}`
        )
        const { data } = await db.from('cada_content_items')
          .insert({ type: 'email', title: `Email: ${body.product ?? body.prompt}`, body: text, tags: ['email', 'cada'] })
          .select().single()
        result = { text, item: data }
        break
      }

      case 'image': {
        const subjectPart = brandSubject ? `${brandSubject} wearing ${body.product}` : body.product
        const basePrompt = body.prompt ??
          `High-fashion editorial photo of ${subjectPart} by ${brandName}. ${body.additionalContext ?? ''} Clean studio background, soft natural lighting, elegant and minimalist aesthetic, ${brandIndustry} brand photography style.`

        const dallePrompt = [ctx.imagePrompt, basePrompt].filter(Boolean).join('. ')

        // Choose reference image: user upload > brand context ref (model → style)
        const refImage = body.referenceImageUrl || ctx.referenceImageUrl

        const provider = body.imageProvider ?? 'gpt'
        let imageUrl: string
        if (provider === 'flux') {
          imageUrl = await generateImageFlux(dallePrompt, '1:1')
        } else {
          imageUrl = refImage
            ? await generateImageWithReference(dallePrompt, refImage, '1024x1024', imgQuality)
            : await generateImage(dallePrompt, '1024x1024', imgQuality)
        }
        const driveUrl = driveEnabled ? await uploadMediaToDrive(imageUrl, `cada-image-${Date.now()}.png`, driveFolderId) : null
        const { data } = await db.from('cada_content_items')
          .insert({ type: 'image', title: `Image: ${body.product ?? 'CADA'}`, image_url: imageUrl, drive_url: driveUrl, metadata: { prompt: dallePrompt, provider }, tags: ['image', 'cada', provider] })
          .select().single()
        result = { imageUrl, driveUrl, item: data }
        break
      }

      case 'video': {
        const productDesc = body.product ?? `${brandIndustry} product`
        const videoPrompt = body.prompt ??
          `Cinematic fashion video featuring ${productDesc} by ${brandName}. ${body.additionalContext ?? ''} Elegant movement, soft natural lighting, ${brandIndustry} aesthetic.`
        const duration  = body.videoLength ?? 5
        const provider  = body.videoProvider ?? 'kling'
        const refImage  = body.referenceImageUrl || undefined
        console.log('[video] provider:', provider, 'refImage:', refImage ?? 'NONE')

        // Three independent providers
        const refUrls = body.referenceImageUrls ?? []
        const videoUrl =
          provider === 'kling'       ? await generateVideoKling(videoPrompt, duration, refImage) :
          provider === 'runway-ref'  ? await generateVideoRunwayRef(videoPrompt, refUrls.length > 0 ? refUrls : (refImage ? [refImage] : []), duration) :
                                       await generateVideoRunway(videoPrompt, duration, refImage)
        const videoDriveUrl = driveEnabled ? await uploadMediaToDrive(videoUrl, `cada-video-${Date.now()}.mp4`, driveFolderId) : null
        const { data } = await db.from('cada_content_items')
          .insert({ type: 'video', title: `Video: ${productDesc}`, video_url: videoUrl, drive_url: videoDriveUrl, metadata: { prompt: videoPrompt, duration, provider }, tags: ['video', 'cada', provider] })
          .select().single()
        result = { videoUrl, driveUrl: videoDriveUrl, item: data }
        break
      }

      case 'story': {
        const productDesc = body.product ?? `${brandIndustry} product`
        const storyType = body.videoProvider === 'image' ? 'image' : 'video'

        // Generate story caption (short, punchy, no hashtags)
        const caption = await generateText(
          SYSTEM_PROMPT,
          `Write a very short Instagram Story text overlay for ${brandName}'s product: ${productDesc}.
Tone: ${body.tone ?? 'elegant and aspirational'}.
${body.additionalContext ? `Context: ${body.additionalContext}` : ''}
${LANG_INSTRUCTION[body.language ?? 'english']}
Keep it to 1–2 punchy lines maximum. No hashtags. No long sentences. This is a story overlay — minimal, impactful text only.`
        )

        if (storyType === 'image') {
          const storySubject = brandSubject ? `${brandSubject} wearing ${productDesc}` : productDesc
          const storyBase = body.prompt ??
            `Vertical 9:16 portrait fashion editorial photo of ${storySubject} by ${brandName}. ${body.additionalContext ?? ''} Clean minimalist background, soft natural lighting, elegant aesthetic, full-length portrait shot optimised for Instagram Story format.`
          const imagePrompt = [ctx.imagePrompt, storyBase].filter(Boolean).join('. ')
          const storyRefImage = body.referenceImageUrl || ctx.referenceImageUrl
          const storyImgProvider = body.imageProvider ?? 'gpt'
          const imageUrl = storyImgProvider === 'flux'
            ? await generateImageFlux(imagePrompt, '9:16')
            : storyRefImage
              ? await generateImageWithReference(imagePrompt, storyRefImage, '1024x1536', imgQuality)
              : await generateImage(imagePrompt, '1024x1536', imgQuality)
          const storyImgDriveUrl = driveEnabled ? await uploadMediaToDrive(imageUrl, `cada-story-${Date.now()}.png`, driveFolderId) : null
          const { data } = await db.from('cada_content_items')
            .insert({ type: 'story', title: `Story: ${productDesc}`, image_url: imageUrl, drive_url: storyImgDriveUrl, body: caption, metadata: { prompt: imagePrompt, format: 'story_image' }, tags: ['story', 'instagram', 'cada'] })
            .select().single()
          result = { imageUrl, caption, driveUrl: storyImgDriveUrl, item: data }
        } else {
          const videoPrompt = body.prompt ??
            `Vertical 9:16 cinematic fashion video featuring ${productDesc} by ${brandName}. ${body.additionalContext ?? ''} Portrait orientation, elegant movement, soft natural lighting, ${brandIndustry} aesthetic.`
          const duration = body.videoLength ?? 5
          const provider = body.videoProvider === 'runway' ? 'runway' : 'kling'
          const refImage = body.referenceImageUrl || undefined
          const videoUrl = provider === 'runway'
            ? await generateVideoRunway(videoPrompt, duration, refImage, '720:1280')
            : await generateVideoKling(videoPrompt, duration, refImage)
          const storyVidDriveUrl = driveEnabled ? await uploadMediaToDrive(videoUrl, `cada-story-video-${Date.now()}.mp4`, driveFolderId) : null
          const { data } = await db.from('cada_content_items')
            .insert({ type: 'story', title: `Story Video: ${productDesc}`, video_url: videoUrl, drive_url: storyVidDriveUrl, body: caption, metadata: { prompt: videoPrompt, duration, provider, format: 'story_video' }, tags: ['story', 'instagram', 'cada', provider] })
            .select().single()
          result = { videoUrl, caption, driveUrl: storyVidDriveUrl, item: data }
        }
        break
      }

      case 'tryon': {
        const garmentUrl = body.referenceImageUrl
        const modelUrl = body.referenceImageUrls?.[0]
        if (!garmentUrl || !modelUrl) throw new Error('Both garment image and model image are required')
        const imageUrl = await runVirtualTryOn({ modelImageUrl: modelUrl, garmentImageUrl: garmentUrl })
        const driveUrl = driveEnabled ? await uploadMediaToDrive(imageUrl, `cada-tryon-${Date.now()}.jpg`, driveFolderId) : null
        const { data } = await db.from('cada_content_items')
          .insert({ type: 'tryon', title: `Try-On: ${body.product ?? 'CADA'}`, image_url: imageUrl, drive_url: driveUrl, metadata: { garmentUrl, modelUrl }, tags: ['tryon', 'cada'] })
          .select().single()
        result = { imageUrl, driveUrl, item: data }
        break
      }

      case 'canva':
      case 'canva_template': {
        const design = await createDesignFromTemplate({
          title: `CADA â€” ${body.product ?? body.prompt ?? 'Template'}`,
          designType: 'INSTAGRAM_POST',
        })
        const { data } = await db.from('cada_content_items')
          .insert({ type: 'canva_template', title: `Canva: ${body.product ?? 'CADA Template'}`, canva_url: design.editUrl, metadata: design, tags: ['canva', 'cada'] })
          .select().single()
        result = { design, item: data }
        break
      }
    }

    await db.from('cada_agent_runs').update({ status: 'completed', output: result, duration_ms: Date.now() - start }).eq('id', run!.id)
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    await db.from('cada_agent_runs').update({ status: 'failed', error: msg, duration_ms: Date.now() - start }).eq('id', run!.id)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}

