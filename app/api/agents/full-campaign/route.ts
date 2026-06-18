export const dynamic = 'force-dynamic'
import { NextRequest } from 'next/server'
import { generateText } from '@/lib/anthropic'
import { createProject, createTask } from '@/lib/todoist'
import { createCalendarEvent, uploadTextToDrive } from '@/lib/google'
import { createServiceClient } from '@/lib/supabase'
import { getBrandSystemPrompt } from '@/lib/brand'
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
const BASE = getBrandSystemPrompt('Full Campaign Agent')

export async function POST(req: NextRequest) {
  const { prompt } = await req.json()
  const db = createServiceClient()
  const { stream, send, close } = createSSE()

  // Run the agent chain asynchronously while streaming progress
  ;(async () => {
    const start = Date.now()

    try {
      // â”€â”€ STEP 1: Parse the campaign prompt â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      send({ step: 1, status: 'running', label: 'Parsing your campaign briefâ€¦' })

      const parseResult = await generateText(
        BASE + '\nExtract campaign details from the user prompt and return ONLY valid JSON, no markdown.',
        `Extract these fields from the campaign prompt: "${prompt}"

Return ONLY this JSON (no markdown, no explanation):
{
  "name": "campaign name",
  "theme": "campaign theme/concept",
  "startDate": "YYYY-MM-DD (if mentioned, else use next Monday)",
  "durationDays": 28,
  "channels": ["TikTok", "Instagram", "Shopee"],
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
          theme: 'Fashion Collection Launch',
          startDate: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
          durationDays: 28,
          channels: ['TikTok', 'Instagram', 'Shopee'],
          targetAudience: 'Muslim women 20-35 in Indonesia & Singapore',
          keyMessage: 'Elevate your modest style',
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
      send({ step: 2, status: 'running', label: 'Researching trends for this campaignâ€¦' })

      const trendText = await generateText(
        BASE + '\nYou are a trend analyst. Be specific and actionable.',
        `Research the most relevant fashion trends for a CADA campaign themed: "${parsed.theme}".
Focus on what Muslim women in Indonesia are wearing and engaging with right now.

List:
- 5 trending colors relevant to this campaign theme
- 4 trending content styles on TikTok/Instagram for modest fashion
- 3 specific content hooks that are performing well right now`
      )

      send({ step: 2, status: 'done', label: 'Trends researched', data: { trends: trendText.slice(0, 300) + 'â€¦' } })

      // â”€â”€ STEP 3: Campaign Brief â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      send({ step: 3, status: 'running', label: 'Writing campaign concept & briefâ€¦' })

      const briefText = await generateText(
        BASE + '\nYou are a campaign strategist. Write compelling, specific copy.',
        `Write a complete campaign brief for CADA based on:
Campaign: "${parsed.name}"
Theme: "${parsed.theme}"
Start date: ${parsed.startDate}
Channels: ${parsed.channels.join(', ')}
Key message: "${parsed.keyMessage}"
Trend insights: ${trendText.slice(0, 500)}

Include:
1. Campaign Tagline (punchy, 5-8 words)
2. Campaign Concept (2 paragraphs)
3. Target Audience Profile
4. Key Visual Direction (colors, mood, styling)
5. Channel Strategy (what goes on TikTok vs Instagram vs Shopee)
6. KPIs (3 measurable goals)
7. Week-by-week breakdown (4 weeks)`
      )

      send({ step: 3, status: 'done', label: 'Campaign brief written' })

      // â”€â”€ STEP 4: Generate 7 Days of Content â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      send({ step: 4, status: 'running', label: 'Generating 7 days of contentâ€¦' })

      const contentText = await generateText(
        BASE + '\nYou are a social media copywriter. Write ready-to-post content.',
        `Generate 7 days of social content for CADA's campaign: "${parsed.name}"
Theme: ${parsed.theme}
Starting: ${parsed.startDate}
Products to feature: Pleated Linen Pants (Rp 350,000), Butter Yellow Ruffle Sleeve Shirt (Rp 280,000), High Waisted Denim Maxi Skirt (Rp 385,000)

For each day provide:
DAY [N] â€” [Date] â€” [Platform: TikTok or Instagram]
Caption: [full ready-to-post caption with hashtags]
Content Type: [Reel/TikTok/Carousel/Static]
Hook: [opening line for video]
CTA: [call to action]
---

Make each day different. Rotate products. Mix TikTok and Instagram. Include #CADA #wearcada #modestfashion hashtags.`
      )

      // Parse days into structured array
      const dayBlocks = contentText.split(/---+/).filter((b) => b.trim())
      const contentDays = dayBlocks.slice(0, 7).map((block, i) => {
        const dayMatch = block.match(/DAY\s+(\d+)[^â€”\n]*â€”[^â€”\n]*â€”\s*(.+)/i)
        const captionMatch = block.match(/Caption:\s*([\s\S]+?)(?=Content Type:|Hook:|CTA:|$)/i)
        const typeMatch = block.match(/Content Type:\s*(.+)/i)
        const hookMatch = block.match(/Hook:\s*(.+)/i)
        const ctaMatch = block.match(/CTA:\s*(.+)/i)
        return {
          day: i + 1,
          date: format(addDays(new Date(parsed.startDate), i), 'yyyy-MM-dd'),
          platform: dayMatch?.[2]?.trim() ?? (i % 2 === 0 ? 'TikTok' : 'Instagram'),
          caption: captionMatch?.[1]?.trim() ?? block.trim().slice(0, 300),
          contentType: typeMatch?.[1]?.trim() ?? 'Reel',
          hook: hookMatch?.[1]?.trim() ?? '',
          cta: ctaMatch?.[1]?.trim() ?? 'Shop now at our Shopee store!',
        }
      })

      send({
        step: 4, status: 'done',
        label: `${contentDays.length} days of content generated`,
        data: { days: contentDays.length },
      })

      // â”€â”€ STEP 5: Save content to DB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      send({ step: 5, status: 'running', label: 'Saving campaign & content to databaseâ€¦' })

      // Save campaign
      const { data: campaign } = await db.from('cada_campaigns').insert({
        name: parsed.name,
        description: parsed.theme,
        start_date: parsed.startDate,
        end_date: format(addDays(new Date(parsed.startDate), parsed.durationDays - 1), 'yyyy-MM-dd'),
        status: 'draft',
        brief: {
          tagline: briefText.match(/Tagline[:\s]+(.+)/i)?.[1]?.trim() ?? '',
          concept: briefText,
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
          campaign_id: campaign?.id,
        },
        tags: ['campaign', parsed.name.toLowerCase().replace(/\s+/g, '-'), day.platform.toLowerCase(), 'cada'],
      }))

      await db.from('cada_content_items').insert(contentInserts)

      send({ step: 5, status: 'done', label: 'Saved to database' })

      // â”€â”€ STEP 6: Todoist tasks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      send({ step: 6, status: 'running', label: 'Creating Todoist tasksâ€¦' })

      let todoistProjectId = ''
      const milestoneRows: Array<{
        campaign_id: string
        title: string
        due_date: string
        week_number: number
        todoist_task_id: string | null
      }> = []

      try {
        todoistProjectId = await createProject(`CADA â€” ${parsed.name}`)

        const milestones = [
          { title: 'ðŸ“¸ Shoot & prepare all campaign assets', offset: 0, week: 1 },
          { title: 'ðŸ“ Finalise all 7-day captions & hooks', offset: 1, week: 1 },
          { title: 'ðŸš€ Day 1 post goes live', offset: 0, week: 1 },
          { title: 'ðŸ“Š Week 1 engagement check', offset: 7, week: 2 },
          { title: 'ðŸŽ¬ Week 2 TikTok push', offset: 7, week: 2 },
          { title: 'ðŸ’¥ Mid-campaign promo / discount drop', offset: 14, week: 3 },
          { title: 'ðŸ“Š Week 3 performance review', offset: 21, week: 4 },
          { title: 'ðŸ Campaign wrap-up & report', offset: 27, week: 4 },
        ]

        for (const m of milestones) {
          const dueDate = format(addDays(new Date(parsed.startDate), m.offset), 'yyyy-MM-dd')
          const taskId = await createTask({
            content: m.title,
            projectId: todoistProjectId,
            dueDate,
            description: `CADA Campaign: ${parsed.name} Â· ${parsed.theme}`,
            priority: m.week === 1 ? 4 : 3,
          })
          if (campaign) {
            milestoneRows.push({ campaign_id: campaign.id, title: m.title, due_date: dueDate, week_number: m.week, todoist_task_id: taskId })
          }
        }

        // Add one task per content day
        for (const day of contentDays) {
          await createTask({
            content: `ðŸ“± Post Day ${day.day} â€” ${day.platform} (${day.contentType})`,
            projectId: todoistProjectId,
            dueDate: day.date,
            description: day.caption.slice(0, 200),
            priority: 3,
          })
        }

        send({ step: 6, status: 'done', label: `Todoist project created with ${milestones.length + contentDays.length} tasks` })
      } catch {
        send({ step: 6, status: 'skipped', label: 'Todoist skipped (API key not set)' })
      }

      // â”€â”€ STEP 7: Google Calendar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      send({ step: 7, status: 'running', label: 'Blocking campaign dates in Google Calendarâ€¦' })

      const calendarEventIds: string[] = []
      try {
        for (let w = 0; w < 4; w++) {
          const eventId = await createCalendarEvent({
            summary: `CADA â€” ${parsed.name} Â· Week ${w + 1}`,
            description: `Campaign week ${w + 1}. Theme: ${parsed.theme}`,
            startDate: format(addDays(new Date(parsed.startDate), w * 7), 'yyyy-MM-dd'),
            endDate: format(addDays(new Date(parsed.startDate), w * 7 + 6), 'yyyy-MM-dd'),
          })
          calendarEventIds.push(eventId)
        }
        send({ step: 7, status: 'done', label: '4 weeks blocked in Google Calendar' })
      } catch {
        send({ step: 7, status: 'skipped', label: 'Calendar skipped (API key not set)' })
      }

      // â”€â”€ STEP 8: Google Drive â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      send({ step: 8, status: 'running', label: 'Exporting full brief to Google Driveâ€¦' })

      let driveUrl = ''
      try {
        const driveContent = [
          `CADA CAMPAIGN BRIEF`,
          `===================`,
          `Campaign: ${parsed.name}`,
          `Theme: ${parsed.theme}`,
          `Start: ${parsed.startDate}`,
          `Channels: ${parsed.channels.join(', ')}`,
          `Key Message: ${parsed.keyMessage}`,
          ``,
          `TREND INSIGHTS`,
          `--------------`,
          trendText,
          ``,
          `CAMPAIGN BRIEF`,
          `--------------`,
          briefText,
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
          fileName: `CADA Campaign â€” ${parsed.name}.txt`,
          content: driveContent,
        })
        send({ step: 8, status: 'done', label: 'Brief exported to Google Drive', data: { driveUrl } })
      } catch {
        send({ step: 8, status: 'skipped', label: 'Drive skipped (API key not set)' })
      }

      // â”€â”€ STEP 9: Finalise DB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      if (campaign) {
        await db.from('cada_campaigns').update({
          todoist_project_id: todoistProjectId || null,
          calendar_event_ids: calendarEventIds,
          google_drive_url: driveUrl || null,
        }).eq('id', campaign.id)

        if (milestoneRows.length > 0) {
          await db.from('cada_campaign_milestones').insert(milestoneRows)
        }
      }

      // â”€â”€ DONE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      send({
        step: 9, status: 'done',
        label: 'Campaign fully launched!',
        complete: true,
        duration: Math.round((Date.now() - start) / 1000),
        summary: {
          campaignId: campaign?.id,
          campaignName: parsed.name,
          theme: parsed.theme,
          startDate: parsed.startDate,
          contentDaysCount: contentDays.length,
          todoist: !!todoistProjectId,
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

