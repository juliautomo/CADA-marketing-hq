export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'

export async function GET(req: import('next/server').NextRequest) {
  const appId = process.env.META_APP_ID
  if (!appId) return NextResponse.json({ error: 'Meta app ID not configured' }, { status: 500 })

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/instagram/callback`
  const scope = [
    'pages_show_list',
    'pages_read_engagement',
    'instagram_basic',
    'instagram_content_publish',
    'instagram_manage_insights',
    'pages_manage_posts',
  ].join(',')

  const url = new URL('https://www.facebook.com/v25.0/dialog/oauth')
  url.searchParams.set('client_id', appId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('scope', scope)
  url.searchParams.set('response_type', 'code')
  const clientId = req.headers.get('x-client-id') ?? req.cookies.get('cada_client_id')?.value ?? ''
  const nonce = Math.random().toString(36).substring(2)
  url.searchParams.set('state', `${nonce}.${clientId}`)

  return NextResponse.redirect(url.toString())
}
