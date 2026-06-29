export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET() {
  const supabase = createServiceClient()

  // Get Instagram token + business account ID
  const { data: settingsRows } = await supabase
    .from('cada_settings')
    .select('key, value')
    .in('key', ['instagram_page_token', 'instagram_user_token', 'instagram_business_account_id'])

  const settings: Record<string, string> = {}
  for (const row of settingsRows ?? []) {
    settings[row.key] = typeof row.value === 'string' ? row.value : JSON.stringify(row.value)
  }

  const token = settings['instagram_page_token'] ?? settings['instagram_user_token']
  const igUserId = settings['instagram_business_account_id']

  if (!token || token === 'null' || !igUserId || igUserId === 'null') {
    return NextResponse.json({ error: 'Instagram not connected', posts: [] })
  }

  // Fetch all media from the Instagram account
  const mediaRes = await fetch(
    `https://graph.facebook.com/v25.0/${igUserId}/media?fields=id,caption,media_type,media_url,thumbnail_url,timestamp,permalink,like_count,comments_count&limit=50&access_token=${token}`
  )
  const mediaData = await mediaRes.json()

  if (!mediaData.data) {
    const igError = mediaData.error?.message ?? 'Failed to fetch posts from Instagram'
    return NextResponse.json({ error: igError, posts: [] })
  }

  const posts = mediaData.data as Array<{
    id: string
    caption?: string
    media_type: string
    media_url?: string
    thumbnail_url?: string
    timestamp: string
    permalink: string
    like_count: number
    comments_count: number
  }>

  // Fetch insights for each post in parallel
  const postsWithMetrics = await Promise.all(
    posts.map(async (post) => {
      try {
        const insightMetrics = post.media_type === 'REELS' || post.media_type === 'VIDEO'
          ? 'reach,plays,likes,comments,shares,saved,total_interactions'
          : 'reach,impressions,saved,likes,comments'

        const insightRes = await fetch(
          `https://graph.facebook.com/v25.0/${post.id}/insights?metric=${insightMetrics}&access_token=${token}`
        )
        const insightData = await insightRes.json()

        const metrics: Record<string, number> = {
          likes: post.like_count ?? 0,
          comments: post.comments_count ?? 0,
        }
        for (const item of insightData.data ?? []) {
          metrics[item.name] = item.values?.[0]?.value ?? item.value ?? 0
        }

        return { ...post, metrics }
      } catch {
        return { ...post, metrics: { likes: post.like_count ?? 0, comments: post.comments_count ?? 0 } }
      }
    })
  )

  return NextResponse.json({ posts: postsWithMetrics })
}
