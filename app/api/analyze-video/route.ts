import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getBrandContext } from '@/lib/brand'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export interface VideoAnalysis {
  description: string       // What's happening in the video
  product: string           // Main garment / product shown
  colors: string[]          // Dominant colors
  mood: string              // Aesthetic mood / vibe
  setting: string           // Where it's filmed (studio, outdoor, etc.)
  captionAngle: string      // Best hook/angle for a caption
  captions: {
    instagram: string       // Ready-to-post Instagram caption with hashtags
    tiktok: string          // Ready-to-post TikTok caption with hashtags
  }
  contentIdeas: string[]    // 3 additional content ideas from this video
}

export async function POST(req: NextRequest) {
  const ctx = await getBrandContext()
  const brandName = ctx.raw.brand_name || 'Your Brand'
  const brandIndustry = ctx.raw.brand_industry || 'fashion'
  const SYSTEM = ctx.systemPrompt('Fashion Video Analyst') + `
You analyse fashion video frames to extract styling insights and generate social media captions for ${brandName}.
You will receive multiple frames from a short video — treat them as a sequence to understand what's happening.`

  try {
    const { frames, platform, tone } = await req.json() as {
      frames: string[]          // base64 jpeg frames
      platform?: string
      tone?: string
    }

    if (!frames || frames.length === 0) {
      return NextResponse.json({ error: 'No frames provided' }, { status: 400 })
    }

    // Build image blocks from frames
    const imageBlocks: Anthropic.ImageBlockParam[] = frames.map((f) => ({
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/jpeg',
        data: f,
      },
    }))

    const message = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2000,
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: [
            ...imageBlocks,
            {
              type: 'text',
              text: `These are ${frames.length} frames extracted from a short ${brandIndustry} video for ${brandName}.
Platform preference: ${platform ?? 'Instagram & TikTok'}
Tone: ${tone ?? 'Aspirational'}

Analyse the video frames and return ONLY valid JSON matching this exact shape:
{
  "description": "What is happening in this video — movement, styling, setting",
  "product": "The main garment or product being shown",
  "colors": ["color1", "color2"],
  "mood": "The aesthetic mood and vibe",
  "setting": "Where it's filmed",
  "captionAngle": "The strongest hook or angle for a social media caption",
  "captions": {
    "instagram": "Full ready-to-post Instagram caption with emojis and hashtags (max 2200 chars)",
    "tiktok": "Full ready-to-post TikTok caption with trending hashtags (punchy, max 300 chars)"
  },
  "contentIdeas": ["idea 1", "idea 2", "idea 3"]
}`,
            },
          ],
        },
      ],
    })

    const text = message.content.find((b) => b.type === 'text')
    if (!text || text.type !== 'text') throw new Error('No response from Claude')

    const jsonMatch = text.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Could not parse response')

    const analysis = JSON.parse(jsonMatch[0]) as VideoAnalysis
    return NextResponse.json({ success: true, analysis })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Analysis failed'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
