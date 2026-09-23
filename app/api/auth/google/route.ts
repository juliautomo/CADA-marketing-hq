export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'

export async function GET(req: import('next/server').NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) return NextResponse.json({ error: 'Google client ID not configured' }, { status: 500 })

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`
  const scope = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/drive.file',
  ].join(' ')

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', scope)
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')

  const cadaClientId = req.headers.get('x-client-id') ?? req.cookies.get('cada_client_id')?.value ?? ''
  const nonce = Math.random().toString(36).substring(2)
  url.searchParams.set('state', `${nonce}.${cadaClientId}`)

  return NextResponse.redirect(url.toString())
}
