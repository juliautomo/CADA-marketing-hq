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

  // Detect graphic/infographic intent — these need design mode, not photography mode
  const graphicKeywords = /infographic|list|tips|steps|slide|card|poster|education|edukasi|layout|graphic|icon|numbered|carousel|template|text overlay|headline/i
  const isGraphic = graphicKeywords.test(prompt)

  const format = isStory
    ? 'vertical 9:16 portrait Instagram Story'
    : isGraphic
    ? `square social media graphic for ${brandName}`
    : `square editorial ${brandIndustry} photo`

  const subjectHint = brandSubject ? `featuring ${brandSubject} for ${brandName}` : `for ${brandName} (${brandIndustry})`

  const brandColors = ctx.raw.brand_colors ? (JSON.parse(ctx.raw.brand_colors) as string[]).join(', ') : 'brand palette'
  const brandHandle = ctx.raw.brand_handle ? `@${ctx.raw.brand_handle}` : brandName
  const brandVoice  = ctx.raw.brand_voice || ''

  const systemPrompt = isGraphic
    ? `You are an expert graphic design prompt engineer creating social media infographics for a ${brandIndustry} brand called ${brandName}.
Your job is to take a rough layout idea and rewrite it as a detailed image generation prompt for a clean, modern flat-design graphic — NOT a photograph.
The design should feel appropriate for the ${brandIndustry} industry: use the right visual tone, typography style, and layout conventions for that space.
Output ONLY the improved prompt — no explanation, no preamble, no quotes.`
    : `You are an expert AI image prompt engineer specialising in ${brandIndustry} content for Instagram.
Your job is to take a rough scene idea and rewrite it as a detailed, photorealistic image generation prompt.
Output ONLY the improved prompt — no explanation, no preamble, no quotes.`

  const rules = isGraphic
    ? `RULES:
- This is a GRAPHIC DESIGN prompt, not a photography prompt — do NOT add camera, lens, or photography terms
- Keep ALL content details the user mentioned (titles, list items, numbers, text)
- ADD: precise layout description, typography style suited to ${brandIndustry} (e.g. bold serif headline, clean sans-serif body), color scheme using brand colors (${brandColors}), icon/illustration style, spacing and visual hierarchy
- Include a small brand footer area showing "${brandHandle}" in the brand colors
- The overall aesthetic should feel on-brand for a ${brandIndustry} brand${brandVoice ? ` with a ${brandVoice} tone` : ''}
- It's fine to use dark backgrounds, bold colors, or strong contrast if the design calls for it
- Keep it under 150 words
- Output only the improved prompt, no explanation`
    : `RULES:
- Keep ALL specific details the user mentioned (location, pose, props, framing, zoom level, product details) — do NOT remove or contradict them
- Only ADD: precise lighting description, camera lens (e.g. 85mm f/1.8), photography style, texture detail, mood/atmosphere
- Keep it under 130 words
- Output only the improved prompt, no explanation`

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: `Enhance this image prompt for a ${format} ${subjectHint}.

${rules}

Original prompt: ${prompt}`,
    }],
  })

  const block = message.content[0]
  const enhanced = block.type === 'text' ? block.text.trim() : prompt
  return NextResponse.json({ enhanced })
}
