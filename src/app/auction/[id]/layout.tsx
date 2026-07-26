import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { getLicenseDetails } from '@/lib/licenses'

interface Props {
  params: Promise<{ id: string }>
  children: React.ReactNode
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.318marketplace.com'

  try {
    const auction = await prisma.auction.findUnique({
      where: { id },
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
      return {
        title: 'Enchère non trouvée',
        robots: { index: false, follow: false },
      }
    }

    const producerName = auction.beat.producer.displayName || auction.beat.producer.name
    const license = getLicenseDetails(auction.licenseType)
    const isIndexable =
      ['ACTIVE', 'ENDING_SOON'].includes(auction.status) &&
      auction.startTime <= new Date() &&
      auction.endTime > new Date()
    const title = `${auction.beat.title} — Enchère ${isIndexable ? 'en cours' : 'terminée'}`
    const description = `Enchéris sur "${auction.beat.title}" par ${producerName}. ${auction.beat.genre} · ${auction.beat.bpm} BPM. Licence ${license.label} : ${license.shortDescription}. Enchère actuelle : ${auction.currentBid} €.`
    const ogUrl = `${siteUrl}/api/og?auction=${id}&title=${encodeURIComponent(auction.beat.title)}&producer=${encodeURIComponent(producerName)}&bid=${auction.currentBid}&genre=${encodeURIComponent(auction.beat.genre)}&bpm=${auction.beat.bpm}`

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: `${siteUrl}/auction/${id}`,
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
        canonical: `${siteUrl}/auction/${id}`,
      },
      robots: {
        index: isIndexable,
        follow: isIndexable,
      },
      other: {
        'product:price:amount': String(auction.currentBid),
        'product:price:currency': 'EUR',
      },
    }
  } catch {
    return {
      title: '318 LEGAACY — Enchère',
      robots: { index: false, follow: false },
    }
  }
}

export default function AuctionLayout({ children }: Props) {
  return children
}
