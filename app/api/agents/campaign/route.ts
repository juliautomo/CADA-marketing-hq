import { NextRequest, NextResponse } from 'next/server'
import { generateText } from '@/lib/anthropic'
import { createProject, createTask } from '@/lib/todoist'
import { createCalendarEvent, uploadTextToDrive } from '@/lib/google'
import { createServiceClient } from '@/lib/supabase'
import { getBrandSystemPrompt } from '@/lib/brand'
import type { CampaignInput } from '@/types'
import { addDays, format } from 'date-fns'

const SYSTEM_PROMPT = getBrandSystemPrompt('Campaign Planner') + `

You are an expert marketing campaign strategist for modest fashion brands in Southeast Asia.
Create detailed, actionable 4-week campaign plans tailored to CADA's channels: Shopee, TikTok, Tokopedia, and Instagram.
Output structured JSON when asked.`

export async function POST(req: NextRequest) {
  const start = Date.now()
  const body: CampaignInput = await req.json()
  const db = createServiceClient()

  const { data: run } = await db
    .from('agent_runs')
    .insert({ agent: 'campaign_planner', status: 'running', input: body })
    .select()
    .single()

  try {
    const startDate = new Date(body.startDate)
    const endDate = addDays(startDate, 27)

    const briefText = await generateText(
      SYSTEM_PROMPT,
      `Create a detailed 4-week marketing campaign for CADA:

Campaign: "${body.name}"
Description: ${body.description}
Theme: ${body.theme ?? 'modest fashion collection launch'}
Budget: ${body.budget ?? 'not specified'}
Channels: ${(body.channels ?? ['TikTok', 'Instagram', 'Shopee']).join(', ')}
Start date: ${format(startDate, 'MMMM d, yyyy')}
Markets: Indonesia & Singapore

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
        { title: 'Launch day — Shopee + TikTok Live', day_offset: 14, week: 3 },
        { title: 'Post-launch engagement & retargeting', day_offset: 21, week: 4 },
      ]
    }

    // Todoist — try to create a project, fall back to Inbox if limit reached
    let todoistProjectId = ''
    let todoistError = ''
    const todoistTaskIds: string[] = []
    try {
      try {
        todoistProjectId = await createProject(`CADA — ${body.name}`)
      } catch (e) {
        // If project limit reached (403), use Inbox (no project_id needed)
        const msg = e instanceof Error ? e.message : ''
        if (msg.includes('403') || msg.includes('Maximum')) {
          todoistProjectId = 'inbox'  // sentinel — tasks go to Inbox
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
          description: `Week ${m.week} | CADA — ${body.name}`,
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
          summary: `CADA — ${body.name} · Week ${w + 1}`,
          description: `Campaign week ${w + 1} of 4`,
          startDate: format(addDays(startDate, w * 7), 'yyyy-MM-dd'),
          endDate: format(addDays(startDate, w * 7 + 6), 'yyyy-MM-dd'),
        })
        calendarEventIds.push(eventId)
      }
    } catch { /* Google key not set */ }

    // Google Drive
    let driveUrl = ''
    let driveError = ''
    try {
      driveUrl = await uploadTextToDrive({
        fileName: `CADA Campaign Brief — ${body.name}.txt`,
        content: `CADA CAMPAIGN BRIEF\n===================\n${body.name}\n\n${briefText}`,
      })
    } catch (e) { driveError = e instanceof Error ? e.message : 'Unknown Drive error' }

    const { data: campaign } = await db.from('campaigns')
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
    await db.from('campaign_milestones').insert(milestoneRows)

    await db.from('agent_runs').update({ status: 'completed', output: { campaign }, duration_ms: Date.now() - start }).eq('id', run!.id)
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
    await db.from('agent_runs').update({ status: 'failed', error: msg, duration_ms: Date.now() - start }).eq('id', run!.id)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
