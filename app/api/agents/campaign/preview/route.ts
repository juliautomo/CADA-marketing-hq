export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { generateText } from '@/lib/anthropic'
import { createServiceClient } from '@/lib/supabase'
import { getBrandContext } from '@/lib/brand'
import { format } from 'date-fns'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, description, startDate, theme, budget, channels, durationWeeks = 4, postsPerWeek = 5 } = body
  const db = createServiceClient()
  const ctx = await getBrandContext()
  const brandName      = ctx.raw.brand_name || 'Your Brand'
  const brandMarkets   = ctx.raw.brand_markets || ''
  const brandEcommerce = ctx.raw.brand_ecommerce_platform || ''
  const SYSTEM_PROMPT = ctx.systemPrompt('Campaign Planner') + `

You are an expert marketing campaign strategist specialising in ${ctx.raw.brand_industry || 'fashion'} brands.
Create detailed, actionable campaign plans tailored to ${brandName}'s channels.
Output structured JSON when asked.`

  const { data: run } = await db
    .from('cada_agent_runs')
    .insert({ agent: 'campaign_planner', status: 'running', input: body })
    .select().single()

  try {
    const start = new Date(startDate)

    const briefText = await generateText(
      SYSTEM_PROMPT,
      `Create a detailed ${durationWeeks}-week marketing campaign for ${brandName}:

Campaign: "${name}"
Description: ${description}
Theme: ${theme ?? `${ctx.raw.brand_industry || 'fashion'} collection launch`}
Budget: ${budget ?? 'not specified'}
Channels: ${(channels ?? ['Instagram', brandEcommerce]).join(', ')}
Start date: ${format(start, 'MMMM d, yyyy')}
Duration: ${durationWeeks} weeks
Posting frequency: ${postsPerWeek} posts per week
Markets: ${brandMarkets}

Generate exactly ${durationWeeks} weeks in the "weeks" array.
Each week should have ${Math.ceil(postsPerWeek / 5)} to ${Math.ceil(postsPerWeek / 3)} milestones that reflect the posting frequency.
Milestones should be specific content pieces or campaign activities (e.g. "Instagram carousel: product launch", "TikTok unboxing video", "Email newsletter to subscribers").

IMPORTANT: Output ONLY raw JSON. No markdown. No code blocks. No backticks. Start your response with { and end with }.

{
  "summary": "2-3 sentence campaign overview tailored to ${brandName}",
  "objective": "primary campaign objective",
  "kpis": ["kpi1", "kpi2", "kpi3"],
  "weeks": [
    {
      "week": 1,
      "theme": "week theme",
      "milestones": [
        { "title": "milestone title", "day_offset": 0, "description": "brief description" }
      ]
    }
  ]
}`
    )

    let brief: Record<string, unknown> = {}
    try {
      const clean = briefText.replace(/```json\n?/gi, '').replace(/```\n?/g, '')
      const match = clean.match(/\{[\s\S]*\}/)
      if (match) brief = JSON.parse(match[0])
    } catch { /* use empty brief */ }

    await db.from('cada_agent_runs').update({ status: 'completed', output: { brief } }).eq('id', run!.id)
    return NextResponse.json({ success: true, brief, briefText })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    await db.from('cada_agent_runs').update({ status: 'failed', error: msg }).eq('id', run!.id)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
