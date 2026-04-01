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
  manifest: '/manifest.json',
  themeColor: '#e11d48',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: '318 LEGAACY',
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
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
