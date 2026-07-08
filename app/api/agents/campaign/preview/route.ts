export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { generateText } from '@/lib/anthropic'
import { createServiceClient } from '@/lib/supabase'
import { getBrandContext } from '@/lib/brand'
import { format, addDays } from 'date-fns'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, description, startDate, theme, budget, channels, durationWeeks = 4, postsPerWeek = 5, products = [] } = body
  const db = createServiceClient()
  const ctx = await getBrandContext()
  const brandName    = ctx.raw.brand_name || 'Your Brand'
  const brandMarkets = ctx.raw.brand_markets || ''
  const brandIndustry = ctx.raw.brand_industry || 'fashion'
  const totalPosts   = durationWeeks * postsPerWeek
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const productLines = (products as any[]).map((p: any) =>
    `- ${p.name}${p.category ? ` (${p.category})` : ''}${p.price ? ` · ${p.price}` : ''}${p.description ? `: ${p.description}` : ''}`
  ).join('\n')

  const SYSTEM_PROMPT = ctx.systemPrompt('Campaign Planner') + `
You are an expert marketing campaign strategist specialising in ${brandIndustry} brands.
Generate specific, actionable content calendars with exact post types and dates.
Output structured JSON when asked.`

  const { data: run } = await db
    .from('cada_agent_runs')
    .insert({ agent: 'campaign_planner', status: 'running', input: body })
    .select().single()

  try {
    const start = new Date(startDate)
    const end = addDays(start, durationWeeks * 7 - 1)

    const allowedTypes = ['image', 'video', 'caption', 'story', 'email']
    const allowedChannels = channels?.length ? channels : ['Instagram']

    const briefText = await generateText(
      SYSTEM_PROMPT,
      `Create a content calendar for ${brandName}:

Campaign: "${name}"
Description: ${description}
Theme: ${theme ?? `${brandIndustry} collection launch`}
Budget: ${budget ?? 'not specified'}
Channels: ${allowedChannels.join(', ')}
${productLines ? `Products to feature:\n${productLines}\n\nEach post title should reference a specific product by name.` : ''}
Start date: ${format(start, 'MMMM d, yyyy')}
End date: ${format(end, 'MMMM d, yyyy')}
Duration: ${durationWeeks} weeks
Posts per week: ${postsPerWeek} (total ${totalPosts} posts)
Markets: ${brandMarkets}

Generate exactly ${totalPosts} posts spread across ${durationWeeks} weeks.
Each post must have a specific date, platform, content type, and title.
Content types allowed: ${allowedTypes.join(', ')}
Platforms must be from the campaign channels: ${allowedChannels.join(', ')}

Spread posts evenly. For postsPerWeek=${postsPerWeek}, space them ${Math.round(7 / postsPerWeek)} days apart within each week.

IMPORTANT: Output ONLY raw JSON. No markdown. No code blocks. Start with { end with }.

{
  "summary": "2-3 sentence campaign overview",
  "objective": "primary campaign objective",
  "kpis": ["kpi1", "kpi2", "kpi3"],
  "weeks": [
    {
      "week": 1,
      "theme": "week theme",
      "posts": [
        {
          "day_offset": 0,
          "platform": "Instagram",
          "content_type": "image",
          "title": "Specific post title",
          "description": "What this post should show/say"
        }
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
