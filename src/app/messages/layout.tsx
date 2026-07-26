import { Suspense } from 'react'
import { privatePageMetadata } from '@/lib/seo'

export const dynamic = 'force-dynamic'
export const metadata = privatePageMetadata('Messagerie')

export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div>Chargement...</div>}>{children}</Suspense>
}
