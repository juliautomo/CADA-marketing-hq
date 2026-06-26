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

  // Initialize video upload
  const initRes = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify({
      post_info: {
        title: caption,
        privacy_level: 'SELF_ONLY', // safe default — change to PUBLIC_TO_EVERYONE for real posts
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
        video_cover_timestamp_ms: coverTimestamp,
      },
      source_info: {
        source: 'PULL_FROM_URL',
        video_url: videoUrl,
      },
    }),
  })

  const initData = await initRes.json()

  if (initData.error?.code !== 'ok') {
    return NextResponse.json({ error: initData.error?.message ?? 'TikTok post failed' }, { status: 500 })
  }

  const publishId = initData.data?.publish_id

  // Log to agent runs
  await supabase.from('cada_agent_runs').insert({
    agent: 'tiktok_post',
    status: 'completed',
    input: { videoUrl, caption },
    output: { publish_id: publishId, open_id: openId },
  })

  return NextResponse.json({ success: true, publish_id: publishId })
}
