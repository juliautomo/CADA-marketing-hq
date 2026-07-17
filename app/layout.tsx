import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Sidebar } from '@/components/dashboard/sidebar'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'CADA Marketing HQ',
  description: 'Multi-agent AI marketing dashboard for your brand',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-zinc-50 text-zinc-900 antialiased`}>
        <Sidebar />
        <main className="ml-60 min-h-screen">
          <div className="px-8 py-8">
            {children}
          </div>
        </main>
      </body>
    </html>
  )
}
