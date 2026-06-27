export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { mediaUrl, caption, mediaType = 'IMAGE' } = await req.json()

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('cada_settings')
    .select('key, value')
    .in('key', ['instagram_user_token', 'instagram_page_token', 'instagram_business_account_id', 'instagram_page_id'])

  const settings: Record<string, string> = {}
  for (const row of data ?? []) {
    settings[row.key] = typeof row.value === 'string' ? row.value : JSON.stringify(row.value)
  }

  // Prefer page token, fall back to user token
  const token = settings['instagram_page_token'] ?? settings['instagram_user_token']
  let igUserId = settings['instagram_business_account_id']

  if (!token || token === 'null') {
    return NextResponse.json({ error: 'Instagram not connected. Go to Settings → Connections.' }, { status: 401 })
  }

  // If no IG user ID, try to fetch it from the page
  if (!igUserId || igUserId === 'null') {
    const pageId = settings['instagram_page_id']
    if (pageId && pageId !== 'null') {
      const pageRes = await fetch(
        `https://graph.facebook.com/v25.0/${pageId}?fields=instagram_business_account&access_token=${token}`
      )
      const pageData = await pageRes.json()
      igUserId = pageData.instagram_business_account?.id
    }
    // Last resort: try known CADA page ID
    if (!igUserId) {
      const pageRes = await fetch(
        `https://graph.facebook.com/v25.0/61582752606289?fields=instagram_business_account&access_token=${token}`
      )
      const pageData = await pageRes.json()
      igUserId = pageData.instagram_business_account?.id
    }
    if (!igUserId) {
      return NextResponse.json({ error: 'Instagram Business Account not found. Please reconnect in Settings.' }, { status: 400 })
    }
    // Save for next time
    await supabase.from('cada_settings').upsert([
      { key: 'instagram_business_account_id', value: igUserId, updated_at: new Date().toISOString() },
    ])
  }

  // Step 1: Create media container
  const isVideo = mediaType === 'REELS' || mediaType === 'VIDEO'
  const containerBody: Record<string, string> = {
    caption,
    access_token: token,
  }
  if (isVideo) {
    containerBody.media_type = 'REELS'
    containerBody.video_url = mediaUrl
    containerBody.share_to_feed = 'true'
  } else {
    containerBody.image_url = mediaUrl
  }

  const containerRes = await fetch(`https://graph.facebook.com/v25.0/${igUserId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(containerBody),
  })
  const containerData = await containerRes.json()

  if (!containerData.id) {
    return NextResponse.json({ error: containerData.error?.message ?? 'Failed to create media container' }, { status: 500 })
  }

  // For Reels, wait for processing
  if (isVideo) {
    let ready = false
    for (let i = 0; i < 12; i++) {
      await new Promise(r => setTimeout(r, 5000))
      const statusRes = await fetch(
        `https://graph.facebook.com/v25.0/${containerData.id}?fields=status_code&access_token=${token}`
      )
      const statusData = await statusRes.json()
      if (statusData.status_code === 'FINISHED') { ready = true; break }
      if (statusData.status_code === 'ERROR') {
        return NextResponse.json({ error: 'Video processing failed on Instagram' }, { status: 500 })
      }
    }
    if (!ready) {
      return NextResponse.json({ error: 'Video processing timed out — try again in a minute' }, { status: 500 })
    }
  }

  // Step 2: Publish
  const publishRes = await fetch(`https://graph.facebook.com/v25.0/${igUserId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: containerData.id, access_token: token }),
  })
  const publishData = await publishRes.json()

  if (!publishData.id) {
    return NextResponse.json({ error: publishData.error?.message ?? 'Failed to publish to Instagram' }, { status: 500 })
  }

  await supabase.from('cada_agent_runs').insert({
    agent: 'instagram_post',
    status: 'completed',
    input: { mediaUrl, caption, mediaType },
    output: { post_id: publishData.id, ig_user_id: igUserId },
  })

  return NextResponse.json({ success: true, post_id: publishData.id })
}
