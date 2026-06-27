export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { videoUrl, caption, coverTimestamp = 0 } = await req.json()

  const supabase = createServiceClient()
  const { data } = await supabase.from('cada_settings')
    .select('key, value')
    .in('key', ['tiktok_access_token', 'tiktok_open_id'])

  const settings: Record<string, string> = {}
  for (const row of data ?? []) {
    settings[row.key] = typeof row.value === 'string' ? row.value : JSON.stringify(row.value)
  }

  const accessToken = settings['tiktok_access_token']
  const openId = settings['tiktok_open_id']

  if (!accessToken || accessToken === 'null') {
    return NextResponse.json({ error: 'TikTok not connected. Go to Settings → Connections.' }, { status: 401 })
  }

  // Fetch video from Supabase storage
  const videoRes = await fetch(videoUrl)
  if (!videoRes.ok) {
    return NextResponse.json({ error: 'Could not fetch video from storage' }, { status: 500 })
  }
  const videoBuffer = await videoRes.arrayBuffer()
  const videoSize = videoBuffer.byteLength

  // Step 1: Initialize upload — posts to user's inbox as draft (avoids UX guideline restrictions)
  const initRes = await fetch('https://open.tiktokapis.com/v2/post/publish/inbox/video/init/', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify({
      source_info: {
        source: 'FILE_UPLOAD',
        video_size: videoSize,
        chunk_size: videoSize,
        total_chunk_count: 1,
      },
    }),
  })

  const initData = await initRes.json()

  if (initData.error?.code !== 'ok') {
    return NextResponse.json({ error: initData.error?.message ?? 'TikTok init failed' }, { status: 500 })
  }

  const publishId = initData.data?.publish_id
  const uploadUrl = initData.data?.upload_url

  // Step 2: Upload video chunk
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Range': `bytes 0-${videoSize - 1}/${videoSize}`,
      'Content-Length': String(videoSize),
    },
    body: videoBuffer,
  })

  if (!uploadRes.ok) {
    const uploadErr = await uploadRes.text()
    return NextResponse.json({ error: `Upload failed: ${uploadErr}` }, { status: 500 })
  }

  // Log to agent runs
  await supabase.from('cada_agent_runs').insert({
    agent: 'tiktok_post',
    status: 'completed',
    input: { videoUrl, caption },
    output: { publish_id: publishId, open_id: openId },
  })

  return NextResponse.json({ success: true, publish_id: publishId })
}
