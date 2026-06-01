const RUNWAY_BASE = 'https://api.dev.runwayml.com/v1'

const MODEL_MAP = {
  kling:  { text: 'kling3.0_pro',  image: 'kling3.0_pro'  },
  runway: { text: 'gen4.5',        image: 'gen3a_turbo'    },
}

export async function generateVideo(
  prompt: string,
  duration: 5 | 10 = 5,
  imageUrl?: string,
  provider: 'runway' | 'kling' = 'kling',
): Promise<string> {
  const headers = {
    Authorization: `Bearer ${process.env.RUNWAYML_API_KEY}`,
    'Content-Type': 'application/json',
    'X-Runway-Version': '2024-11-06',
  }

  const model    = imageUrl ? MODEL_MAP[provider].image : MODEL_MAP[provider].text
  const endpoint = imageUrl ? `${RUNWAY_BASE}/image_to_video` : `${RUNWAY_BASE}/text_to_video`
  const body     = imageUrl
    ? { promptImage: imageUrl, promptText: prompt, model, duration }
    : { promptText: prompt, model, duration, ratio: '768:1280' }

  const createRes = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (!createRes.ok) {
    const err = await createRes.text()
    throw new Error(`Video create failed: ${err}`)
  }

  const { id } = await createRes.json()

  // Poll until complete (max 3 min)
  for (let i = 0; i < 36; i++) {
    await new Promise((r) => setTimeout(r, 5000))
    const pollRes = await fetch(`${RUNWAY_BASE}/tasks/${id}`, { headers })
    const task    = await pollRes.json()
    if (task.status === 'SUCCEEDED') return task.output[0] as string
    if (task.status === 'FAILED')    throw new Error(`Video generation failed: ${task.failure}`)
  }

  throw new Error('Video generation timed out')
}
