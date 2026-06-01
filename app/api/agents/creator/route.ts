import { NextRequest, NextResponse } from 'next/server'
import { generateText } from '@/lib/anthropic'
import { generateImage } from '@/lib/openai'
import { generateVideo } from '@/lib/runway'
import { createDesignFromTemplate } from '@/lib/canva'
import { createServiceClient } from '@/lib/supabase'
import { getBrandSystemPrompt } from '@/lib/brand'
import type { CreatorInput } from '@/types'

const SYSTEM_PROMPT = getBrandSystemPrompt('Content Creator') + `
You are an expert copywriter specialising in modest fashion content for Indonesian and Singaporean Muslim women.
Write content that is warm, elegant, and aspirational. Always output ONLY the requested content — no preamble or meta-commentary.`

const LANG_INSTRUCTION: Record<string, string> = {
  'english':          'Write entirely in English.',
  'bahasa-indonesia': 'Write entirely in Bahasa Indonesia. Use natural, modern Indonesian as spoken by young Muslim women aged 20–35.',
  'bahasa-melayu':    'Write entirely in Bahasa Melayu (Malaysian). Use natural, modern Malay as spoken by young Muslim women aged 20–35.',
}

const LENGTH_INSTRUCTION: Record<string, string> = {
  short:    'Keep it short and punchy — under 80 words (not counting hashtags).',
  standard: 'Write a standard length caption — 100 to 180 words (not counting hashtags).',
  long:     'Write a detailed, storytelling caption — 200 to 300 words (not counting hashtags).',
}

export async function POST(req: NextRequest) {
  const start = Date.now()
  const body: CreatorInput = await req.json()
  const db = createServiceClient()

  const langNote = LANG_INSTRUCTION[body.language ?? 'english']
  const lenNote  = LENGTH_INSTRUCTION[body.captionLength ?? 'standard']

  const { data: run } = await db
    .from('agent_runs')
    .insert({ agent: 'creator', status: 'running', input: body })
    .select()
    .single()

  try {
    let result: Record<string, unknown> = {}

    switch (body.task) {
      case 'caption': {
        const text = await generateText(
          SYSTEM_PROMPT,
          `Write a ${body.platform ?? 'Instagram'} caption for CADA's product: ${body.product}.
Tone: ${body.tone ?? 'elegant and aspirational'}.
${body.additionalContext ?? ''}
${langNote}
${lenNote}
Include relevant hashtags at the end (#CADA #wearcada #modestfashion etc).
The caption should appeal to Muslim women in Indonesia/Singapore aged 20–35.`
        )
        const { data } = await db.from('content_items')
          .insert({ type: 'caption', title: `Caption: ${body.product}`, body: text, tags: [body.platform ?? 'instagram', 'cada'] })
          .select().single()
        result = { text, item: data }
        break
      }

      case 'description': {
        const text = await generateText(
          SYSTEM_PROMPT,
          `Write a Shopee product description for CADA's product: ${body.product}.
Tone: ${body.tone ?? 'warm and persuasive'}.
${body.additionalContext ?? ''}
${langNote}
${lenNote}
Include: key features, fabric/material benefits, who it's for, how to style it.
End with sizing/care notes placeholder.`
        )
        const { data } = await db.from('content_items')
          .insert({ type: 'description', title: `Description: ${body.product}`, body: text, tags: ['shopee', 'cada'] })
          .select().single()
        result = { text, item: data }
        break
      }

      case 'email': {
        const text = await generateText(
          SYSTEM_PROMPT,
          `Write a promotional email for CADA about: ${body.product ?? body.prompt}.
Tone: ${body.tone ?? 'warm and exclusive'}.
${body.additionalContext ?? ''}
${langNote}
Include:
- Subject line (compelling, under 50 chars)
- Preview text (under 90 chars)
- Full email body with greeting, product highlight, styling tips, and CTA to Shopee/TikTok shop`
        )
        const { data } = await db.from('content_items')
          .insert({ type: 'email', title: `Email: ${body.product ?? body.prompt}`, body: text, tags: ['email', 'cada'] })
          .select().single()
        result = { text, item: data }
        break
      }

      case 'image': {
        const dallePrompt = body.prompt ??
          `High-fashion editorial photo of a Muslim woman wearing ${body.product} by CADA modest fashion brand. She is wearing a hijab. ${body.additionalContext ?? ''} Clean studio background, soft natural lighting, elegant and minimalist aesthetic, Indonesian fashion brand photography style.`
        const imageUrl = await generateImage(dallePrompt)
        const { data } = await db.from('content_items')
          .insert({ type: 'image', title: `Image: ${body.product ?? 'CADA'}`, image_url: imageUrl, metadata: { prompt: dallePrompt }, tags: ['image', 'cada'] })
          .select().single()
        result = { imageUrl, item: data }
        break
      }

      case 'video': {
        const videoPrompt = body.prompt ??
          `Cinematic fashion video of a Muslim woman in hijab wearing ${body.product} by CADA. Elegant slow motion, soft lighting, modest fashion aesthetic, clean background.`
        const duration = body.videoLength ?? 5
        const videoUrl = await generateVideo(videoPrompt, duration)
        const { data } = await db.from('content_items')
          .insert({ type: 'video', title: `Video: ${body.product ?? 'CADA'}`, video_url: videoUrl, metadata: { prompt: videoPrompt, duration }, tags: ['video', 'cada'] })
          .select().single()
        result = { videoUrl, item: data }
        break
      }

      case 'canva':
      case 'canva_template': {
        const design = await createDesignFromTemplate({
          title: `CADA — ${body.product ?? body.prompt ?? 'Template'}`,
          designType: 'INSTAGRAM_POST',
        })
        const { data } = await db.from('content_items')
          .insert({ type: 'canva_template', title: `Canva: ${body.product ?? 'CADA Template'}`, canva_url: design.editUrl, metadata: design, tags: ['canva', 'cada'] })
          .select().single()
        result = { design, item: data }
        break
      }
    }

    await db.from('agent_runs').update({ status: 'completed', output: result, duration_ms: Date.now() - start }).eq('id', run!.id)
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    await db.from('agent_runs').update({ status: 'failed', error: msg, duration_ms: Date.now() - start }).eq('id', run!.id)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
