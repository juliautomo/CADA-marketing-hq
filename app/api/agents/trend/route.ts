export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { generateText } from '@/lib/anthropic'
import { searchFashionImages } from '@/lib/pexels'
import { createServiceClient } from '@/lib/supabase'
import { getBrandContext } from '@/lib/brand'
import type { TrendInput } from '@/types'

export async function POST(req: NextRequest) {
  const start = Date.now()
  const body: TrendInput = await req.json()
  const db = createServiceClient()
  const clientId = req.headers.get('x-client-id') ?? null
  const ctx = await getBrandContext(clientId)
  const brandName    = ctx.raw.brand_name || 'Your Brand'
  const brandMarkets = ctx.raw.brand_markets || ''
  const brandIndustry = ctx.raw.brand_industry || 'fashion'
  const SYSTEM_PROMPT = ctx.systemPrompt('Trend Analyst') + `

You are a leading trend analyst specialising in ${brandIndustry} and ${brandMarkets || 'Southeast Asian'} markets.
Today's date is ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.

You MUST respond using EXACTLY this format with these exact section headers — no deviations:

TRENDING COLORS:
- [specific color name]
- [specific color name]
- [specific color name]
- [specific color name]
- [specific color name]

KEY SILHOUETTES:
- [silhouette description]
- [silhouette description]
- [silhouette description]
- [silhouette description]

TRENDING STYLES:
- [style or aesthetic name]
- [style or aesthetic name]
- [style or aesthetic name]
- [style or aesthetic name]
- [style or aesthetic name]

TRENDING HASHTAGS:
- [hashtag without #]|[platform: tiktok or instagram]|[brief description of why it's trending]
- [hashtag without #]|[platform]|[description]
- [hashtag without #]|[platform]|[description]
- [hashtag without #]|[platform]|[description]
- [hashtag without #]|[platform]|[description]
- [hashtag without #]|[platform]|[description]

TRENDING CREATORS:
- [creator handle]|[platform: tiktok or instagram]|[follower count approx]|[why relevant to ${brandName}]
- [creator handle]|[platform]|[follower count]|[why relevant]
- [creator handle]|[platform]|[follower count]|[why relevant]
- [creator handle]|[platform]|[follower count]|[why relevant]

TRENDING CONTENT IDEAS:
- [content format]|[specific idea relevant to ${brandName}]|[why it works]
- [content format]|[specific idea]|[why it works]
- [content format]|[specific idea]|[why it works]
- [content format]|[specific idea]|[why it works]
- [content format]|[specific idea]|[why it works]

FULL ANALYSIS:
[Write 3 detailed paragraphs: (1) macro trend overview for ${brandIndustry}, (2) key pieces ${brandName} should focus on, (3) specific TikTok and Instagram Reels content strategy for ${brandName}]`

  const { data: run } = await db
    .from('cada_agent_runs')
    .insert({ agent: 'trend_analyst', status: 'running', input: body, client_id: clientId })
    .select()
    .single()

  try {
    const userMessage = `Analyse ${brandIndustry} trends for ${brandName}:
- Season: ${body.season ?? 'current season'}
- Market: ${body.market || brandMarkets || 'global'}
- Category: ${body.focus || brandIndustry}

Include real TikTok and Instagram creators relevant to this brand's market and industry.
Include hashtags that are actually trending in the ${brandIndustry} space right now.
Be specific — real creator handles, real hashtags, real content formats that perform well on TikTok and Instagram Reels.`

    const text = await generateText(SYSTEM_PROMPT, userMessage)

    // â”€â”€ Section parser â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€ Parse hashtags â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const hashtagLines = extractSection('TRENDING HASHTAGS', text)
    const trending_hashtags = hashtagLines.map((line) => {
      const [tag, platform, description] = line.split('|').map((s) => s.trim())
      const cleanTag = (tag ?? '').replace(/^#/, '')
      return {
        tag: cleanTag,
        platform: (platform ?? 'instagram').toLowerCase(),
        description: description ?? '',
        tiktok_url: `https://www.tiktok.com/tag/${cleanTag}`,
        instagram_url: `https://www.instagram.com/explore/tags/${cleanTag}`,
      }
    }).filter((h) => h.tag)

    // â”€â”€ Parse creators â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const creatorLines = extractSection('TRENDING CREATORS', text)
    const trending_creators = creatorLines.map((line) => {
      const [handle, platform, followers, reason] = line.split('|').map((s) => s.trim())
      const cleanHandle = (handle ?? '').replace(/^@/, '')
      const plat = (platform ?? 'instagram').toLowerCase()
      return {
        handle: cleanHandle,
        platform: plat,
        followers: followers ?? '',
        reason: reason ?? '',
        url: plat === 'tiktok'
          ? `https://www.tiktok.com/@${cleanHandle}`
          : `https://www.instagram.com/${cleanHandle}`,
      }
    }).filter((c) => c.handle)

    // â”€â”€ Parse content ideas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const contentLines = extractSection('TRENDING CONTENT IDEAS', text)
    const trending_content = contentLines.map((line) => {
      const [format, idea, why] = line.split('|').map((s) => s.trim())
      return { format: format ?? '', idea: idea ?? '', why: why ?? '' }
    }).filter((c) => c.format)

    // â”€â”€ Full analysis â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const analysisMatch = text.match(/FULL ANALYSIS[:\s]*\n([\s\S]+)$/i)
    const summary = analysisMatch ? analysisMatch[1].trim() : text

    // â”€â”€ Pexels mood board â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Build search query from top styles + focus
    const imageQuery = [
      body.focus ?? brandIndustry ?? 'fashion',
      styles[0] ?? '',
      colors[0] ?? '',
    ].filter(Boolean).join(' ')

    const pexelsPhotos = await searchFashionImages(imageQuery, 6)
    const mood_board_images = pexelsPhotos.map((p) => ({
      id: p.id,
      url: p.src.medium,
      large_url: p.src.large,
      photographer: p.photographer,
      photographer_url: p.photographer_url,
      alt: p.alt,
      pexels_url: p.url,
    }))

    // â”€â”€ Save to DB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const title = `Trend Report â€” ${body.season ?? 'Current Season'} ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}${body.focus ? ` Â· ${body.focus}` : ' Â· Modest Fashion'}`

    const { data: report } = await db
      .from('cada_trend_reports')
      .insert({
        title,
        summary,
        colors,
        silhouettes,
        styles,
        mood_board_images,
        trending_hashtags,
        trending_creators,
        trending_content,
        raw_data: { focus: body.focus, season: body.season, market: body.market },
        client_id: clientId,
      })
      .select()
      .single()

    await db.from('cada_agent_runs')
      .update({ status: 'completed', output: { report }, duration_ms: Date.now() - start })
      .eq('id', run!.id)

    return NextResponse.json({ success: true, report })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    await db.from('cada_agent_runs')
      .update({ status: 'failed', error: msg, duration_ms: Date.now() - start })
      .eq('id', run!.id)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}

