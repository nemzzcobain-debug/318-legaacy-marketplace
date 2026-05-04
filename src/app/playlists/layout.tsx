import { Metadata } from 'next'

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.318marketplace.com'

export const metadata: Metadata = {
  title: 'Playlists — Collections de Beats',
  description: 'Découvre et crée des playlists de beats sur 318 LEGAACY Marketplace. Organise tes instrumentales favorites en collections et partage-les.',
  openGraph: {
    title: 'Playlists — Collections de Beats',
    description: 'Découvre et crée des playlists de beats. Organise tes instrumentales favorites en collections.',
    url: `${siteUrl}/playlists`,
    siteName: '318 LEGAACY Marketplace',
    type: 'website',
    locale: 'fr_FR',
  },
  alternates: { canonical: `${siteUrl}/playlists` },
}

export default function PlaylistsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
