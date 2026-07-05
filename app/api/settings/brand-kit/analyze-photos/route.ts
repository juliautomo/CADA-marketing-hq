export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getBrandContext } from '@/lib/brand'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(req: NextRequest) {
  try {
    const ctx = await getBrandContext()
    const brandName    = ctx.raw.brand_name || 'Your Brand'
    const brandIndustry = ctx.raw.brand_industry || ''
    const formData = await req.formData()
    const files = formData.getAll('photos') as File[]

    if (!files.length) return NextResponse.json({ error: 'No photos provided' }, { status: 400 })
    if (files.length > 20) return NextResponse.json({ error: 'Maximum 20 photos' }, { status: 400 })

    // Convert all files to base64 image blocks for Claude Vision
    const imageBlocks: Anthropic.ImageBlockParam[] = await Promise.all(
      files.map(async (file) => {
        const buffer = await file.arrayBuffer()
        const b64 = Buffer.from(buffer).toString('base64')
        const mediaType = (file.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp'
        return {
          type: 'image' as const,
          source: { type: 'base64' as const, media_type: mediaType, data: b64 },
        }
      })
    )

    // Send all images to Claude at once for holistic brand analysis
    const message = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1500,
      system: `You are a professional brand consultant and AI image generation expert specializing in modest fashion photography.
You analyze brand photo libraries to extract consistent visual DNA that can be used as generation prompts for AI image tools like Flux and DALL-E.`,
      messages: [
        {
          role: 'user',
          content: [
            ...imageBlocks,
            {
              type: 'text',
              text: `I've uploaded ${files.length} photos from a ${brandIndustry} brand called ${brandName}. Analyze ALL of them together to identify the consistent visual patterns, aesthetic, and style that defines this brand.

Return ONLY valid JSON with this exact shape (no markdown, no explanation):
{
  "style_prefix": "A concise photography style description for AI image generation — cover lighting quality, background style, overall mood and aesthetic. 15-30 words.",
  "color_description": "Describe the dominant color palette in words suitable for AI prompts — name the colors descriptively, not as hex codes. 15-25 words.",
  "shot_style": "Camera angle, framing, focal length feel, and technical photography style. 10-20 words.",
  "negative_prompts": "Comma-separated list of things consistently absent from these photos that should be excluded from AI generation. 10-15 items.",
  "summary": "A 2-sentence human-readable summary of what you observed about this brand's visual identity."
}`,
            },
          ],
        },
      ],
    })

    const text = message.content.find(b => b.type === 'text')
    if (!text || text.type !== 'text') throw new Error('No response from Claude')

    const jsonMatch = text.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Could not parse analysis result')

    const analysis = JSON.parse(jsonMatch[0])
    return NextResponse.json({ ok: true, analysis })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Analysis failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
