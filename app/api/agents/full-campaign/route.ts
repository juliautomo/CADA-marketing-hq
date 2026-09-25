export const dynamic = 'force-dynamic'
import { NextRequest } from 'next/server'
import { generateText } from '@/lib/anthropic'
import { createCalendarEvent, uploadTextToDrive } from '@/lib/google'
import { createServiceClient } from '@/lib/supabase'
import { getBrandContext } from '@/lib/brand'
import { addDays, format } from 'date-fns'

// â”€â”€â”€ SSE helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function createSSE() {
  const encoder = new TextEncoder()
  let controller: ReadableStreamDefaultController

  const stream = new ReadableStream({
    start(c) { controller = c },
  })

  const send = (data: Record<string, unknown>) => {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
  }

  const close = () => controller.close()

  return { stream, send, close }
}

// â”€â”€â”€ Prompts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function POST(req: NextRequest) {
  const { prompt, startDate: explicitStartDate, numPosts = 7, weeks = 1, trendHints = '' } = await req.json()
  const db = createServiceClient()
  const clientId = req.headers.get('x-client-id') ?? null
  const { stream, send, close } = createSSE()
  // Load client's Google refresh token (falls back to env var inside lib/google.ts)
  const { data: googleTokenRow } = await db
    .from('cada_settings')
    .select('value')
    .eq('key', 'google_refresh_token')
    .eq('client_id', clientId ?? null)
    .maybeSingle()
  const googleRefreshToken = googleTokenRow?.value && googleTokenRow.value !== 'null'
    ? googleTokenRow.value : undefined

  const ctx = await getBrandContext(clientId)
  const BASE = ctx.systemPrompt('Content Planner')
  const brandName      = ctx.raw.brand_name || 'Your Brand'
  const brandHashtags  = ctx.raw.brand_hashtags || ''
  const brandEcommerce = ctx.raw.brand_ecommerce_platform || ''
  const brandIndustry  = ctx.raw.brand_industry || ''
  const brandProducts  = ctx.raw.brand_products_list || ''

  // Run the agent chain asynchronously while streaming progress
  ;(async () => {
    const start = Date.now()

    try {
      // â”€â”€ STEP 1: Parse the campaign prompt â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      send({ step: 1, status: 'running', label: 'Parsing your content plan…' })

      const parseResult = await generateText(
        BASE + '\nExtract content plan details from the user prompt and return ONLY valid JSON, no markdown.',
        `Extract these fields from the content plan request: "${prompt}"
Today's date is ${format(new Date(), 'yyyy-MM-dd')}.${explicitStartDate ? ` The user has chosen start date: ${explicitStartDate}.` : ' Use today\'s date to resolve relative dates like "next Monday".'}

Return ONLY this JSON (no markdown, no explanation):
{
  "name": "short content plan name",
  "theme": "content theme/topic",
  "startDate": "${explicitStartDate || 'YYYY-MM-DD (next Monday from today)'}",
  "durationDays": 28,
  "channels": ["TikTok", "Instagram"],
  "targetAudience": "description",
  "keyMessage": "one sentence brand message"
}`
      )

      let parsed: {
        name: string
        theme: string
        startDate: string
        durationDays: number
        channels: string[]
        targetAudience: string
        keyMessage: string
      }

      try {
        const jsonMatch = parseResult.match(/\{[\s\S]*\}/)
        parsed = JSON.parse(jsonMatch?.[0] ?? '{}')
      } catch {
        parsed = {
          name: prompt.slice(0, 50),
          theme: `${brandIndustry} Collection Launch`,
          startDate: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
          durationDays: 28,
          channels: ['TikTok', 'Instagram'],
          targetAudience: ctx.raw.brand_target_customer || `${brandIndustry} customers`,
          keyMessage: 'Discover something new',
        }
      }

      // Normalise date
      const startDate = new Date(parsed.startDate)
      if (isNaN(startDate.getTime())) {
        parsed.startDate = format(addDays(new Date(), 7), 'yyyy-MM-dd')
      }

      send({
        step: 1, status: 'done',
        label: 'Campaign parsed',
        data: { name: parsed.name, theme: parsed.theme, startDate: parsed.startDate },
      })

      // â”€â”€ STEP 2: Trend Research â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      send({ step: 2, status: 'running', label: 'Researching trends for inspiration…' })

      const trendText = await generateText(
        BASE + '\nYou are a trend analyst. Be specific and actionable.',
        `Research the most relevant ${brandIndustry} trends to inspire content for ${brandName}, themed: “${parsed.theme}”.
Focus on what the target audience is engaging with right now.${trendHints ? `\n\nThe client has flagged these specific trends, aesthetics, or references to explore: ${trendHints}` : ''}

List:
- 5 trending colors or aesthetics relevant to this theme
- 4 trending content styles on TikTok/Instagram for ${brandIndustry}
- 3 specific content hooks or angles that are performing well right now`
      )

      send({ step: 2, status: 'done', label: 'Trends researched', data: { trends: trendText.slice(0, 300) + '…' } })

      // ── STEP 3: Generate 7 Days of Content ──────────────────────────────────
      send({ step: 3, status: 'running', label: `Generating ${numPosts} posts…` })

      const contentText = await generateText(
        BASE + '\nYou are a social media copywriter. Write ready-to-post content. Use EXACTLY the format below — no deviations.',
        `Generate exactly ${numPosts} social media posts for ${brandName} on the theme: “${parsed.theme}”
Starting: ${parsed.startDate}
Duration: ${weeks} week${weeks > 1 ? 's' : ''} — spread posts evenly, one per scheduled day
Products to feature: ${brandProducts}
Trend inspiration: ${trendText.slice(0, 400)}

Use EXACTLY this format for EVERY post, separated by ---:

DAY [N] | [YYYY-MM-DD] | [TikTok or Instagram]
Caption: [full ready-to-post caption — plain text only, NO asterisks, NO markdown, NO hashtag symbols in middle of text. End with hashtags on a new line.]
Content Type: [Reel / TikTok Video / Carousel / Static Photo]
Hook: [punchy 1-line video opening or caption hook]
CTA: [specific call to action e.g. “Link in bio to shop” or “Comment YES if you want this”]
Image Prompt: [detailed visual description for AI image generation — describe the scene, lighting, model, product placement, mood, colors. Be specific: e.g. “A Southeast Asian woman in her 30s wearing a flowy cream linen dress, standing in a sunlit minimalist studio, holding a woven bag, soft natural light, editorial fashion photography, warm tones”]
---

Rules: ${numPosts} posts total. Plain text captions only — no ** bold ** or markdown. Mix TikTok and Instagram. Rotate products. Use brand hashtags: ${brandHashtags}`
      )

      // Parse days — split on --- then match each block
      function stripMarkdown(text: string): string {
        return text
          .replace(/\*\*(.+?)\*\*/g, '$1')
          .replace(/\*(.+?)\*/g, '$1')
          .replace(/__(.+?)__/g, '$1')
          .replace(/_(.+?)_/g, '$1')
          .replace(/^#+\s+/gm, '')
          .replace(/^[-*]\s+/gm, '')
          .trim()
      }

      const rawBlocks = contentText.split(/\n---+\n?/).filter(b => b.trim())
      const contentDays = rawBlocks.slice(0, numPosts).map((block, i) => {
        const headerMatch = block.match(/DAY\s+\d+\s*[|—-]\s*(\d{4}-\d{2}-\d{2})\s*[|—-]\s*(.+)/i)
        const captionMatch = block.match(/Caption:\s*([\s\S]+?)(?=Content Type:|Hook:|CTA:|Image Prompt:|$)/i)
        const typeMatch    = block.match(/Content Type:\s*(.+)/i)
        const hookMatch    = block.match(/Hook:\s*(.+)/i)
        const ctaMatch     = block.match(/CTA:\s*(.+)/i)
        const imageMatch   = block.match(/Image Prompt:\s*([\s\S]+?)(?=---|$)/i)

        const daysApart = Math.round((i / Math.max(numPosts - 1, 1)) * (weeks * 7 - 1))
        const dateStr = headerMatch?.[1] ?? format(addDays(new Date(parsed.startDate), daysApart), 'yyyy-MM-dd')
        const platform = headerMatch?.[2]?.trim().replace(/[^a-zA-Z]/g, '') ?? (i % 2 === 0 ? 'TikTok' : 'Instagram')

        return {
          day: i + 1,
          date: dateStr,
          platform: platform.toLowerCase().includes('tiktok') ? 'TikTok' : 'Instagram',
          caption: stripMarkdown(captionMatch?.[1] ?? block.slice(0, 400)),
          contentType: typeMatch?.[1]?.trim() ?? 'Reel',
          hook: hookMatch?.[1]?.trim() ?? '',
          cta: ctaMatch?.[1]?.trim() ?? `Shop at ${brandEcommerce || 'our store'}`,
          imagePrompt: imageMatch?.[1]?.trim() ?? '',
        }
      })

      send({
        step: 3, status: 'done',
        label: `${contentDays.length} posts generated`,
        data: { days: contentDays.length },
      })

      // ── STEP 4: Save content to DB ────────────────────────────────────────────
      send({ step: 4, status: 'running', label: 'Saving to post queue…' })

      // Save campaign
      const { data: campaign } = await db.from('cada_campaigns').insert({
        name: parsed.name,
        description: parsed.theme,
        start_date: parsed.startDate,
        end_date: format(addDays(new Date(parsed.startDate), parsed.durationDays - 1), 'yyyy-MM-dd'),
        status: 'draft',
        client_id: clientId,
        brief: {
          trends: trendText,
          keyMessage: parsed.keyMessage,
          channels: parsed.channels,
        },
      }).select().single()

      // Save content days as content_items
      const contentInserts = contentDays.map((day) => ({
        type: 'caption' as const,
        title: `Day ${day.day} â€” ${day.platform} â€” ${parsed.name}`,
        body: day.caption,
        metadata: {
          day: day.day,
          date: day.date,
          platform: day.platform,
          contentType: day.contentType,
          hook: day.hook,
          cta: day.cta,
          imagePrompt: day.imagePrompt,
          campaign_id: campaign?.id,
        },
        tags: ['campaign', parsed.name.toLowerCase().replace(/\s+/g, '-'), day.platform.toLowerCase(), 'cada'],
        client_id: clientId,
      }))

      await db.from('cada_content_items').insert(contentInserts)

      // Add to post queue so they appear in Posts for approval
      if (campaign) {
        const scheduledInserts = contentDays.map((day) => ({
          caption: day.caption,
          scheduled_at: new Date(day.date + 'T09:00:00').toISOString(),
          status: 'pending_approval',
          platform: day.platform,
          title: `Day ${day.day} — ${day.platform}`,
          image_concept: day.imagePrompt || day.hook || '',
          campaign_id: campaign.id,
          client_id: clientId,
        }))
        await db.from('cada_scheduled_posts').insert(scheduledInserts)
      }

      send({ step: 4, status: 'done', label: 'Saved to database & post queue' })

      send({ step: 5, status: 'running', label: 'Blocking dates in Google Calendar…' })

      const calendarEventIds: string[] = []
      try {
        for (let w = 0; w < weeks; w++) {
          const eventId = await createCalendarEvent({
            summary: `${brandName} — ${parsed.name} · Week ${w + 1}`,
            description: `Campaign week ${w + 1}. Theme: ${parsed.theme}`,
            startDate: format(addDays(new Date(parsed.startDate), w * 7), 'yyyy-MM-dd'),
            endDate: format(addDays(new Date(parsed.startDate), w * 7 + 6), 'yyyy-MM-dd'),
            refreshToken: googleRefreshToken,
          })
          calendarEventIds.push(eventId)
        }
        send({ step: 5, status: 'done', label: `${weeks} week${weeks > 1 ? 's' : ''} blocked in Google Calendar` })
      } catch {
        send({ step: 5, status: 'skipped', label: 'Calendar skipped (API key not set)' })
      }

      send({ step: 6, status: 'running', label: 'Exporting content plan to Google Drive…' })

      let driveUrl = ''
      try {
        const driveContent = [
          `${brandName.toUpperCase()} CONTENT PLAN`,
          `===================`,
          `Plan: ${parsed.name}`,
          `Theme: ${parsed.theme}`,
          `Start: ${parsed.startDate}`,
          `Channels: ${parsed.channels.join(', ')}`,
          `Key Message: ${parsed.keyMessage}`,
          ``,
          `TREND INSIGHTS`,
          `--------------`,
          trendText,
          ``,
          `7-DAY CONTENT CALENDAR`,
          `----------------------`,
          contentDays.map((d) => [
            `Day ${d.day} | ${d.date} | ${d.platform} | ${d.contentType}`,
            `Hook: ${d.hook}`,
            `Caption: ${d.caption}`,
            `CTA: ${d.cta}`,
            `---`,
          ].join('\n')).join('\n\n'),
        ].join('\n')

        driveUrl = await uploadTextToDrive({
          fileName: `${brandName} Content Plan — ${parsed.name}.txt`,
          content: driveContent,
          refreshToken: googleRefreshToken,
        })
        send({ step: 6, status: 'done', label: 'Content plan exported to Google Drive', data: { driveUrl } })
      } catch {
        send({ step: 6, status: 'skipped', label: 'Drive skipped (API key not set)' })
      }

      // â”€â”€ STEP 9: Finalise DB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      if (campaign) {
        await db.from('cada_campaigns').update({
          calendar_event_ids: calendarEventIds,
          google_drive_url: driveUrl || null,
        }).eq('id', campaign.id)

      }

      // â”€â”€ DONE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      send({
        step: 7, status: 'done',
        label: 'Content plan ready!',
        complete: true,
        duration: Math.round((Date.now() - start) / 1000),
        summary: {
          campaignId: campaign?.id,
          campaignName: parsed.name,
          theme: parsed.theme,
          startDate: parsed.startDate,
          contentDaysCount: contentDays.length,
          calendar: calendarEventIds.length > 0,
          drive: !!driveUrl,
          driveUrl,
          contentDays,
        },
      })

    } catch (err) {
      send({ step: -1, status: 'error', label: 'Agent failed', error: err instanceof Error ? err.message : String(err) })
    } finally {
      close()
    }
  })()

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

