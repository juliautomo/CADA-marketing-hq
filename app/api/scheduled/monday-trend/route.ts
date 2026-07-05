export const dynamic = 'force-dynamic'
// Monday Trend Brief â€” runs every Monday at 8am via Vercel Cron
// Cron schedule defined in vercel.json: "0 8 * * 1"
// Can also be triggered manually from /automations

import { NextRequest, NextResponse } from 'next/server'
import { generateText } from '@/lib/anthropic'
import { uploadTextToDrive } from '@/lib/google'
import { createServiceClient } from '@/lib/supabase'
import { getBrandContext } from '@/lib/brand'

export async function GET(req: NextRequest) {
  // Verify cron secret to prevent unauthorized triggers
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const start = Date.now()
  const db = createServiceClient()

  const { data: setting } = await db.from('cada_settings').select('value').eq('key', 'automation_monday_trend_enabled').single()
  if (setting && setting.value === false) {
    return NextResponse.json({ success: true, message: 'Monday Trend Brief is disabled. Enable it in Automations settings.' })
  }
  const weekOf = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const ctx = await getBrandContext()
  const brandName    = ctx.raw.brand_name || 'Your Brand'
  const brandMarkets = ctx.raw.brand_markets || ''
  const brandIndustry = ctx.raw.brand_industry || ''
  const SYSTEM_PROMPT = ctx.systemPrompt('Monday Trend Analyst') + `

You are generating the weekly Monday morning trend brief for ${brandName}.
This brief will be read by the ${brandName} marketing team at the start of each week.
Be specific, actionable, and tailored to ${brandIndustry} in ${brandMarkets}.

You MUST use this EXACT format:

TRENDING COLORS:
- [color]
- [color]
- [color]
- [color]
- [color]

KEY SILHOUETTES:
- [silhouette]
- [silhouette]
- [silhouette]
- [silhouette]

TRENDING STYLES:
- [style]
- [style]
- [style]
- [style]
- [style]

TRENDING HASHTAGS:
- [hashtag without #]|[platform]|[why trending]
- [hashtag]|[platform]|[why trending]
- [hashtag]|[platform]|[why trending]
- [hashtag]|[platform]|[why trending]
- [hashtag]|[platform]|[why trending]

FULL ANALYSIS:
[3 paragraphs: macro trends, what ${brandName} should focus on this week, specific content recommendations for TikTok and Instagram]

THIS WEEK'S ACTION ITEMS:
- [specific action for ${brandName} this week]
- [specific action]
- [specific action]`

  try {
    const text = await generateText(
      SYSTEM_PROMPT,
      `Generate the Monday morning trend brief for ${brandName} for the week of ${weekOf}.
Focus on what's trending right now in ${brandIndustry} across ${brandMarkets}.
Highlight any upcoming events, holidays, or seasonal opportunities this week.
Include 5 specific content ideas ${brandName} can execute this week.`
    )

    // Parse sections
    function extractSection(label: string, src: string): string[] {
      const regex = new RegExp(`${label}[:\\s]*\\n([\\s\\S]*?)(?=\\n[A-Z ]+:|$)`, 'i')
      const match = src.match(regex)
      if (!match) return []
      return match[1]
        .split('\n')
        .map((l) => l.replace(/^[-â€¢*\d.]+\s*/, '').trim())
        .filter((l) => l.length > 1 && l.length < 200)
        .slice(0, 8)
    }

    const colors = extractSection('TRENDING COLORS', text)
    const silhouettes = extractSection('KEY SILHOUETTES', text)
    const styles = extractSection('TRENDING STYLES', text)
    const actionItems = extractSection("THIS WEEK'S ACTION ITEMS", text)

    const hashtagLines = extractSection('TRENDING HASHTAGS', text)
    const trending_hashtags = hashtagLines.map((line) => {
      const [tag, platform, description] = line.split('|').map((s) => s.trim())
      const cleanTag = (tag ?? '').replace(/^#/, '')
      return { tag: cleanTag, platform: platform ?? 'instagram', description: description ?? '', tiktok_url: `https://www.tiktok.com/tag/${cleanTag}`, instagram_url: `https://www.instagram.com/explore/tags/${cleanTag}` }
    }).filter((h) => h.tag)

    const analysisMatch = text.match(/FULL ANALYSIS[:\s]*\n([\s\S]+?)(?=THIS WEEK|$)/i)
    const summary = analysisMatch ? analysisMatch[1].trim() : text

    const title = `Monday Trend Brief â€” Week of ${weekOf}`

    // Save to DB
    const { data: report } = await db
      .from('cada_trend_reports')
      .insert({
        title,
        summary,
        colors,
        silhouettes,
        styles,
        trending_hashtags,
        trending_creators: [],
        trending_content: actionItems.map((item) => ({ format: 'Weekly Action', idea: item, why: 'Monday brief recommendation' })),
        mood_board_images: [],
        raw_data: { type: 'monday_brief', week_of: weekOf, action_items: actionItems },
      })
      .select()
      .single()

    // Export to Google Drive
    let driveUrl = ''
    try {
      const driveContent = [
        `${brandName.toUpperCase()} MONDAY TREND BRIEF`,
        `Week of ${weekOf}`,
        `Generated: ${new Date().toLocaleString()}`,
        `=========================`,
        ``,
        text,
      ].join('\n')

      driveUrl = await uploadTextToDrive({
        fileName: `${brandName} Monday Brief — ${weekOf}.txt`,
        content: driveContent,
      })
    } catch {
      // Drive not configured â€” saved to DB only
    }

    const duration = Date.now() - start

    return NextResponse.json({
      success: true,
      message: `Monday Trend Brief generated for week of ${weekOf}`,
      report: { ...report, driveUrl },
      duration_ms: duration,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}

