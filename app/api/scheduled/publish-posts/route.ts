export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cada-marketing-hq.vercel.app'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const force = searchParams.get('force') === 'true'
  const postId = searchParams.get('post_id')

  const supabase = createServiceClient()

  // Fetch pending posts — force mode ignores time check, post_id targets a single post
  let query = supabase.from('cada_scheduled_posts').select('*').eq('status', 'pending')
  if (postId) {
    query = query.eq('id', postId)
  } else if (!force) {
    query = query.lte('scheduled_at', new Date().toISOString())
  }
  const { data: posts, error } = await query.order('scheduled_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!posts || posts.length === 0) return NextResponse.json({ published: 0 })

  const results: { id: string; platform: string; ok: boolean; error?: string }[] = []

  for (const post of posts) {
    try {
      let res: Response
      if (post.platform === 'instagram') {
        res = await fetch(`${APP_URL}/api/instagram/post`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mediaUrl: post.media_url,
            caption: post.caption,
            mediaType: post.media_type,
          }),
        })
      } else if (post.platform === 'tiktok') {
        res = await fetch(`${APP_URL}/api/tiktok/post`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            videoUrl: post.media_url,
            caption: post.caption,
          }),
        })
      } else {
        continue
      }

      const json = await res.json()

      if (res.ok) {
        await supabase
          .from('cada_scheduled_posts')
          .update({ status: 'published', published_at: new Date().toISOString(), post_id: json.postId ?? json.post_id ?? null })
          .eq('id', post.id)
        results.push({ id: post.id, platform: post.platform, ok: true })
      } else {
        const msg = json.error ?? 'Unknown error'
        await supabase
          .from('cada_scheduled_posts')
          .update({ status: 'failed', error_message: msg })
          .eq('id', post.id)
        results.push({ id: post.id, platform: post.platform, ok: false, error: msg })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      await supabase
        .from('cada_scheduled_posts')
        .update({ status: 'failed', error_message: msg })
        .eq('id', post.id)
      results.push({ id: post.id, platform: post.platform, ok: false, error: msg })
    }
  }

  return NextResponse.json({ published: results.filter(r => r.ok).length, results })
}
