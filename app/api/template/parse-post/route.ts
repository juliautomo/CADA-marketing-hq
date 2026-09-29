export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { generateText } from '@/lib/anthropic'

export async function POST(req: NextRequest) {
  const { image_concept, caption } = await req.json()
  if (!image_concept && !caption) return NextResponse.json({ error: 'content required' }, { status: 400 })

  const sys = `You extract structured fields from an Indonesian social media post concept. Output valid JSON only — no markdown, no explanation.`

  const usr = `Given this post content, extract structured template fields.

CAPTION:
${caption ?? '(none)'}

IMAGE CONCEPT:
${image_concept ?? '(none)'}

Extract and return a JSON object with these exact keys:
{
  "category": "SHORT CATEGORY IN CAPS (e.g. TIPS CLAUDE, AKTIVITAS HARIAN, PERBANDINGAN, CARA KERJA)",
  "headline": "Main bold headline text (Indonesian, max 8 words)",
  "subheadline": "Italic supporting headline (Indonesian, max 10 words)",
  "body": "Short body paragraph (Indonesian, 1-2 sentences, from the post message)",
  "tipsText": "Tips Praktis sentence (Indonesian, practical tip from the content, without the 'Tips Praktis:' prefix)",
  "visualType": "One of: timeline | comparison | checklist | steps | illustration-only",
  "timeline": [{"time": "HH:MM", "text": "activity"}],
  "comparison": {"leftLabel": "...", "rightLabel": "...", "items": [{"left": "...", "right": "..."}]},
  "checklist": [{"text": "...", "checked": true}],
  "steps": [{"number": "01", "text": "..."}]
}

Rules:
- Choose the most appropriate visualType based on the content
- Only populate the array/object for the chosen visualType; set others to their empty defaults
- timeline default: []
- comparison default: {"leftLabel":"Tanpa Claude","rightLabel":"Dengan Claude","items":[]}
- checklist default: []
- steps default: []
- Keep all text in Indonesian
- headline: short, punchy, title-case
- If content has time-based activities → timeline
- If content compares two states → comparison
- If content has a list of tips/rules → checklist
- If content has sequential steps → steps
- Otherwise → illustration-only`

  const raw = await generateText(sys, usr)

  // Parse the JSON — strip any accidental markdown fences
  const clean = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim()
  try {
    const parsed = JSON.parse(clean)
    return NextResponse.json({ fields: parsed })
  } catch {
    return NextResponse.json({ error: 'Failed to parse AI response', raw }, { status: 500 })
  }
}
