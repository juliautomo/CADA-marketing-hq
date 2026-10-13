export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getBrandContext } from '@/lib/brand'
import { getClientIdFromRequest } from '@/lib/get-client-id'

let _client: Anthropic | null = null
function getClient() {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY!, baseURL: 'https://api.anthropic.com' })
  return _client
}

export async function POST(req: NextRequest) {
  const { imageUrl } = await req.json()
  if (!imageUrl) return NextResponse.json({ success: false, error: 'imageUrl required' }, { status: 400 })

  const clientId = getClientIdFromRequest(req)
  const ctx = await getBrandContext(clientId)
  const raw = ctx.raw

  const brandProfile = [
    raw.brand_name        && `Brand: ${raw.brand_name}`,
    raw.brand_industry    && `Industry: ${raw.brand_industry}`,
    raw.brand_style_prefix && `Visual style: ${raw.brand_style_prefix}`,
    raw.brand_color_description && `Brand colors: ${raw.brand_color_description}`,
    raw.brand_shot_style  && `Composition/shot style: ${raw.brand_shot_style}`,
    raw.brand_negative_prompts && `Must avoid: ${raw.brand_negative_prompts}`,
    raw.brand_values      && `Brand values: ${raw.brand_values}`,
    raw.brand_tone        && `Tone/personality: ${raw.brand_tone}`,
  ].filter(Boolean).join('\n')

  const system = `You are a brand compliance reviewer for a fashion/lifestyle brand. You score generated marketing images against the brand's visual identity.

BRAND PROFILE:
${brandProfile || 'No brand profile configured — score based on general fashion marketing best practices.'}

Score the image out of 100 across four dimensions. Be honest and specific. Return ONLY valid JSON.`

  let message: Anthropic.Message
  try {
    message = await getClient().messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 800,
    system,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'url', url: imageUrl } },
        {
          type: 'text',
          text: `Score this image for brand fit. Return ONLY this JSON:
{
  "score": <overall 0-100>,
  "pass": <true if score >= 70>,
  "summary": "one sentence verdict",
  "breakdown": {
    "colors": { "score": <0-100>, "note": "brief note" },
    "style": { "score": <0-100>, "note": "brief note" },
    "composition": { "score": <0-100>, "note": "brief note" },
    "brandFit": { "score": <0-100>, "note": "brief note" }
  },
  "topIssue": "the single most important thing to fix, or null if it passes"
}`,
        },
      ],
    }],
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: `Vision API error: ${msg}` }, { status: 500 })
  }

  const text = (message.content[0] as { type: string; text: string }).text
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return NextResponse.json({ success: false, error: 'Could not parse brand check result' }, { status: 500 })

  try {
    const result = JSON.parse(match[0])
    result.pass = (result.score ?? 0) >= 70
    return NextResponse.json({ success: true, result })
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON from model' }, { status: 500 })
  }
}
