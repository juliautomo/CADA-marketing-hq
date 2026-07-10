import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'

// Use in API route handlers — reads from request headers (set by middleware) or cookies
export function getClientIdFromRequest(req: NextRequest): string | null {
  return req.headers.get('x-client-id') ?? req.cookies.get('cada_client_id')?.value ?? null
}

// Use in Server Components / server actions
export async function getClientIdFromCookies(): Promise<string | null> {
  const store = await cookies()
  return store.get('cada_client_id')?.value ?? null
}
