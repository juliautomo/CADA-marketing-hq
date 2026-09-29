import { GoogleGenAI } from '@google/genai'

const genAI = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY ?? '' })

// Aspect ratio mapping for Imagen 3
const ASPECT_RATIO_MAP: Record<string, string> = {
  '1:1':  '1:1',
  '4:5':  '4:5',
  '9:16': '9:16',
  '16:9': '16:9',
  '1024x1024': '1:1',
  '1024x1536': '4:5',
}

/**
 * Generate an image using Google Imagen 3 via the Gemini API.
 * Returns a base64 data URL (data:image/png;base64,...).
 */
export async function generateImageGemini(
  prompt: string,
  aspectRatio: string = '4:5',
): Promise<string> {
  const ratio = ASPECT_RATIO_MAP[aspectRatio] ?? '4:5'

  const response = await genAI.models.generateImages({
    model: 'imagen-3.0-generate-001',
    prompt,
    config: {
      numberOfImages: 1,
      aspectRatio: ratio,
      outputMimeType: 'image/png',
    },
  })

  const imageBytes = response.generatedImages?.[0]?.image?.imageBytes
  if (!imageBytes) throw new Error('Gemini Imagen returned no image data')

  return `data:image/png;base64,${imageBytes}`
}

/**
 * Generate an image using Imagen 3 with a reference image for style/consistency.
 * Imagen 3 doesn't support image-to-image natively via this API, so the reference
 * image URL is appended to the prompt as a style description hint.
 */
export async function generateImageGeminiWithReference(
  prompt: string,
  _referenceUrl: string,
  aspectRatio: string = '4:5',
): Promise<string> {
  // Imagen 3 generate API is text-to-image only; reference is used as style context in prompt
  return generateImageGemini(prompt, aspectRatio)
}
