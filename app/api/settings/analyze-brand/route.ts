export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const EXTRACT_PROMPT = (content: string) => `You are analyzing a brand's content to extract brand context for a marketing AI system.

Content:
${content}

Extract and return a JSON object with these exact keys (leave value as empty string "" if not found):
{
  "brand_name": "The brand's name",
  "brand_handle": "Social media handle or username if mentioned",
  "brand_description": "1–2 sentence overview of what the brand sells and who it's for",
  "brand_voice": "Voice, tone, personality. Language style, words they use, words to avoid. 3–5 sentences.",
  "brand_target_customer": "Who the target customer is — age, lifestyle, values, location. 2–3 sentences.",
  "brand_guidelines": "Content rules: what to show/not show, hashtags used, platform preferences, pricing format. 3–5 sentences.",
  "brand_caption_examples": "2–3 example captions in the brand's voice, written based on what you observed.",
  "brand_campaign_theme": "A suggested campaign theme based on current products, promotions, or seasonal focus. 2–3 sentences.",
  "brand_industry": "The industry or niche (e.g. fashion, skincare, F&B)",
  "brand_markets": "Markets or regions served if mentioned",
  "brand_channels": "Sales or marketing channels if mentioned",
  "brand_ecommerce_platform": "Primary e-commerce platform if mentioned"
}

Return ONLY valid JSON, no explanation.`

export async function POST(req: NextRequest) {
  const { url, text: rawText } = await req.json()

  let content = ''

  if (url) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MarketingHQBot/1.0)' },
        signal: AbortSignal.timeout(10000),
      })
      const html = await res.text()
      content = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 8000)
    } catch (err) {
      return NextResponse.json({ error: `Could not fetch URL: ${err instanceof Error ? err.message : String(err)}` }, { status: 400 })
    }
  } else if (rawText) {
    content = String(rawText).trim().slice(0, 8000)
  } else {
    return NextResponse.json({ error: 'Provide either a URL or text to analyze' }, { status: 400 })
  }

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{ role: 'user', content: EXTRACT_PROMPT(content) }],
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text : ''
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON found')
    const parsed = JSON.parse(jsonMatch[0])
    // Strip empty strings so they don't overwrite existing values
    const filtered = Object.fromEntries(Object.entries(parsed).filter(([, v]) => v !== ''))
    return NextResponse.json({ brand: filtered })
  } catch {
    return NextResponse.json({ error: 'Could not parse AI response', raw }, { status: 500 })
  }
}
