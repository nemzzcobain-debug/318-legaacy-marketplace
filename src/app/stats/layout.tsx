import { Metadata } from 'next'

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://318-legaacy-marketplace.vercel.app'

export const metadata: Metadata = {
  title: 'Statistiques — 318 LEGAACY en Chiffres',
  description: 'Decouvre les statistiques de 318 LEGAACY Marketplace : nombre de beats, producteurs, encheres, volumes de ventes, genres populaires et top producteurs.',
  openGraph: {
    title: 'Statistiques — 318 LEGAACY en Chiffres',
    description: 'Les chiffres de la premiere plateforme d\'encheres de beats en France.',
    url: `${siteUrl}/stats`,
    siteName: '318 LEGAACY Marketplace',
    type: 'website',
    locale: 'fr_FR',
  },
  alternates: { canonical: `${siteUrl}/stats` },
}

export default function StatsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
