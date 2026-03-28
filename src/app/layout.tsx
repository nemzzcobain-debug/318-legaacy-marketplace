import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Providers from '@/components/Providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '318 LEGAACY Marketplace - Encheres de Beats',
  description: 'Premiere plateforme d\'encheres d\'instrumentales en France. Decouvre des beats uniques de producteurs verifies.',
  keywords: ['beats', 'instrumentales', 'encheres', 'marketplace', 'production musicale', 'rap', 'trap', 'drill'],
  openGraph: {
    title: '318 LEGAACY Marketplace',
    description: 'Encheris sur les meilleurs instrumentales',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
