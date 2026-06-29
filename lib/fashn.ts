const BASE = 'https://api.fashn.ai/v1'

export async function runVirtualTryOn(params: {
  modelImageUrl: string
  garmentImageUrl: string
}): Promise<string> {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${process.env.FASHN_API_KEY}`,
  }

  const createRes = await fetch(`${BASE}/run`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model_name: 'tryon-v1.6',
      inputs: {
        model_image: params.modelImageUrl,
        garment_image: params.garmentImageUrl,
      },
    }),
  })

  if (!createRes.ok) {
    const err = await createRes.text()
    throw new Error(`Fashn.ai try-on failed: ${err}`)
  }

  const { id } = await createRes.json()
  if (!id) throw new Error('No prediction ID returned from Fashn.ai')

  // Poll every 3s, max 2 minutes
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 3000))
    const statusRes = await fetch(`${BASE}/status/${id}`, { headers })
    const data = await statusRes.json()
    if (data.status === 'completed') {
      const url = data.output?.[0]
      if (!url) throw new Error('No output image from Fashn.ai')
      return url as string
    }
    if (data.status === 'failed') throw new Error(`Fashn.ai failed: ${data.error}`)
  }

  throw new Error('Fashn.ai try-on timed out')
}
