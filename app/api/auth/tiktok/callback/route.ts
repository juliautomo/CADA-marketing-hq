export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?tab=connections&error=tiktok_denied`)
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/tiktok/callback`

  // Exchange code for access token
  const tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  })

  const tokenData = await tokenRes.json()

  if (!tokenData.access_token) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?tab=connections&error=tiktok_token`)
  }

  // Fetch TikTok username
  let tiktokUsername = ''
  try {
    const userRes = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=username,display_name', {
      headers: { 'Authorization': `Bearer ${tokenData.access_token}` },
    })
    const userData = await userRes.json()
    tiktokUsername = userData.data?.user?.username ?? userData.data?.user?.display_name ?? ''
  } catch {}

  // Save to DB
  const supabase = createServiceClient()
  await supabase.from('cada_settings').upsert([
    { key: 'tiktok_access_token', value: tokenData.access_token, updated_at: new Date().toISOString() },
    { key: 'tiktok_open_id', value: tokenData.open_id, updated_at: new Date().toISOString() },
    { key: 'tiktok_refresh_token', value: tokenData.refresh_token ?? 'null', updated_at: new Date().toISOString() },
    { key: 'tiktok_username', value: tiktokUsername || 'null', updated_at: new Date().toISOString() },
  ])

  return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?tab=connections&success=tiktok`)
}
