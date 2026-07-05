export const dynamic = 'force-dynamic'
// Daily Content Queue â€” runs every day at 9am via Vercel Cron
// Cron schedule defined in vercel.json: "0 9 * * *"
// Generates 3 ready-to-post content ideas and saves to DB + Todoist

import { NextRequest, NextResponse } from 'next/server'
import { generateText } from '@/lib/anthropic'
import { createTask, createProject } from '@/lib/todoist'
import { createServiceClient } from '@/lib/supabase'
import { getBrandContext } from '@/lib/brand'
import { format, addDays } from 'date-fns'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const start = Date.now()
  const db = createServiceClient()
  const ctx = await getBrandContext()
  const brandName    = ctx.raw.brand_name || 'Your Brand'
  const brandIndustry = ctx.raw.brand_industry || ''
  const brandHashtags = ctx.raw.brand_hashtags || ''
  const SYSTEM_PROMPT = ctx.systemPrompt('Daily Content Generator') + `

You generate 3 ready-to-post social media content ideas for ${brandName} every morning.
Each idea must be specific, ready to execute today, and tailored to what performs on TikTok and Instagram for ${brandIndustry}.

Output EXACTLY 3 content ideas in this format (no deviation):

IDEA 1
Platform: [TikTok or Instagram]
Format: [Reel/TikTok/Carousel/Static Post/Story]
Product: [which ${brandName} product to feature]
Hook: [opening 3 seconds / first line]
Caption: [full ready-to-post caption with hashtags]
CTA: [call to action]
---
IDEA 2
Platform: [TikTok or Instagram]
Format: [format]
Product: [product]
Hook: [hook]
Caption: [caption]
CTA: [cta]
---
IDEA 3
Platform: [TikTok or Instagram]
Format: [format]
Product: [product]
Hook: [hook]
Caption: [caption]
CTA: [cta]
---`

  const { data: setting } = await db.from('cada_settings').select('value').eq('key', 'automation_daily_content_enabled').single()
  if (setting && setting.value === false) {
    return NextResponse.json({ success: true, message: 'Daily Content Queue is disabled. Enable it in Automations settings.' })
  }
  const today = format(new Date(), 'MMMM d, yyyy')
  const todayISO = format(new Date(), 'yyyy-MM-dd')

  // Pull active products from catalog
  const { data: catalogProducts } = await db.from('cada_products').select('name, colors, fabric').eq('active', true)
  const products = (catalogProducts ?? []).length > 0
    ? (catalogProducts ?? []).map((p) => ({ name: p.name, price: '' }))
    : [{ name: ctx.raw.brand_products_list?.split('\n')[0]?.trim() || `${brandName} collection`, price: '' }]
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000)
  const featuredProduct = products[dayOfYear % products.length]

  // Log run start
  const { data: runRow } = await db.from('cada_agent_runs').insert({
    agent: 'daily_content', status: 'running', input: { date: todayISO },
  }).select().single()
  const runId = runRow?.id

  try {
    const text = await generateText(
      SYSTEM_PROMPT,
      `Generate 3 content ideas for ${brandName} for today, ${today}.
Featured product today: ${featuredProduct.name} (${featuredProduct.price})
Also feel free to feature the other products in ideas 2 and 3.
Make each idea different — vary the platform, format, and angle.
Include ${brandHashtags} in captions where relevant.`
    )

    // Parse the 3 ideas
    const ideaBlocks = text.split(/---+/).filter((b) => b.trim())
    const ideas = ideaBlocks.slice(0, 3).map((block, i) => {
      const get = (label: string) => {
        const match = block.match(new RegExp(`${label}:\\s*(.+)`, 'i'))
        return match?.[1]?.trim() ?? ''
      }
      const captionMatch = block.match(/Caption:\s*([\s\S]+?)(?=CTA:|$)/i)
      return {
        number: i + 1,
        platform: get('Platform') || (i === 0 ? 'TikTok' : 'Instagram'),
        format: get('Format') || 'Reel',
        product: get('Product') || featuredProduct.name,
        hook: get('Hook'),
        caption: captionMatch?.[1]?.trim() ?? '',
        cta: get('CTA'),
      }
    })

    // Save each idea as a content_item
    const savedItems = []
    for (const idea of ideas) {
      const { data } = await db.from('cada_content_items').insert({
        type: 'caption',
        title: `Daily Queue: Day ${idea.number} â€” ${idea.platform} ${idea.format} (${today})`,
        body: idea.caption,
        metadata: {
          type: 'daily_queue',
          date: todayISO,
          platform: idea.platform,
          format: idea.format,
          product: idea.product,
          hook: idea.hook,
          cta: idea.cta,
          idea_number: idea.number,
        },
        tags: ['daily-queue', todayISO, idea.platform.toLowerCase(), 'cada'],
      }).select().single()
      savedItems.push(data)
    }

    // Create Todoist tasks for each idea (due today)
    const todoistTaskIds: string[] = []
    try {
      // Find or create a "Daily Content Queue" project
      let projectId = process.env.CADA_DAILY_CONTENT_PROJECT_ID ?? ''
      if (!projectId) {
        projectId = await createProject(`${brandName} — Daily Content Queue`)
      }

      for (const idea of ideas) {
        const taskId = await createTask({
          content: `ðŸ“± Post ${idea.platform} ${idea.format}: ${idea.product}`,
          projectId,
          dueDate: todayISO,
          description: `Hook: ${idea.hook}\n\nCaption: ${idea.caption.slice(0, 200)}\n\nCTA: ${idea.cta}`,
          priority: 3,
        })
        todoistTaskIds.push(taskId)
      }
    } catch {
      // Todoist not configured
    }

    const duration = Date.now() - start
    if (runId) await db.from('cada_agent_runs').update({ status: 'completed', output: { ideas: ideas.length }, duration_ms: duration }).eq('id', runId)

    return NextResponse.json({
      success: true,
      message: `Daily content queue generated for ${today}`,
      date: todayISO,
      ideas,
      savedItems,
      todoistTaskIds,
      duration_ms: duration,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    if (runId) await db.from('cada_agent_runs').update({ status: 'failed', output: { error: msg } }).eq('id', runId)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}

