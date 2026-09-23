export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const state = searchParams.get('state') ?? ''
  const clientId = state.includes('.') ? state.split('.').slice(1).join('.') : null

  if (error || !code) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?tab=connections&error=google_denied`)
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code,
    }),
  })

  const tokenData = await tokenRes.json()

  if (!tokenData.refresh_token) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?tab=connections&error=google_token`)
  }

  // Fetch the Google account email so we can show who's connected
  let googleEmail = ''
  try {
    const infoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })
    const infoData = await infoRes.json()
    googleEmail = infoData.email ?? ''
  } catch {}

  const supabase = createServiceClient()
  await supabase.from('cada_settings').upsert([
    { key: 'google_refresh_token', value: tokenData.refresh_token, updated_at: new Date().toISOString(), client_id: clientId ?? null },
    { key: 'google_email', value: googleEmail || 'null', updated_at: new Date().toISOString(), client_id: clientId ?? null },
  ], { onConflict: 'key,client_id' })

  return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?tab=connections&success=google`)
}
