export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { generateText } from '@/lib/anthropic'
import { createCalendarEvent, uploadFileToDrive } from '@/lib/google'
import { createServiceClient } from '@/lib/supabase'
import { getBrandContext } from '@/lib/brand'
import { generateCampaignBriefPDF } from '@/lib/pdf'
import type { CampaignInput } from '@/types'
import { addDays, format } from 'date-fns'

export async function POST(req: NextRequest) {
  const start = Date.now()
  const body: CampaignInput & { brief?: Record<string, unknown>; durationWeeks?: number } = await req.json()
  const db = createServiceClient()
  const clientId = req.headers.get('x-client-id') ?? null
  const ctx = await getBrandContext(clientId)
  const brandName      = ctx.raw.brand_name || 'Your Brand'
  const brandEcommerce = ctx.raw.brand_ecommerce_platform || ''
  const durationWeeks  = body.durationWeeks ?? 4
  const totalDays      = durationWeeks * 7

  const { data: run } = await db
    .from('cada_agent_runs')
    .insert({ agent: 'campaign_planner', status: 'running', input: body, client_id: clientId })
    .select()
    .single()

  try {
    const startDate = new Date(body.startDate)
    const endDate = addDays(startDate, totalDays - 1)

    // Use pre-generated brief if provided (from preview step), otherwise generate
    let brief: Record<string, unknown> = body.brief ?? {}
    let briefText = ''
    let milestones: Array<{ title: string; day_offset: number; week: number; platform?: string; content_type?: string }> = []

    if (Object.keys(brief).length === 0) {
      briefText = await generateText(
        ctx.systemPrompt('Campaign Planner'),
        `Create a ${durationWeeks}-week campaign plan for ${brandName}: "${body.name}". Output raw JSON only.`
      )
      try {
        const clean = briefText.replace(/```json\n?/gi, '').replace(/```\n?/g, '')
        const match = clean.match(/\{[\s\S]*\}/)
        if (match) brief = JSON.parse(match[0])
      } catch { /* use empty */ }
    }

    try {
      const weeks = (brief.weeks as Array<{ week: number; posts?: Array<{ title: string; day_offset: number; platform?: string; content_type?: string }>; milestones?: Array<{ title: string; day_offset: number }> }>) ?? []
      milestones = weeks.flatMap((w) => {
        const items = w.posts ?? w.milestones ?? []
        return items.map((m) => ({ title: m.title, day_offset: m.day_offset, week: w.week, platform: (m as Record<string, unknown>).platform as string | undefined, content_type: (m as Record<string, unknown>).content_type as string | undefined }))
      })
    } catch {
      milestones = [
        { title: 'Content creation & assets', day_offset: 0, week: 1 },
        { title: `Launch day — ${brandEcommerce ? brandEcommerce + ' + ' : ''}Instagram`, day_offset: totalDays / 2, week: Math.ceil(durationWeeks / 2) },
      ]
    }

    // Google Calendar — one event per week
    const calendarEventIds: string[] = []
    try {
      for (let w = 0; w < durationWeeks; w++) {
        const eventId = await createCalendarEvent({
          summary: `${brandName} — ${body.name} · Week ${w + 1}`,
          description: `Campaign week ${w + 1} of ${durationWeeks}`,
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
        fileName: `${brandName} Campaign Brief — ${body.name}.pdf`,
        buffer: pdfBuffer,
        mimeType: 'application/pdf',
      })
    } catch (e) { driveError = e instanceof Error ? e.message : 'Unknown Drive error' }

    const { data: campaign, error: campaignError } = await db.from('cada_campaigns')
      .insert({
        name: body.name,
        description: body.description,
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(endDate, 'yyyy-MM-dd'),
        status: 'draft',
        google_drive_url: driveUrl || null,
        calendar_event_ids: calendarEventIds,
        brief,
        client_id: clientId,
      })
      .select().single()

    if (campaignError || !campaign) throw new Error(campaignError?.message ?? 'Failed to save campaign — please try again')

    const milestoneRows = milestones.map((m) => ({
      campaign_id: campaign.id,
      title: m.title,
      due_date: format(addDays(startDate, m.day_offset), 'yyyy-MM-dd'),
      week_number: m.week,
      calendar_event_id: calendarEventIds[m.week - 1] ?? null,
      platform: (m as Record<string, unknown>).platform ?? null,
      content_type: (m as Record<string, unknown>).content_type ?? null,
      status: 'not_started',
    }))
    await db.from('cada_campaign_milestones').insert(milestoneRows)

    await db.from('cada_agent_runs').update({ status: 'completed', output: { campaign }, duration_ms: Date.now() - start }).eq('id', run!.id)
    return NextResponse.json({
      success: true,
      campaign,
      briefText,
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

