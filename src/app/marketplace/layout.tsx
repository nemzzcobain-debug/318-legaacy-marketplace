import { Metadata } from 'next'

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.318marketplace.com'

export const metadata: Metadata = {
  title: 'Marketplace — Enchères de Beats en Direct',
  description: 'Découvre les enchères de beats en cours sur 318 LEGAACY. Trap, Drill, Boom Bap, R&B, Afrobeat et plus. Enchéris en temps réel sur des instrumentales uniques.',
  openGraph: {
    title: 'Marketplace — Enchères de Beats en Direct',
    description: 'Découvre les enchères de beats en cours. Enchéris en temps réel sur des instrumentales uniques de producteurs vérifiés.',
    url: `${siteUrl}/marketplace`,
    siteName: '318 LEGAACY Marketplace',
    type: 'website',
    locale: 'fr_FR',
  },
  alternates: { canonical: `${siteUrl}/marketplace` },
}

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
