import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'

interface Props {
  params: { id: string }
  children: React.ReactNode
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.318marketplace.com'

  try {
    const auction = await prisma.auction.findUnique({
      where: { id: params.id },
      include: {
        beat: {
          select: {
            title: true,
            genre: true,
            bpm: true,
            coverImage: true,
            producer: { select: { name: true, displayName: true } },
          },
        },
      },
    })

    if (!auction) {
      return { title: 'Enchere non trouvee' }
    }

    const producerName = auction.beat.producer.displayName || auction.beat.producer.name
    const title = `${auction.beat.title} — Enchere ${auction.status === 'ACTIVE' ? 'en cours' : 'terminee'}`
    const description = `Encheris sur "${auction.beat.title}" par ${producerName}. ${auction.beat.genre} · ${auction.beat.bpm} BPM. Enchere actuelle: ${auction.currentBid}€`
    const ogUrl = `${siteUrl}/api/og?auction=${params.id}&title=${encodeURIComponent(auction.beat.title)}&producer=${encodeURIComponent(producerName)}&bid=${auction.currentBid}&genre=${encodeURIComponent(auction.beat.genre)}&bpm=${auction.beat.bpm}`

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: `${siteUrl}/auction/${params.id}`,
        siteName: '318 LEGAACY Marketplace',
        type: 'website',
        locale: 'fr_FR',
        images: [
          {
            url: ogUrl,
            width: 1200,
            height: 630,
            alt: `${auction.beat.title} - Enchere 318 LEGAACY`,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [ogUrl],
      },
      alternates: {
        canonical: `${siteUrl}/auction/${params.id}`,
      },
      other: {
        'product:price:amount': String(auction.currentBid),
        'product:price:currency': 'EUR',
      },
    }
  } catch {
    return { title: '318 LEGAACY — Enchere' }
  }
}

export default function AuctionLayout({ children }: Props) {
  return children
}
