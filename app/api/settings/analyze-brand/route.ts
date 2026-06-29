export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const { url } = await req.json()
  if (!url) return NextResponse.json({ error: 'URL required' }, { status: 400 })

  // Fetch the page
  let html = ''
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CADABot/1.0)' },
      signal: AbortSignal.timeout(10000),
    })
    html = await res.text()
  } catch (err) {
    return NextResponse.json({ error: `Could not fetch URL: ${err instanceof Error ? err.message : String(err)}` }, { status: 400 })
  }

  // Strip HTML tags, keep readable text
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 8000)

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `You are analyzing a fashion brand's website to extract brand context for a marketing AI system.

Website content:
${text}

Extract and return a JSON object with these exact keys:
{
  "brand_voice": "Description of brand voice, tone, personality. Language style, words they use, words to avoid. 3-5 sentences.",
  "brand_target_customer": "Who the target customer is — age, lifestyle, values, location, what they care about. 2-3 sentences.",
  "brand_guidelines": "Content rules: what to show/not show, hashtags used, platform preferences, pricing format if mentioned. 3-5 sentences.",
  "brand_caption_examples": "2-3 example captions in the brand's voice, written based on what you observed from the website copy and tone.",
  "brand_campaign_theme": "A suggested campaign theme based on current products, promotions, or seasonal focus visible on the website. 2-3 sentences describing what to push right now and how."
}

Return ONLY valid JSON, no explanation.`,
    }],
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text : ''
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON found')
    const parsed = JSON.parse(jsonMatch[0])
    return NextResponse.json({ brand: parsed })
  } catch {
    return NextResponse.json({ error: 'Could not parse AI response', raw }, { status: 500 })
  }
}
