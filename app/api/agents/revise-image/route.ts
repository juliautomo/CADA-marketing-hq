export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { generateImageWithReference } from '@/lib/openai'

export async function POST(req: NextRequest) {
  const { imageUrl, feedback } = await req.json()

  if (!imageUrl) return NextResponse.json({ error: 'imageUrl required' }, { status: 400 })
  if (!feedback?.trim()) return NextResponse.json({ error: 'feedback required' }, { status: 400 })

  const clientId = req.headers.get('x-client-id') ?? null

  const prompt = `Edit this image. Keep everything exactly the same except: ${feedback.trim()}. Do not change the composition, style, colors, or any other elements unless explicitly mentioned.`

  const revisedUrl = await generateImageWithReference(prompt, imageUrl, '1024x1024', 'medium')

  const db = createServiceClient()
  const { data } = await db.from('cada_content_items')
    .insert({
      type: 'image',
      title: `Image revision`,
      image_url: revisedUrl,
      tags: ['image', 'revision', 'gpt'],
      client_id: clientId,
    })
    .select().single()

  return NextResponse.json({ imageUrl: revisedUrl, item: data })
}
