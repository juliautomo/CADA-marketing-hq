export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { generateText } from '@/lib/anthropic'
import { createServiceClient } from '@/lib/supabase'
import { getBrandContext } from '@/lib/brand'
import { addDays, format, parseISO } from 'date-fns'

interface PostPlannerInput {
  topic: string
  numPosts: number
  startDate: string   // ISO date string
  endDate: string     // ISO date string
  platform?: string
  tone?: string
  products?: string
  campaignId?: string
}

interface PlannedPost {
  title: string
  caption_draft: string
  image_concept: string
  post_day: number      // 0-indexed offset from startDate
  post_time?: string    // HH:MM in 24h, default 09:00
}

export async function POST(req: NextRequest) {
  const body: PostPlannerInput = await req.json()
  const { topic, numPosts, startDate, endDate, platform = 'instagram', tone, products, campaignId } = body

  if (!topic || !numPosts || !startDate || !endDate) {
    return NextResponse.json({ error: 'topic, numPosts, startDate, endDate are required' }, { status: 400 })
  }

  const clientId = req.headers.get('x-client-id') ?? null
  const ctx = await getBrandContext(clientId)
  const brandName = ctx.raw.brand_name || 'Your Brand'
  const brandVoice = ctx.raw.brand_voice || ''
  const brandHashtags = ctx.raw.brand_hashtags || ''

  const start = parseISO(startDate)
  const end = parseISO(endDate)
  const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000))

  const userPrompt = `Generate a content plan for ${brandName} on ${platform}.

Topic / campaign: "${topic}"
Number of posts: ${numPosts}
Date range: ${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')} (${totalDays} days)
${tone ? `Tone: ${tone}` : ''}
${products ? `Products to feature: ${products}` : ''}
${brandVoice ? `Brand voice: ${brandVoice}` : ''}
${brandHashtags ? `Brand hashtags to include: ${brandHashtags}` : ''}

Spread posts evenly across the date range. For each post return a JSON object with:
- title: short descriptive title (max 60 chars)
- caption_draft: full ready-to-post caption with hashtags
- image_concept: detailed image generation prompt (describe scene, subject, lighting, style, mood)
- post_day: day offset from start date (0 = first day, integers only, spread evenly)
- post_time: best posting time in HH:MM 24h format

Return ONLY a JSON array of ${numPosts} post objects. No extra text.`

  const raw = await generateText(ctx.systemPrompt('Content Planner'), userPrompt)

  let posts: PlannedPost[] = []
  try {
    const match = raw.match(/\[[\s\S]*\]/)
    if (match) posts = JSON.parse(match[0])
  } catch {
    return NextResponse.json({ error: 'Failed to parse plan from AI response', raw }, { status: 500 })
  }

  if (!posts.length) {
    return NextResponse.json({ error: 'AI returned no posts', raw }, { status: 500 })
  }

  const db = createServiceClient()

  const rows = posts.map((p) => {
    const scheduledDate = addDays(start, Math.min(p.post_day ?? 0, totalDays - 1))
    const [hh = '09', mm = '00'] = (p.post_time ?? '09:00').split(':')
    scheduledDate.setHours(parseInt(hh, 10), parseInt(mm, 10), 0, 0)

    return {
      title: p.title,
      caption: p.caption_draft,
      image_concept: p.image_concept,
      platform,
      scheduled_at: scheduledDate.toISOString(),
      status: 'draft',
      media_type: 'IMAGE',
      campaign_id: campaignId ?? null,
      client_id: clientId,
    }
  })

  const { data, error } = await db.from('cada_scheduled_posts').insert(rows).select()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, posts: data })
}
