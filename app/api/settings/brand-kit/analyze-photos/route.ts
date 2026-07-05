export const dynamic = 'force-dynamic'
export const maxDuration = 60
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getBrandContext } from '@/lib/brand'
import { createServiceClient } from '@/lib/supabase'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST() {
  try {
    const db = createServiceClient()
    const ctx = await getBrandContext()
    const brandName = ctx.raw.brand_name || 'Your Brand'
    const brandIndustry = ctx.raw.brand_industry || ''

    // Fetch photos from library
    const { data: photos, error } = await db
      .from('cada_brand_photos')
      .select('url')
      .order('created_at', { ascending: false })
    if (error) throw error
    if (!photos || photos.length === 0) return NextResponse.json({ error: 'No photos in library. Add some photos first.' }, { status: 400 })

    // Download and convert to base64
    const imageBlocks: Anthropic.ImageBlockParam[] = (
      await Promise.all(
        photos.map(async (p) => {
          try {
            const res = await fetch(p.url)
            const buffer = await res.arrayBuffer()
            const b64 = Buffer.from(buffer).toString('base64')
            return {
              type: 'image' as const,
              source: { type: 'base64' as const, media_type: 'image/jpeg' as const, data: b64 },
            }
          } catch { return null }
        })
      )
    ).filter(Boolean) as Anthropic.ImageBlockParam[]

    if (!imageBlocks.length) throw new Error('Could not load photos from library')

    const message = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1500,
      system: `You are a professional brand consultant and AI image generation expert.
You analyze brand photo libraries to extract consistent visual DNA that can be used as generation prompts for AI image tools like Flux and DALL-E.`,
      messages: [{
        role: 'user',
        content: [
          ...imageBlocks,
          {
            type: 'text',
            text: `I've uploaded ${imageBlocks.length} photos from a ${brandIndustry} brand called ${brandName}. Analyze ALL of them together to identify the consistent visual patterns, aesthetic, and style that defines this brand.

Return ONLY valid JSON with this exact shape (no markdown, no explanation):
{
  "style_prefix": "A concise photography style description for AI image generation — cover lighting quality, background style, overall mood and aesthetic. 15-30 words.",
  "color_description": "Describe the dominant color palette in words suitable for AI prompts — name the colors descriptively, not as hex codes. 15-25 words.",
  "brand_colors": ["#RRGGBB", "#RRGGBB", "#RRGGBB", "#RRGGBB", "#RRGGBB"],
  "shot_style": "Camera angle, framing, focal length feel, and technical photography style. 10-20 words.",
  "negative_prompts": "Comma-separated list of things consistently absent from these photos that should be excluded from AI generation. 10-15 items.",
  "summary": "A 2-sentence human-readable summary of what you observed about this brand's visual identity."
}

For brand_colors: extract 3–6 dominant hex color codes actually observed in the photos. Return real hex values, not placeholders.`,
          },
        ],
      }],
    })

    const text = message.content.find(b => b.type === 'text')
    if (!text || text.type !== 'text') throw new Error('No response from Claude')

    const jsonMatch = text.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Could not parse analysis result')

    const analysis = JSON.parse(jsonMatch[0])

    // Save to history
    try {
      await db.from('cada_brand_kit_analyses').insert({
        thumbnail_url: photos[0]?.url ?? null,
        photo_count: imageBlocks.length,
        summary: analysis.summary,
        style_prefix: analysis.style_prefix,
        color_description: analysis.color_description,
        brand_colors: analysis.brand_colors,
        shot_style: analysis.shot_style,
        negative_prompts: analysis.negative_prompts,
      })
    } catch { /* history optional */ }

    return NextResponse.json({ ok: true, analysis })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Analysis failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
