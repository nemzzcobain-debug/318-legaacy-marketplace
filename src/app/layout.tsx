import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Providers from '@/components/Providers'
import BPMChatbot from '@/components/ui/BPMChatbot'
import { WebsiteJsonLd, OrganizationJsonLd } from '@/components/seo/JsonLd'
// @ts-ignore - @vercel/analytics is optional
import { Analytics } from '@vercel/analytics/react'
// @ts-ignore - @vercel/speed-insights is optional
import { SpeedInsights } from '@vercel/speed-insights/next'

const inter = Inter({ subsets: ['latin'] })

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.318marketplace.com'

export const metadata: Metadata = {
  metadataBase: new URL('https://www.318marketplace.com'),
  title: {
    default: '318 LEGAACY Marketplace — Enchères de Beats en France',
    template: '%s | 318 LEGAACY',
  },
  description: 'Première plateforme d\'enchères d\'instrumentales en France. Découvre des beats uniques de producteurs vérifiés et enchéris en temps réel.',
  keywords: ['beats', 'instrumentales', 'enchères', 'marketplace', 'production musicale', 'rap', 'trap', 'drill', 'beatmaker', 'producteur', '318 legaacy'],
  authors: [{ name: '318 LEGAACY Studio' }],
  creator: '318 LEGAACY Studio',
  manifest: '/manifest.json',
  themeColor: '#e11d48',
  alternates: {
    canonical: '/',
  },
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
    title: '318 LEGAACY Marketplace — Enchères de Beats',
    description: 'Première plateforme d\'enchères d\'instrumentales en France. Enchéris en temps réel sur des beats uniques.',
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
    title: '318 LEGAACY Marketplace — Enchères de Beats',
    description: 'Première plateforme d\'enchères d\'instrumentales en France.',
    images: ['/api/og'],
  },
  robots: {
    index: true,
    follow: true,
  },
  verification: {
    google: 'fQFNqmm9G6V6gcF6oa_h-hVazZuI88SP3ZNtBhai1X8',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <head>
        <WebsiteJsonLd siteUrl={siteUrl} />
        <OrganizationJsonLd siteUrl={siteUrl} />
      </head>
      <body className={inter.className}>
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-red-600 focus:text-white focus:rounded">
          Aller au contenu principal
        </a>
        <Providers>
          {children}
          <BPMChatbot />
        </Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
