import { fal } from '@fal-ai/client'

fal.config({ credentials: process.env.FAL_API_KEY })

interface FluxResult {
  images: { url: string }[]
}

export async function generateImageFlux(
  prompt: string,
  aspectRatio: '1:1' | '9:16' | '4:5' = '1:1',
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (fal.subscribe as any)('fal-ai/flux-pro/v1.1', {
    input: {
      prompt,
      aspect_ratio: aspectRatio,
      num_images: 1,
      safety_tolerance: '2',
      output_format: 'jpeg',
    },
  }) as { data: FluxResult }

  const url = result.data?.images?.[0]?.url
  if (!url) throw new Error('No image returned from Flux')
  return url
}
