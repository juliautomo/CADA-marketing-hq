import OpenAI from 'openai'

let _openai: OpenAI | null = null

function getClient() {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
  }
  return _openai
}

export async function generateImage(prompt: string): Promise<string> {
  const response = await getClient().images.generate({
    model: 'gpt-image-1',
    prompt,
    n: 1,
    size: '1024x1024',
    quality: 'high',
  })

  // gpt-image-1 returns base64, not a URL
  const imageData = response.data?.[0]
  if (!imageData) throw new Error('No image returned from OpenAI')

  // If it's a URL, return directly
  if (imageData.url) return imageData.url

  // If it's base64, convert to data URL
  if (imageData.b64_json) return `data:image/png;base64,${imageData.b64_json}`

  throw new Error('Unexpected image response format from OpenAI')
}
