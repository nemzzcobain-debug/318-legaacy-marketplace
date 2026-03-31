import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Providers from '@/components/Providers'

const inter = Inter({ subsets: ['latin'] })

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://318-legaacy-marketplace.vercel.app'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: '318 LEGAACY Marketplace — Encheres de Beats en France',
    template: '%s | 318 LEGAACY',
  },
  description: 'Premiere plateforme d\'encheres d\'instrumentales en France. Decouvre des beats uniques de producteurs verifies et encheris en temps reel.',
  keywords: ['beats', 'instrumentales', 'encheres', 'marketplace', 'production musicale', 'rap', 'trap', 'drill', 'beatmaker', 'producteur', '318 legaacy'],
  authors: [{ name: '318 LEGAACY Studio' }],
  creator: '318 LEGAACY Studio',
  openGraph: {
    title: '318 LEGAACY Marketplace — Encheres de Beats',
    description: 'Premiere plateforme d\'encheres d\'instrumentales en France. Encheris en temps reel sur des beats uniques.',
    url: siteUrl,
    siteName: '318 LEGAACY Marketplace',
    locale: 'fr_FR',
    type: 'website',
    images: [
      {
        url: '/api/og',
        width: 1200,
        height: 630,
        alt: '318 LEGAACY Marketplace',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '318 LEGAACY Marketplace — Encheres de Beats',
    description: 'Premiere plateforme d\'encheres d\'instrumentales en France.',
    images: ['/api/og'],
  },
  robots: {
    index: true,
    follow: true,
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
