import type { Metadata } from 'next'

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.318marketplace.com'

export const metadata: Metadata = {
  title: 'Nouveaux beats — Instrumentales disponibles',
  description:
    'Découvre les nouveaux beats validés par 318 LEGAACY, leurs formats et leurs licences avant achat.',
  alternates: { canonical: `${siteUrl}/nouveautes` },
  openGraph: {
    title: 'Nouveaux beats sur 318 LEGAACY',
    description: 'Les dernières instrumentales validées et disponibles.',
    url: `${siteUrl}/nouveautes`,
    type: 'website',
    locale: 'fr_FR',
  },
}

export default function NouveautesLayout({ children }: { children: React.ReactNode }) {
  return children
}
