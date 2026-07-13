export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const state = searchParams.get('state') ?? ''
  const clientIdFromState = state.includes('.') ? state.split('.').slice(1).join('.') : null

  if (error || !code) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?tab=connections&error=instagram_denied`)
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/instagram/callback`

  // Exchange code for user access token
  const tokenRes = await fetch('https://graph.facebook.com/v25.0/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.META_APP_ID!,
      client_secret: process.env.META_APP_SECRET!,
      redirect_uri: redirectUri,
      code,
    }),
  })

  const tokenData = await tokenRes.json()

  if (!tokenData.access_token) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?tab=connections&error=instagram_token`)
  }

  const userToken = tokenData.access_token

  // Exchange for long-lived token
  const longLivedRes = await fetch(
    `https://graph.facebook.com/v25.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.META_APP_ID}&client_secret=${process.env.META_APP_SECRET}&fb_exchange_token=${userToken}`
  )
  const longLivedData = await longLivedRes.json()
  const longLivedToken = longLivedData.access_token ?? userToken

  type Page = { id: string; name: string; access_token: string; instagram_business_account?: { id: string } }

  // Try 1: direct page admin access
  const pagesRes = await fetch(
    `https://graph.facebook.com/v25.0/me/accounts?fields=id,name,access_token,instagram_business_account&limit=100&access_token=${longLivedToken}`
  )
  const pagesData = await pagesRes.json()
  let pages: Page[] = pagesData.data ?? []

  // Try 2: Business Manager owned pages
  if (!pages.find(p => p.instagram_business_account?.id)) {
    const bizRes = await fetch(
      `https://graph.facebook.com/v25.0/me/businesses?fields=owned_pages{id,name,access_token,instagram_business_account}&access_token=${longLivedToken}`
    )
    const bizData = await bizRes.json()
    for (const biz of bizData.data ?? []) {
      pages = [...pages, ...(biz.owned_pages?.data ?? [])]
    }
  }

  // Try 3: client pages via business
  if (!pages.find(p => p.instagram_business_account?.id)) {
    const clientBizRes = await fetch(
      `https://graph.facebook.com/v25.0/me/businesses?fields=client_pages{id,name,access_token,instagram_business_account}&access_token=${longLivedToken}`
    )
    const clientBizData = await clientBizRes.json()
    for (const biz of clientBizData.data ?? []) {
      pages = [...pages, ...(biz.client_pages?.data ?? [])]
    }
  }

  // Find the page with an Instagram Business Account
  const pageWithIG = pages.find(p => p.instagram_business_account?.id)

  const supabase = createServiceClient()
  const clientId = clientIdFromState || req.headers.get('x-client-id') || req.cookies.get('cada_client_id')?.value || null

  const upsertRows = [
    { key: 'instagram_user_token', value: longLivedToken, updated_at: new Date().toISOString(), client_id: clientId },
    { key: 'instagram_pages', value: JSON.stringify(pages), updated_at: new Date().toISOString(), client_id: clientId },
  ]

  if (pageWithIG) {
    const igId = pageWithIG.instagram_business_account!.id

    // Fetch Instagram username
    const igRes = await fetch(
      `https://graph.facebook.com/v25.0/${igId}?fields=username,name&access_token=${pageWithIG.access_token}`
    )
    const igData = await igRes.json()
    const igUsername = igData.username ?? igData.name ?? ''

    upsertRows.push(
      { key: 'instagram_page_id', value: pageWithIG.id, updated_at: new Date().toISOString(), client_id: clientId },
      { key: 'instagram_page_name', value: pageWithIG.name, updated_at: new Date().toISOString(), client_id: clientId },
      { key: 'instagram_page_token', value: pageWithIG.access_token, updated_at: new Date().toISOString(), client_id: clientId },
      { key: 'instagram_business_account_id', value: igId, updated_at: new Date().toISOString(), client_id: clientId },
      { key: 'instagram_username', value: igUsername, updated_at: new Date().toISOString(), client_id: clientId },
    )
  }

  await supabase.from('cada_settings').upsert(upsertRows, { onConflict: 'key,client_id' })

  return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?tab=connections&success=instagram`)
}
