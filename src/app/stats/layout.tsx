import { Metadata } from 'next'

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.318marketplace.com'

export const metadata: Metadata = {
  title: 'Statistiques — 318 LEGAACY en Chiffres',
  description: 'Découvre les statistiques de 318 LEGAACY Marketplace : nombre de beats, producteurs, enchères, volumes de ventes, genres populaires et top producteurs.',
  openGraph: {
    title: 'Statistiques — 318 LEGAACY en Chiffres',
    description: 'Les chiffres de la première plateforme d\'enchères de beats en France.',
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
