'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Package, ArrowRight } from 'lucide-react'

export function ProductsNudge() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    fetch('/api/products')
      .then(r => r.json())
      .then(d => { if ((d.products ?? []).length === 0) setShow(true) })
      .catch(() => {})
  }, [])

  if (!show) return null

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 flex items-center gap-4">
      <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
        <Package className="w-4 h-4 text-amber-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-amber-900">Add your products to get better AI content</p>
        <p className="text-xs text-amber-700 mt-0.5">The AI uses your product list to write accurate captions, descriptions, and campaign ideas.</p>
      </div>
      <Link href="/products"
        className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-2 rounded-xl transition-colors flex-shrink-0 whitespace-nowrap">
        Add products <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  )
}
