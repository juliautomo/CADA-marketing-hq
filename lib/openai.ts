import OpenAI, { toFile } from 'openai'

let _openai: OpenAI | null = null

function getClient() {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
  }
  return _openai
}

function extractBase64Result(data: OpenAI.Images.Image[] | undefined): string {
  const imageData = data?.[0]
  if (!imageData) throw new Error('No image returned from OpenAI')
  if (imageData.url) return imageData.url
  if (imageData.b64_json) return `data:image/png;base64,${imageData.b64_json}`
  throw new Error('Unexpected image response format from OpenAI')
}

export async function generateImage(
  prompt: string,
  size: '1024x1024' | '1024x1536' = '1024x1024',
  quality: 'low' | 'medium' | 'high' = 'medium',
): Promise<string> {
  const response = await getClient().images.generate({
    model: 'gpt-image-1',
    prompt,
    n: 1,
    size,
    quality,
  })
  return extractBase64Result(response.data)
}

export async function generateImageWithReference(
  prompt: string,
  referenceUrl: string,
  size: '1024x1024' | '1024x1536' = '1024x1024',
  quality: 'low' | 'medium' | 'high' = 'medium',
): Promise<string> {
  const res = await fetch(referenceUrl)
  if (!res.ok) throw new Error(`Failed to fetch reference image: ${res.status}`)
  const buffer = Buffer.from(await res.arrayBuffer())
  const file = await toFile(buffer, 'reference.png', { type: 'image/png' })

  const response = await getClient().images.edit({
    model: 'gpt-image-1',
    image: file,
    prompt,
    n: 1,
    size,
  })
  return extractBase64Result(response.data)
}

export async function generateImageGPT5(
  prompt: string,
  size: '1024x1024' | '1024x1536' = '1024x1024',
  referenceUrl?: string,
): Promise<string> {
  const client = getClient()
  const sizeParam = size === '1024x1024' ? '1024x1024' : '1024x1536'

  let imageData: string | undefined
  if (referenceUrl) {
    const res = await fetch(referenceUrl)
    if (!res.ok) throw new Error(`Failed to fetch reference image: ${res.status}`)
    const buffer = Buffer.from(await res.arrayBuffer())
    const mime = res.headers.get('content-type') ?? 'image/png'
    imageData = `data:${mime};base64,${buffer.toString('base64')}`
  }

  const input: object[] = imageData
    ? [
        {
          role: 'user',
          content: [
            { type: 'input_image', image_url: imageData },
            { type: 'input_text', text: prompt },
          ],
        },
      ]
    : [{ role: 'user', content: prompt }]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response = await (client as any).responses.create({
    model: 'gpt-5.6',
    input,
    tools: [{ type: 'image_generation', size: sizeParam }],
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const imageOutput = (response.output as any[]).find((o: any) => o.type === 'image_generation_call')
  if (!imageOutput?.result) throw new Error('GPT-5 returned no image')
  return `data:image/png;base64,${imageOutput.result}`
}

export async function generateImageWithReferences(
  prompt: string,
  referenceUrls: string[],
  size: '1024x1024' | '1024x1536' = '1024x1024',
  quality: 'low' | 'medium' | 'high' = 'medium',
): Promise<string> {
  const files = await Promise.all(
    referenceUrls.map(async (url, i) => {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Failed to fetch reference image ${i}: ${res.status}`)
      const buffer = Buffer.from(await res.arrayBuffer())
      return toFile(buffer, `reference-${i}.png`, { type: 'image/png' })
    })
  )

  const response = await getClient().images.edit({
    model: 'gpt-image-1',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    image: files as any,
    prompt,
    n: 1,
    size,
  })
  return extractBase64Result(response.data)
}
