export const dynamic = 'force-dynamic'
export const maxDuration = 60
import { NextRequest, NextResponse } from 'next/server'
import { generateImage, generateImageWithReference, uploadBase64ToStorage, generateTextOpenAI } from '@/lib/openai'
import { generateImageGemini } from '@/lib/gemini'
import { getBrandContext } from '@/lib/brand'
import { generateText } from '@/lib/anthropic'

export async function POST(req: NextRequest) {
  const { prompt, model = 'gpt-image-1' } = await req.json()
  if (!prompt) return NextResponse.json({ error: 'prompt required' }, { status: 400 })

  const clientId = req.headers.get('x-client-id') ?? null
  const ctx = await getBrandContext(clientId)
  const colorDesc = ctx.raw.brand_color_description ?? ''
  const referenceUrl = ctx.referenceImageUrl

  // Rewrite prompt to match brand illustration style
  const sys = `You rewrite illustration prompts for an Indonesian EdTech brand. Output ONLY the rewritten prompt — no explanation.`
  const usr = `BRAND STYLE: 3D cartoon-style illustration, rounded friendly shapes, purple/violet color palette${colorDesc ? `, ${colorDesc}` : ''}. White or very light background. Single hero character or object. No text, no typography, no UI elements, no logos. Clean and minimal.

RULES:
- Output a single illustration, not a full poster layout
- No text, labels, or typography in the image
- No brand logo or wordmark
- Purple/violet tones, friendly 3D cartoon style
- White or near-white background

CONCEPT: ${prompt}

Rewrite as a focused illustration prompt. Output only the prompt.`

  const rewritten = await generateText(sys, usr)

  let url: string
  if (model === 'gemini-nano-banana-2' || model === 'gemini-nano-banana-2-lite' || model === 'gemini-nano-banana-pro') {
    const modelMap: Record<string, string> = {
      'gemini-nano-banana-2':      'gemini-3.1-flash-image',
      'gemini-nano-banana-2-lite': 'gemini-3.1-flash-lite-image',
      'gemini-nano-banana-pro':    'gemini-3-pro-image',
    }
    url = await generateImageGemini(rewritten, '1:1', modelMap[model])
  } else if (model === 'dall-e-3') {
    const { generateImageDalle3 } = await import('@/lib/openai')
    url = await generateImageDalle3(rewritten, '1024x1024', 'standard')
  } else {
    url = referenceUrl
      ? await generateImageWithReference(rewritten, referenceUrl, '1024x1024', 'medium')
      : await generateImage(rewritten, '1024x1024', 'medium')
  }

  // Upload base64 data URLs to storage so they're accessible via <img>
  if (url.startsWith('data:')) {
    url = await uploadBase64ToStorage(url)
  }

  return NextResponse.json({ url, prompt: rewritten })
}
