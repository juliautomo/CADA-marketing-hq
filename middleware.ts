import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/login', '/api/auth/client-login', '/api/clients', '/api/auth/logout']

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Allow public paths and static assets
  if (
    PUBLIC_PATHS.some(p => pathname.startsWith(p)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next()
  }

  const clientId = req.cookies.get('cada_client_id')?.value
  if (!clientId) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Pass client_id as a header so API routes can read it without re-parsing cookies
  const res = NextResponse.next()
  res.headers.set('x-client-id', clientId)
  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
