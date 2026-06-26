export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'

export async function GET() {
  const clientKey = process.env.TIKTOK_CLIENT_KEY
  if (!clientKey) return NextResponse.json({ error: 'TikTok client key not configured' }, { status: 500 })

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/tiktok/callback`
  const scope = 'user.info.basic,user.info.stats,video.list,video.publish,video.upload'
  const state = Math.random().toString(36).substring(2)

  const url = new URL('https://www.tiktok.com/v2/auth/authorize/')
  url.searchParams.set('client_key', clientKey)
  url.searchParams.set('scope', scope)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('state', state)

  return NextResponse.redirect(url.toString())
}
