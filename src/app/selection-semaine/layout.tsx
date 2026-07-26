import type { Metadata } from 'next'

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.318marketplace.com'

export const metadata: Metadata = {
  title: 'Beats de la semaine — Sélection 318 LEGAACY',
  description:
    'Écoute la sélection de beats de la semaine choisie par 318 LEGAACY et découvre les licences proposées avant de miser ou acheter.',
  alternates: { canonical: `${siteUrl}/selection-semaine` },
  openGraph: {
    title: 'Beats de la semaine — Sélection 318 LEGAACY',
    description: 'Les instrumentales sélectionnées cette semaine par 318 LEGAACY.',
    url: `${siteUrl}/selection-semaine`,
    type: 'website',
    locale: 'fr_FR',
  },
}

export default function SelectionLayout({ children }: { children: React.ReactNode }) {
  return children
}
