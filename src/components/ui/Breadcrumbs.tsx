'use client'

import Link from 'next/link'
import { ChevronRight, Home } from 'lucide-react'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
}

export default function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Fil d'Ariane" className="flex items-center gap-1.5 text-sm text-gray-400 mb-6 flex-wrap">
      <Link
        href="/"
        className="flex items-center gap-1 hover:text-white transition-colors"
        aria-label="Accueil"
      >
        <Home className="w-4 h-4" />
      </Link>
      {items.map((item, index) => (
        <span key={index} className="flex items-center gap-1.5">
          <ChevronRight className="w-3.5 h-3.5 text-gray-600" aria-hidden="true" />
          {item.href && index < items.length - 1 ? (
            <Link href={item.href} className="hover:text-white transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className="text-gray-300" aria-current="page">
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  )
}
