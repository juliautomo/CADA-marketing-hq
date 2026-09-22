export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { generateImage } from '@/lib/openai'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cada-marketing-hq.vercel.app'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const force = searchParams.get('force') === 'true'
  const postId = searchParams.get('post_id')

  const supabase = createServiceClient()

  // Step 1: generate images for approved posts that are due
  const approvedQuery = supabase
    .from('cada_scheduled_posts')
    .select('*')
    .eq('status', 'approved')
    .lte('scheduled_at', new Date(Date.now() + 30 * 60 * 1000).toISOString()) // due within 30 min
    .order('scheduled_at', { ascending: true })
    .limit(2)

  const { data: approvedPosts } = await approvedQuery

  if (approvedPosts && approvedPosts.length > 0) {
    for (const post of approvedPosts) {
      if (!post.image_concept) {
        // No concept — skip image gen, move straight to pending
        await supabase.from('cada_scheduled_posts').update({ status: 'pending' }).eq('id', post.id)
        continue
      }
      await supabase.from('cada_scheduled_posts').update({ status: 'generating' }).eq('id', post.id)
      try {
        const mediaUrl = await generateImage(post.image_concept, '1024x1024', 'medium')
        await supabase.from('cada_scheduled_posts')
          .update({ status: 'pending', media_url: mediaUrl })
          .eq('id', post.id)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        await supabase.from('cada_scheduled_posts')
          .update({ status: 'failed', error_message: `Image generation failed: ${msg}` })
          .eq('id', post.id)
      }
    }
  }

  // Step 2: Fetch pending posts — force mode ignores time check, post_id targets a single post
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
      const clientHeader: Record<string, string> = post.client_id ? { 'x-client-id': post.client_id } : {}
      let res: Response
      if (post.platform === 'instagram') {
        res = await fetch(`${APP_URL}/api/instagram/post`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...clientHeader },
          body: JSON.stringify({
            mediaUrl: post.media_url,
            caption: post.caption,
            mediaType: post.media_type,
          }),
        })
      } else if (post.platform === 'tiktok') {
        res = await fetch(`${APP_URL}/api/tiktok/post`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...clientHeader },
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
