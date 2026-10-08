import { createServiceClient } from '@/lib/supabase'

// Refresh an Instagram long-lived token (valid 60 days; refresh resets the window).
// Returns the new token, or null if refresh failed (caller should prompt reconnect).
export async function refreshInstagramToken(currentToken: string, clientId: string | null): Promise<string | null> {
  const res = await fetch(
    `https://graph.facebook.com/v25.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.META_APP_ID}&client_secret=${process.env.META_APP_SECRET}&fb_exchange_token=${encodeURIComponent(currentToken)}`
  )
  const data = await res.json()
  if (!data.access_token) return null

  const supabase = createServiceClient()
  await supabase.from('cada_settings').upsert(
    [{ key: 'instagram_user_token', value: data.access_token, updated_at: new Date().toISOString(), client_id: clientId }],
    { onConflict: 'key,client_id' }
  )
  return data.access_token
}

// Refresh a TikTok access token using the stored refresh token.
// Returns the new access token, or null if refresh failed (caller should prompt reconnect).
export async function refreshTikTokToken(clientId: string | null): Promise<string | null> {
  const supabase = createServiceClient()
  let query = supabase.from('cada_settings').select('key, value').in('key', ['tiktok_refresh_token'])
  if (clientId) query = query.eq('client_id', clientId)
  else query = query.is('client_id', null)
  const { data } = await query

  const refreshToken = data?.find(r => r.key === 'tiktok_refresh_token')?.value
  if (!refreshToken || refreshToken === 'null') return null

  const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })
  const tokenData = await res.json()
  if (!tokenData.access_token) return null

  await supabase.from('cada_settings').upsert(
    [
      { key: 'tiktok_access_token', value: tokenData.access_token, updated_at: new Date().toISOString(), client_id: clientId },
      ...(tokenData.refresh_token ? [{ key: 'tiktok_refresh_token', value: tokenData.refresh_token, updated_at: new Date().toISOString(), client_id: clientId }] : []),
    ],
    { onConflict: 'key,client_id' }
  )
  return tokenData.access_token
}

// Returns true if the token stored at the given key is older than maxAgeDays.
export function isTokenStale(updatedAt: string | null | undefined, maxAgeDays: number): boolean {
  if (!updatedAt) return true
  const ageMs = Date.now() - new Date(updatedAt).getTime()
  return ageMs > maxAgeDays * 24 * 60 * 60 * 1000
}
