'use client'

import { usePathname } from 'next/navigation'
import { Sidebar } from './sidebar'

const AUTH_PATHS = ['/login']

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAuth = AUTH_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))

  if (isAuth) {
    return <>{children}</>
  }

  return (
    <>
      <Sidebar />
      <main className="ml-60 min-h-screen">
        <div className="px-8 py-8">{children}</div>
      </main>
    </>
  )
}
