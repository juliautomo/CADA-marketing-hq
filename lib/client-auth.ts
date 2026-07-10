import { cookies } from 'next/headers'
import { createHash } from 'crypto'

const COOKIE_NAME = 'cada_client_id'
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 30, // 30 days
}

export function hashPin(pin: string): string {
  const secret = process.env.PIN_SECRET ?? 'cada-internal-secret'
  return createHash('sha256').update(pin + secret).digest('hex')
}

export async function getClientId(): Promise<string | null> {
  const store = await cookies()
  return store.get(COOKIE_NAME)?.value ?? null
}

export async function setClientCookie(clientId: string) {
  const store = await cookies()
  store.set(COOKIE_NAME, clientId, COOKIE_OPTS)
}

export async function clearClientCookie() {
  const store = await cookies()
  store.delete(COOKIE_NAME)
}
