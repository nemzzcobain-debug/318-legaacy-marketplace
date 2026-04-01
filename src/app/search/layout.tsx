import { Metadata } from 'next'

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://318-legaacy-marketplace.vercel.app'

export const metadata: Metadata = {
  title: 'Recherche — Explorer les Beats',
  description: 'Recherche parmi des centaines de beats par genre, BPM, tonalite, prix et plus. Trouve l\'instrumentale parfaite pour ton prochain projet sur 318 LEGAACY.',
  openGraph: {
    title: 'Recherche — Explorer les Beats',
    description: 'Recherche parmi des centaines de beats par genre, BPM, tonalite et prix.',
    url: `${siteUrl}/search`,
    siteName: '318 LEGAACY Marketplace',
    type: 'website',
    locale: 'fr_FR',
  },
  alternates: { canonical: `${siteUrl}/search` },
}

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
