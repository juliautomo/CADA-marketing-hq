import { NextRequest, NextResponse } from 'next/server'
import { generateImage } from '@/lib/openai'
import { generateText } from '@/lib/anthropic'
import { createServiceClient } from '@/lib/supabase'
import { getBrandSystemPrompt } from '@/lib/brand'
import type { ImageAnalysis } from '@/lib/anthropic'

export async function POST(req: NextRequest) {
  const body: { analysis: ImageAnalysis; customInstructions?: string } = await req.json()
  const { analysis, customInstructions } = body
  const db = createServiceClient()

  try {
    // Enhance the DALL-E prompt with CADA brand context and custom instructions
    const enhancedPrompt = await generateText(
      getBrandSystemPrompt('DALL-E Prompt Engineer') + '\nWrite detailed DALL-E 3 prompts for modest fashion imagery.',
      `Enhance this DALL-E prompt for a CADA modest fashion image.

Base prompt from image analysis: ${analysis.dallePrompt}

Key details to preserve:
- Product: ${analysis.product}
- Colors: ${analysis.colors.join(', ')}
- Silhouette: ${analysis.silhouette}
- Mood: ${analysis.mood}
- Styling: ${analysis.styling}

${customInstructions ? `Additional instructions: ${customInstructions}` : ''}

IMPORTANT requirements for CADA:
- Muslim woman wearing hijab
- Clothing is fully modest (covered wrists, ankles, neckline)
- High-fashion editorial quality
- Clean, professional studio or lifestyle setting
- Indonesian fashion aesthetic

Write ONLY the enhanced DALL-E prompt, nothing else. Be very specific and detailed (150-200 words).`
    )

    const imageUrl = await generateImage(enhancedPrompt)

    // Save to content library
    const { data: item } = await db.from('cada_content_items').insert({
      type: 'image',
      title: `Similar Image: ${analysis.product}`,
      image_url: imageUrl,
      metadata: {
        source: 'image_reference',
        original_analysis: analysis,
        dalle_prompt: enhancedPrompt,
        custom_instructions: customInstructions,
      },
      tags: ['image', 'reference-based', 'cada', 'dalle'],
    }).select().single()

    return NextResponse.json({ success: true, imageUrl, prompt: enhancedPrompt, item })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Image generation failed'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
