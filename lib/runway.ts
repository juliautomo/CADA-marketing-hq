const RUNWAY_BASE = 'https://api.dev.runwayml.com/v1'

export async function generateVideoRunway(
  prompt: string,
  duration: 5 | 10 = 5,
  imageUrl?: string,
): Promise<string> {
  const headers = {
    Authorization: `Bearer ${process.env.RUNWAYML_API_KEY}`,
    'Content-Type': 'application/json',
    'X-Runway-Version': '2024-11-06',
  }

  const isImage  = !!imageUrl
  const endpoint = isImage ? `${RUNWAY_BASE}/image_to_video` : `${RUNWAY_BASE}/text_to_video`
  const model    = isImage ? 'gen3a_turbo' : 'gen4.5'
  const body     = isImage
    ? { promptImage: imageUrl, promptText: prompt, model, duration }
    : { promptText: prompt, model, duration, ratio: '1280:720' }

  const createRes = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (!createRes.ok) {
    const err = await createRes.text()
    throw new Error(`Runway create failed: ${err}`)
  }

  const { id } = await createRes.json()

  // Poll until complete (max 3 min)
  for (let i = 0; i < 36; i++) {
    await new Promise((r) => setTimeout(r, 5000))
    const pollRes = await fetch(`${RUNWAY_BASE}/tasks/${id}`, { headers })
    const task    = await pollRes.json()
    if (task.status === 'SUCCEEDED') return task.output[0] as string
    if (task.status === 'FAILED')    throw new Error(`Runway task failed: ${task.failure}`)
  }

  throw new Error('Runway generation timed out')
}

// References to Video — uses Seedance2 with up to 3 reference images
// Images used as style/subject reference, NOT as starting frame
export async function generateVideoRunwayRef(
  prompt: string,
  referenceUrls: string[],
  duration: 5 | 10 = 5,
): Promise<string> {
  const headers = {
    Authorization: `Bearer ${process.env.RUNWAYML_API_KEY}`,
    'Content-Type': 'application/json',
    'X-Runway-Version': '2024-11-06',
  }

  const body = {
    model: 'seedance2',
    promptText: prompt,
    referenceImages: referenceUrls.slice(0, 3),
    duration,
    ratio: '1280:720',
  }

  const createRes = await fetch(`${RUNWAY_BASE}/text_to_video`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (!createRes.ok) {
    const err = await createRes.text()
    throw new Error(`Runway References failed: ${err}`)
  }

  const { id } = await createRes.json()

  for (let i = 0; i < 36; i++) {
    await new Promise((r) => setTimeout(r, 5000))
    const pollRes = await fetch(`${RUNWAY_BASE}/tasks/${id}`, { headers })
    const task    = await pollRes.json()
    if (task.status === 'SUCCEEDED') return task.output[0] as string
    if (task.status === 'FAILED')    throw new Error(`Runway References failed: ${task.failure}`)
  }

  throw new Error('Runway References generation timed out')
}
