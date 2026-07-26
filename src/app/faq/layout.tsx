import type { Metadata } from 'next'

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.318marketplace.com'

export const metadata: Metadata = {
  title: 'FAQ — Enchères, licences et paiements',
  description:
    'Toutes les réponses sur les enchères de beats, les licences Basique, Premium et Exclusive, les paiements et les téléchargements.',
  alternates: { canonical: `${siteUrl}/faq` },
}

export default function FaqLayout({ children }: { children: React.ReactNode }) {
  return children
}
