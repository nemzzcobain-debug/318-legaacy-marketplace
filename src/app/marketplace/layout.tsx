import { Metadata } from 'next'

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.318marketplace.com'

export const metadata: Metadata = {
  title: 'Marketplace — Encheres de Beats en Direct',
  description: 'Decouvre les encheres de beats en cours sur 318 LEGAACY. Trap, Drill, Boom Bap, R&B, Afrobeat et plus. Encheris en temps reel sur des instrumentales uniques.',
  openGraph: {
    title: 'Marketplace — Encheres de Beats en Direct',
    description: 'Decouvre les encheres de beats en cours. Encheris en temps reel sur des instrumentales uniques de producteurs verifies.',
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
