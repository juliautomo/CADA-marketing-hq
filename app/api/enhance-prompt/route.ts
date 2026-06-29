export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(req: NextRequest) {
  const { prompt, task } = await req.json()
  if (!prompt) return NextResponse.json({ error: 'No prompt provided' }, { status: 400 })

  const isStory = task === 'story'
  const format = isStory ? 'vertical 9:16 portrait Instagram Story' : 'square editorial fashion photo'

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    system: `You are an expert AI image prompt engineer specialising in modest fashion photography for Instagram.
Your job is to take a rough scene idea and rewrite it as a detailed, photorealistic image generation prompt.
Output ONLY the improved prompt — no explanation, no preamble, no quotes.`,
    messages: [{
      role: 'user',
      content: `Rewrite this rough idea into a detailed image prompt for a ${format} of a Muslim woman in hijab wearing CADA modest fashion clothing.
Include: specific lighting (golden hour / soft studio / natural window light), camera angle, background setting, fabric texture details, mood, and photographic style (editorial, lifestyle, etc).
Keep it under 120 words.

Rough idea: ${prompt}`,
    }],
  })

  const block = message.content[0]
  const enhanced = block.type === 'text' ? block.text.trim() : prompt
  return NextResponse.json({ enhanced })
}
