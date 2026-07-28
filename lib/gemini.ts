import { GoogleGenAI } from '@google/genai'
import { createServiceClient } from './supabase'

const MODEL = 'gemini-3.1-flash-image'

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set')
  return new GoogleGenAI({ apiKey })
}

async function uploadBase64ToSupabase(base64: string, mimeType: string): Promise<string> {
  const ext = mimeType.includes('png') ? 'png' : 'jpg'
  const path = `gemini/${Date.now()}.${ext}`
  const buffer = Buffer.from(base64, 'base64')
  const db = createServiceClient()
  const { error } = await db.storage.from('product-images').upload(path, buffer, {
    contentType: mimeType,
    upsert: true,
  })
  if (error) throw new Error(`Supabase upload failed: ${error.message}`)
  const { data } = db.storage.from('product-images').getPublicUrl(path)
  return data.publicUrl
}

export async function generateImageGemini(
  prompt: string,
  aspectRatio: '1:1' | '4:5' | '9:16' = '1:1',
): Promise<string> {
  const ai = getClient()
  const interaction = await (ai as any).interactions.create({
    model: MODEL,
    input: prompt,
    config: { aspectRatio },
  })
  const img = interaction.output_image
  if (!img?.data) throw new Error('Gemini returned no image')
  return uploadBase64ToSupabase(img.data, img.mimeType ?? 'image/png')
}

export async function generateImageGeminiWithReference(
  prompt: string,
  referenceUrl: string,
  aspectRatio: '1:1' | '4:5' | '9:16' = '1:1',
): Promise<string> {
  const ai = getClient()
  // Fetch reference image and convert to base64
  const res = await fetch(referenceUrl)
  const arrayBuffer = await res.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString('base64')
  const mimeType = res.headers.get('content-type') ?? 'image/jpeg'

  const interaction = await (ai as any).interactions.create({
    model: MODEL,
    input: [
      { inlineData: { mimeType, data: base64 } },
      { text: prompt },
    ],
    config: { aspectRatio },
  })
  const img = interaction.output_image
  if (!img?.data) throw new Error('Gemini returned no image')
  return uploadBase64ToSupabase(img.data, img.mimeType ?? 'image/png')
}
