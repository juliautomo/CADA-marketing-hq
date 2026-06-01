// Google APIs — Drive + Calendar
// Uses OAuth2 with a long-lived refresh token

const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token'

async function getAccessToken(): Promise<string> {
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN!,
      grant_type: 'refresh_token',
    }),
  })
  const { access_token } = await res.json()
  return access_token as string
}

// ─── Drive ───────────────────────────────

export async function uploadTextToDrive(params: {
  fileName: string
  content: string
  mimeType?: string
}): Promise<string> {
  const token = await getAccessToken()
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID

  const metadata = {
    name: params.fileName,
    mimeType: params.mimeType ?? 'text/plain',
    ...(folderId ? { parents: [folderId] } : {}),
  }

  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
  form.append('file', new Blob([params.content], { type: params.mimeType ?? 'text/plain' }))

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
    { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form }
  )
  const data = await res.json()
  return data.webViewLink as string
}

// ─── Calendar ────────────────────────────

export async function createCalendarEvent(params: {
  summary: string
  description?: string
  startDate: string
  endDate: string
}): Promise<string> {
  const token = await getAccessToken()
  const calendarId = process.env.GOOGLE_CALENDAR_ID ?? 'primary'

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: params.summary,
        description: params.description,
        start: { date: params.startDate },
        end: { date: params.endDate },
      }),
    }
  )
  const data = await res.json()
  return data.id as string
}
