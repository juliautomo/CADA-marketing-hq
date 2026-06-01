// Runway ML API client
// Docs: https://docs.runwayml.com/

const RUNWAY_BASE = 'https://api.dev.runwayml.com/v1'

export async function generateVideo(prompt: string, duration: 5 | 10 = 5, imageUrl?: string): Promise<string> {
  const headers = {
    Authorization: `Bearer ${process.env.RUNWAYML_API_KEY}`,
    'Content-Type': 'application/json',
    'X-Runway-Version': '2024-11-06',
  }

  // Create a generation task
  const body = imageUrl
    ? { promptImage: imageUrl, promptText: prompt, model: 'gen3a_turbo', duration }
    : { promptText: prompt, model: 'gen3a_turbo', duration }

  const createRes = await fetch(`${RUNWAY_BASE}/image_to_video`, {
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
    const task = await pollRes.json()
    if (task.status === 'SUCCEEDED') return task.output[0] as string
    if (task.status === 'FAILED') throw new Error(`Runway task failed: ${task.failure}`)
  }

  throw new Error('Runway generation timed out')
}
