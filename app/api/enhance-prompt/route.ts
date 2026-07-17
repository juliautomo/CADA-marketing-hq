export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getBrandContext } from '@/lib/brand'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(req: NextRequest) {
  const { prompt, task } = await req.json()
  if (!prompt) return NextResponse.json({ error: 'No prompt provided' }, { status: 400 })

  const clientId = req.headers.get('x-client-id') ?? null
  const ctx = await getBrandContext(clientId)
  const brandName     = ctx.raw.brand_name || 'Your Brand'
  const brandSubject  = ctx.raw.brand_subject_description || ''
  const brandIndustry = ctx.raw.brand_industry || 'brand'

  const isStory = task === 'story'
  const format = isStory ? 'vertical 9:16 portrait Instagram Story' : `square editorial ${brandIndustry} photo`
  const subjectHint = brandSubject ? `featuring ${brandSubject} for ${brandName}` : `for ${brandName} (${brandIndustry})`

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    system: `You are an expert AI image prompt engineer specialising in ${brandIndustry} content for Instagram.
Your job is to take a rough scene idea and rewrite it as a detailed, photorealistic image generation prompt.
Output ONLY the improved prompt — no explanation, no preamble, no quotes.`,
    messages: [{
      role: 'user',
      content: `Enhance this image prompt for a ${format} ${subjectHint}.

RULES:
- Keep ALL specific details the user mentioned (location, pose, props, framing, zoom level, product details) — do NOT remove or contradict them
- Only ADD: precise lighting description, camera lens (e.g. 85mm f/1.8), photography style, texture detail, mood/atmosphere
- Keep it under 130 words
- Output only the improved prompt, no explanation

Original prompt: ${prompt}`,
    }],
  })

  const block = message.content[0]
  const enhanced = block.type === 'text' ? block.text.trim() : prompt
  return NextResponse.json({ enhanced })
}
