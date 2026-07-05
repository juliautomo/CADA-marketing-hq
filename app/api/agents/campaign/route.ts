export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { generateText } from '@/lib/anthropic'
import { createProject, createTask } from '@/lib/todoist'
import { createCalendarEvent, uploadFileToDrive } from '@/lib/google'
import { createServiceClient } from '@/lib/supabase'
import { getBrandContext } from '@/lib/brand'
import { generateCampaignBriefPDF } from '@/lib/pdf'
import type { CampaignInput } from '@/types'
import { addDays, format } from 'date-fns'

export async function POST(req: NextRequest) {
  const start = Date.now()
  const body: CampaignInput = await req.json()
  const db = createServiceClient()
  const ctx = await getBrandContext()
  const brandName      = ctx.raw.brand_name || 'Your Brand'
  const brandMarkets   = ctx.raw.brand_markets || ''
  const brandEcommerce = ctx.raw.brand_ecommerce_platform || ''
  const SYSTEM_PROMPT = ctx.systemPrompt('Campaign Planner') + `

You are an expert marketing campaign strategist specialising in ${ctx.raw.brand_industry || 'fashion'} brands.
Create detailed, actionable 4-week campaign plans tailored to ${brandName}'s channels.
Output structured JSON when asked.`

  const { data: run } = await db
    .from('cada_agent_runs')
    .insert({ agent: 'campaign_planner', status: 'running', input: body })
    .select()
    .single()

  try {
    const startDate = new Date(body.startDate)
    const endDate = addDays(startDate, 27)

    const briefText = await generateText(
      SYSTEM_PROMPT,
      `Create a detailed 4-week marketing campaign for ${brandName}:

Campaign: "${body.name}"
Description: ${body.description}
Theme: ${body.theme ?? `${ctx.raw.brand_industry || 'fashion'} collection launch`}
Budget: ${body.budget ?? 'not specified'}
Channels: ${(body.channels ?? ['TikTok', 'Instagram', brandEcommerce]).join(', ')}
Start date: ${format(startDate, 'MMMM d, yyyy')}
Markets: ${brandMarkets}

IMPORTANT: Output ONLY raw JSON. No markdown. No code blocks. No backticks. Start your response with { and end with }.

{
  "summary": "2-3 sentence campaign overview tailored to CADA and modest fashion",
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
    let milestones: Array<{ title: string; day_offset: number; week: number }> = []

    try {
      // Strip markdown code fences before parsing
      const cleanText = briefText.replace(/```json\n?/gi, '').replace(/```\n?/g, '')
      const jsonMatch = cleanText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        brief = JSON.parse(jsonMatch[0])
        const weeks = (brief.weeks as Array<{ week: number; milestones: Array<{ title: string; day_offset: number }> }>) ?? []
        milestones = weeks.flatMap((w) =>
          w.milestones.map((m) => ({ title: m.title, day_offset: m.day_offset, week: w.week }))
        )
      }
    } catch {
      milestones = [
        { title: 'Content creation & assets', day_offset: 0, week: 1 },
        { title: 'Pre-launch teaser on TikTok & Instagram', day_offset: 7, week: 2 },
        { title: 'Launch day â€” Shopee + TikTok Live', day_offset: 14, week: 3 },
        { title: 'Post-launch engagement & retargeting', day_offset: 21, week: 4 },
      ]
    }

    // Todoist â€” try to create a project, fall back to Inbox if limit reached
    let todoistProjectId = ''
    let todoistError = ''
    const todoistTaskIds: string[] = []
    try {
      try {
        todoistProjectId = await createProject(`CADA â€” ${body.name}`)
      } catch (e) {
        // If project limit reached (403), use Inbox (no project_id needed)
        const msg = e instanceof Error ? e.message : ''
        if (msg.includes('403') || msg.includes('Maximum')) {
          todoistProjectId = 'inbox'  // sentinel â€” tasks go to Inbox
        } else {
          throw e
        }
      }
      for (const m of milestones) {
        const dueDate = format(addDays(startDate, m.day_offset), 'yyyy-MM-dd')
        const taskId = await createTask({
          content: `[${body.name}] ${m.title}`,
          projectId: todoistProjectId === 'inbox' ? '' : todoistProjectId,
          dueDate,
          description: `Week ${m.week} | CADA â€” ${body.name}`,
          priority: m.week === 3 ? 4 : 3,
        })
        todoistTaskIds.push(taskId)
      }
      if (!todoistProjectId) todoistProjectId = 'inbox'
    } catch (e) { todoistError = e instanceof Error ? e.message : 'Unknown Todoist error' }

    // Google Calendar
    const calendarEventIds: string[] = []
    try {
      for (let w = 0; w < 4; w++) {
        const eventId = await createCalendarEvent({
          summary: `CADA â€” ${body.name} Â· Week ${w + 1}`,
          description: `Campaign week ${w + 1} of 4`,
          startDate: format(addDays(startDate, w * 7), 'yyyy-MM-dd'),
          endDate: format(addDays(startDate, w * 7 + 6), 'yyyy-MM-dd'),
        })
        calendarEventIds.push(eventId)
      }
    } catch { /* Google key not set */ }

    // Google Drive â€” generate PDF brief
    let driveUrl = ''
    let driveError = ''
    try {
      const pdfBuffer = await generateCampaignBriefPDF({
        name: body.name,
        startDate: format(startDate, 'MMMM d, yyyy'),
        endDate: format(endDate, 'MMMM d, yyyy'),
        channels: body.channels ?? ['Instagram', 'TikTok'],
        summary: typeof brief.summary === 'string' ? brief.summary : undefined,
        objective: typeof brief.objective === 'string' ? brief.objective : undefined,
        kpis: Array.isArray(brief.kpis) ? brief.kpis as string[] : undefined,
        weeks: Array.isArray(brief.weeks) ? brief.weeks as never : undefined,
      })
      driveUrl = await uploadFileToDrive({
        fileName: `CADA Campaign Brief â€” ${body.name}.pdf`,
        buffer: pdfBuffer,
        mimeType: 'application/pdf',
      })
    } catch (e) { driveError = e instanceof Error ? e.message : 'Unknown Drive error' }

    const { data: campaign } = await db.from('cada_campaigns')
      .insert({
        name: body.name,
        description: body.description,
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(endDate, 'yyyy-MM-dd'),
        status: 'draft',
        google_drive_url: driveUrl || null,
        todoist_project_id: todoistProjectId || null,
        calendar_event_ids: calendarEventIds,
        brief,
      })
      .select().single()

    const milestoneRows = milestones.map((m, i) => ({
      campaign_id: campaign!.id,
      title: m.title,
      due_date: format(addDays(startDate, m.day_offset), 'yyyy-MM-dd'),
      week_number: m.week,
      todoist_task_id: todoistTaskIds[i] ?? null,
      calendar_event_id: calendarEventIds[m.week - 1] ?? null,
    }))
    await db.from('cada_campaign_milestones').insert(milestoneRows)

    await db.from('cada_agent_runs').update({ status: 'completed', output: { campaign }, duration_ms: Date.now() - start }).eq('id', run!.id)
    return NextResponse.json({
      success: true,
      campaign,
      briefText,
      todoistOk: !!todoistProjectId,
      todoistError,
      calendarOk: calendarEventIds.length > 0,
      driveOk: !!driveUrl,
      driveError,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    await db.from('cada_agent_runs').update({ status: 'failed', error: msg, duration_ms: Date.now() - start }).eq('id', run!.id)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}

