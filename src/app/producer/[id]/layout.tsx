import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'

interface Props {
  params: { id: string }
  children: React.ReactNode
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.318marketplace.com'

  try {
    const producer = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        name: true,
        displayName: true,
        producerBio: true,
        bio: true,
        totalSales: true,
        rating: true,
        _count: { select: { beats: true, followers: true } },
      },
    })

    if (!producer) {
      return { title: 'Producteur non trouve' }
    }

    const name = producer.displayName || producer.name
    const title = `${name} — Producteur vérifié sur 318 LEGAACY`
    const bio = producer.producerBio || producer.bio || ''
    const description = `${name} est producteur vérifié sur 318 LEGAACY. ${producer._count.beats} beats, ${producer._count.followers} abonnés, ${producer.totalSales} ventes.${bio ? ' ' + bio.slice(0, 120) : ''}`
    const ogUrl = `${siteUrl}/api/og?title=${encodeURIComponent(name)}&producer=${encodeURIComponent('Producteur vérifié')}`

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: `${siteUrl}/producer/${params.id}`,
        siteName: '318 LEGAACY Marketplace',
        type: 'profile',
        locale: 'fr_FR',
        images: [{ url: ogUrl, width: 1200, height: 630, alt: name }],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [ogUrl],
      },
      alternates: {
        canonical: `${siteUrl}/producer/${params.id}`,
      },
    }
  } catch {
    return { title: '318 LEGAACY — Producteur' }
  }
}

export default function ProducerLayout({ children }: Props) {
  return children
}
