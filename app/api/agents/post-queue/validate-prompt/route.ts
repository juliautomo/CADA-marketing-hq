export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getBrandContext } from '@/lib/brand'
import { generateText } from '@/lib/anthropic'
import { getClientIdFromRequest } from '@/lib/get-client-id'

export async function POST(req: NextRequest) {
  const { postId } = await req.json()
  if (!postId) return NextResponse.json({ success: false, error: 'postId required' }, { status: 400 })

  const clientId = getClientIdFromRequest(req)
  const db = createServiceClient()

  const { data: post } = await db.from('cada_scheduled_posts').select('image_concept, client_id').eq('id', postId).single()
  if (!post) return NextResponse.json({ success: false, error: 'Post not found' }, { status: 404 })

  const concept = post.image_concept as string | null
  if (!concept) return NextResponse.json({ success: true, pass: true, issue: null, fixedPrompt: '' })

  const ctx = await getBrandContext((post.client_id as string | null) ?? clientId)
  const stylePrefix = ctx.raw.brand_style_prefix ?? ''
  const colorDesc   = ctx.raw.brand_color_description ?? ''
  const shotStyle   = ctx.raw.brand_shot_style ?? ''
  const negatives   = ctx.raw.brand_negative_prompts ?? ''
  const imageInstructions = ctx.raw.brand_image_instructions ?? ''

  const brandStyleGuide = [
    stylePrefix && `Visual style: ${stylePrefix}`,
    shotStyle   && `Composition: ${shotStyle}`,
    colorDesc   && `Colors: ${colorDesc}`,
    negatives   && `Avoid: ${negatives}`,
  ].filter(Boolean).join('\n')

  // Step 1: rewrite concept to match brand style
  const rewritten = await generateText(
    `You rewrite image generation prompts to match a specific brand's visual style. Output ONLY the rewritten prompt — no explanation, no preamble.`,
    `${brandStyleGuide ? `BRAND VISUAL STYLE:\n${brandStyleGuide}\n\n` : ''}${imageInstructions ? `IMAGE GENERATION RULES:\n${imageInstructions}\n\n` : ''}ORIGINAL CONCEPT:\n${concept}\n\nRewrite this concept following all rules above. Keep the same message and information. Output only the rewritten prompt.`
  )

  // Step 2: validate rewritten prompt against brand rules (no image cost)
  if (!negatives && !stylePrefix && !shotStyle) {
    return NextResponse.json({ success: true, pass: true, issue: null, fixedPrompt: rewritten })
  }

  const check = await generateText(
    `You are a brand compliance checker for image generation prompts. Be strict and specific.`,
    `BRAND RULES:
${stylePrefix ? `Required visual style: ${stylePrefix}` : ''}
${shotStyle ? `Required composition: ${shotStyle}` : ''}
${negatives ? `MUST AVOID: ${negatives}` : ''}

IMAGE PROMPT TO CHECK:
${rewritten}

Does this prompt violate any brand rule? Reply with ONLY one of:
- "OK" if the prompt fully complies
- A one-line correction starting with "FIX:" describing exactly what to change`
  )

  if (!check.trim().startsWith('FIX:')) {
    return NextResponse.json({ success: true, pass: true, issue: null, fixedPrompt: rewritten })
  }

  const issue = check.replace(/^FIX:\s*/i, '').trim()

  // Step 3: fix the prompt
  const fixedPrompt = await generateText(
    `You rewrite image generation prompts to fix a specific brand compliance issue. Output ONLY the corrected prompt — no explanation.`,
    `ORIGINAL PROMPT:\n${rewritten}\n\nBRAND COMPLIANCE FIX REQUIRED:\n${issue}\n\nRewrite the prompt applying this fix while keeping all other content intact.`
  )

  return NextResponse.json({ success: true, pass: false, issue, fixedPrompt })
}
