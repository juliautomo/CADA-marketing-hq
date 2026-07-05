export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { generateText } from '@/lib/anthropic'
import { uploadTextToDrive } from '@/lib/google'
import { createServiceClient } from '@/lib/supabase'
import { getBrandContext } from '@/lib/brand'
import type { PerformanceInput } from '@/types'

export async function POST(req: NextRequest) {
  const start = Date.now()
  const body: PerformanceInput = await req.json()
  const db = createServiceClient()
  const ctx = await getBrandContext()
  const brandName    = ctx.raw.brand_name || 'Your Brand'
  const brandChannels = ctx.raw.brand_channels || ''
  const SYSTEM_PROMPT = ctx.systemPrompt('Performance Analyst') + `

You are a data-driven marketing analyst specialising in e-commerce and social commerce.
Analyse ${brandName}'s performance metrics across ${brandChannels}.
Provide clear, actionable insights with specific recommendations for improving performance on each platform.`

  const { data: run } = await db
    .from('cada_agent_runs')
    .insert({ agent: 'performance_reviewer', status: 'running', input: body })
    .select()
    .single()

  try {
    const metricsData = body.csvData ?? body.metricsText ?? 'No metrics provided'

    const insights = await generateText(
      SYSTEM_PROMPT,
      `Analyse ${brandName}'s marketing performance for report: “${body.title}”
Period: ${body.period ?? 'not specified'}

DATA:
${metricsData}

Provide a structured analysis with:
1. **Executive Summary** (2-3 sentences specific to ${brandName})
2. **Top 3 Wins** (what worked across our channels)
3. **Top 3 Areas for Improvement** (specific to our channels)
4. **Actionable Recommendations** for next period (channel-specific: ${brandChannels})
5. **${ctx.raw.brand_industry || 'Fashion'} Market Insights** — any broader trends we should act on

Keep recommendations practical for the brand's scale and market.`
    )

    const metrics: Record<string, unknown> = {}
    if (body.csvData) {
      const lines = body.csvData.split('\n').filter(Boolean)
      const headers = lines[0]?.split(',') ?? []
      if (lines.length > 1) {
        const values = lines[1]?.split(',') ?? []
        headers.forEach((h, i) => { metrics[h.trim()] = values[i]?.trim() })
      }
    }

    let driveUrl = ''
    try {
      const reportContent = `${brandName.toUpperCase()} PERFORMANCE REPORT\n=======================\n${body.title}\nPeriod: ${body.period ?? 'N/A'}\nGenerated: ${new Date().toLocaleString()}\n\n${insights}\n\n---\nRAW DATA:\n${metricsData}`
      driveUrl = await uploadTextToDrive({ fileName: `${brandName} Performance — ${body.title}.txt`, content: reportContent })
    } catch { /* Google key not set */ }

    const { data: report } = await db.from('cada_performance_reports')
      .insert({ title: body.title, metrics, insights, google_drive_url: driveUrl || null })
      .select().single()

    await db.from('cada_agent_runs').update({ status: 'completed', output: { report }, duration_ms: Date.now() - start }).eq('id', run!.id)
    return NextResponse.json({ success: true, report })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    await db.from('cada_agent_runs').update({ status: 'failed', error: msg, duration_ms: Date.now() - start }).eq('id', run!.id)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}

