export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getBrandContext } from '@/lib/brand'
import { createServiceClient } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  const { imageUrl, language = 'english', captionLength = 'standard' } = await req.json()

  if (!imageUrl) return NextResponse.json({ error: 'imageUrl required' }, { status: 400 })

  const clientId = req.headers.get('x-client-id') ?? null
  const ctx = await getBrandContext(clientId)
  const brandName = ctx.raw.brand_name || 'Your Brand'
  const brandHashtags = ctx.raw.brand_hashtags || ''
  const brandIndustry = ctx.raw.brand_industry || ''

  const LANG_INSTRUCTION: Record<string, string> = {
    'english':          'Write entirely in English.',
    'bahasa-indonesia': 'Write entirely in Bahasa Indonesia. Use natural, modern Indonesian.',
    'bahasa-melayu':    'Write entirely in Bahasa Melayu (Malaysian).',
  }

  const LENGTH_INSTRUCTION: Record<string, string> = {
    short:    'Keep it short and punchy — under 80 words (not counting hashtags).',
    standard: 'Write a standard length caption — 100 to 180 words (not counting hashtags).',
    long:     'Write a detailed, storytelling caption — 200 to 300 words (not counting hashtags).',
  }

  const systemPrompt = ctx.systemPrompt('Content Creator') + `
You are an expert copywriter specialising in ${brandIndustry} content for ${brandName}.
Write content that matches the brand voice. Output ONLY the caption — no preamble or meta-commentary.`

  const userPrompt = `Look at this image and write an Instagram caption for ${brandName}.
${LANG_INSTRUCTION[language] ?? LANG_INSTRUCTION['english']}
${LENGTH_INSTRUCTION[captionLength] ?? LENGTH_INSTRUCTION['standard']}
Include relevant hashtags at the end (${brandHashtags}).`

  let imageData: { type: 'base64'; media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'; data: string } | null = null

  try {
    const res = await fetch(imageUrl)
    if (res.ok) {
      const buffer = await res.arrayBuffer()
      const contentType = res.headers.get('content-type') ?? 'image/jpeg'
      const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
      const mediaType = validTypes.includes(contentType) ? contentType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' : 'image/jpeg'
      imageData = {
        type: 'base64',
        media_type: mediaType,
        data: Buffer.from(buffer).toString('base64'),
      }
    }
  } catch { /* fall through to text-only */ }

  const message = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: imageData
        ? [{ type: 'image', source: imageData }, { type: 'text', text: userPrompt }]
        : [{ type: 'text', text: userPrompt }],
    }],
  })

  const caption = message.content[0].type === 'text' ? message.content[0].text : ''

  const db = createServiceClient()
  await db.from('cada_content_items').insert({
    type: 'caption',
    title: `Caption from image`,
    body: caption,
    image_url: imageUrl,
    tags: ['instagram', 'caption', 'from-image'],
    client_id: clientId,
  })

  return NextResponse.json({ caption })
}
