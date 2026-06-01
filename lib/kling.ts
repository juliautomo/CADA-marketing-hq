import * as jose from 'jose'

const KLING_BASE = 'https://api.klingai.com/v1'

async function getToken(): Promise<string> {
  const ak     = process.env.KLING_ACCESS_KEY!
  const sk     = process.env.KLING_SECRET_KEY!
  const secret = new TextEncoder().encode(sk)
  return new jose.SignJWT({ iss: ak })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30m')
    .setNotBefore('-5s')
    .sign(secret)
}

async function headers() {
  return {
    Authorization: `Bearer ${await getToken()}`,
    'Content-Type': 'application/json',
  }
}

export async function generateVideoKling(
  prompt: string,
  duration: 5 | 10 = 5,
  imageUrl?: string,
): Promise<string> {
  const h = await headers()

  const isImage  = !!imageUrl
  const endpoint = isImage ? '/videos/image2video' : '/videos/text2video'
  const body     = isImage
    ? { model_name: 'kling-v2-master', image_url: imageUrl, prompt, duration, aspect_ratio: '9:16', mode: 'pro' }
    : { model_name: 'kling-v2-master', prompt, duration, aspect_ratio: '9:16', mode: 'pro' }

  const createRes = await fetch(`${KLING_BASE}${endpoint}`, {
    method: 'POST',
    headers: h,
    body: JSON.stringify(body),
  })

  if (!createRes.ok) {
    const err = await createRes.text()
    throw new Error(`Kling create failed: ${err}`)
  }

  const { data } = await createRes.json()
  const taskId   = data.task_id
  const pollPath = isImage ? `/videos/image2video/${taskId}` : `/videos/text2video/${taskId}`

  // Poll until complete (max 3 min)
  for (let i = 0; i < 36; i++) {
    await new Promise((r) => setTimeout(r, 5000))
    const ph = await headers()
    const pollRes = await fetch(`${KLING_BASE}${pollPath}`, { headers: ph })
    const { data: task } = await pollRes.json()
    if (task.task_status === 'succeed') return task.task_result.videos[0].url as string
    if (task.task_status === 'failed')  throw new Error(`Kling task failed: ${task.task_status_msg}`)
  }

  throw new Error('Kling generation timed out')
}
