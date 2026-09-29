import { GoogleGenAI } from '@google/genai'

const genAI = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY ?? '' })

/**
 * Generate an image using Gemini 2.0 Flash image generation via generateContent.
 * This uses the broadly-available Flash model rather than Imagen 3 (which has
 * regional restrictions). Returns a base64 data URL.
 */
export async function generateImageGemini(
  prompt: string,
  _aspectRatio: string = '4:5',
  model: string = 'gemini-3.1-flash-image',
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response = await (genAI.models as any).generateContent({
    model,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      responseModalities: ['IMAGE', 'TEXT'],
    },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parts: any[] = response?.candidates?.[0]?.content?.parts ?? []
  const imagePart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith('image/'))
  if (!imagePart?.inlineData?.data) throw new Error('Gemini Flash returned no image data')

  const { mimeType, data } = imagePart.inlineData
  return `data:${mimeType};base64,${data}`
}

export async function generateImageGeminiWithReference(
  prompt: string,
  _referenceUrl: string,
  aspectRatio: string = '4:5',
  model: string = 'gemini-3.1-flash-image',
): Promise<string> {
  return generateImageGemini(prompt, aspectRatio, model)
}
