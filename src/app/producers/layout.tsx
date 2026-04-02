import { Metadata } from 'next'

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.318marketplace.com'

export const metadata: Metadata = {
  title: 'Producteurs — Beatmakers Verifies',
  description: 'Decouvre les producteurs verifies de 318 LEGAACY Marketplace. Des beatmakers talentueux de Trap, Drill, Boom Bap, R&B, Afrobeat et plus.',
  openGraph: {
    title: 'Producteurs — Beatmakers Verifies',
    description: 'Decouvre les producteurs verifies. Des beatmakers talentueux de tous genres.',
    url: `${siteUrl}/producers`,
    siteName: '318 LEGAACY Marketplace',
    type: 'website',
    locale: 'fr_FR',
  },
  alternates: { canonical: `${siteUrl}/producers` },
}

export default function ProducersLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
