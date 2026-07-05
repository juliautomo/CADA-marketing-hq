import { NextRequest, NextResponse } from 'next/server'
import { analyzeImage } from '@/lib/anthropic'
import { getBrandContext } from '@/lib/brand'

// Convert a Google Drive share link to a direct image URL
function driveToDirectUrl(input: string): string {
  // Handle various Drive URL formats:
  // https://drive.google.com/file/d/FILE_ID/view
  // https://drive.google.com/open?id=FILE_ID
  // https://drive.google.com/uc?id=FILE_ID
  const fileIdMatch = input.match(/\/d\/([a-zA-Z0-9_-]+)/)
    ?? input.match(/[?&]id=([a-zA-Z0-9_-]+)/)

  if (fileIdMatch) {
    return `https://drive.google.com/uc?export=view&id=${fileIdMatch[1]}`
  }
  return input // Return as-is if not a Drive URL
}

export async function POST(req: NextRequest) {
  const ctx = await getBrandContext()
  const brandName = ctx.raw.brand_name || 'Your Brand'
  const SYSTEM = ctx.systemPrompt('Fashion Image Analyst') + `
You analyse images to extract styling insights and content opportunities for ${brandName}.`
  const contentType = req.headers.get('content-type') ?? ''

  try {
    let analysis

    if (contentType.includes('multipart/form-data')) {
      // ── File upload ───────────────────────────────────────────────
      const form = await req.formData()
      const file = form.get('image') as File | null
      if (!file) return NextResponse.json({ error: 'No image file provided' }, { status: 400 })

      const bytes = await file.arrayBuffer()
      const base64 = Buffer.from(bytes).toString('base64')
      const mediaType = (file.type as 'image/jpeg' | 'image/png' | 'image/webp') || 'image/jpeg'

      analysis = await analyzeImage({ type: 'base64', data: base64, mediaType }, SYSTEM)

    } else {
      // ── URL / Drive link ──────────────────────────────────────────
      const { url } = await req.json()
      if (!url) return NextResponse.json({ error: 'No URL provided' }, { status: 400 })

      const directUrl = driveToDirectUrl(url)
      analysis = await analyzeImage({ type: 'url', url: directUrl }, SYSTEM)
    }

    return NextResponse.json({ success: true, analysis })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Analysis failed'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
