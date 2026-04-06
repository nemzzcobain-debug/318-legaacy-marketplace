import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import AuctionClient from './AuctionClient'

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const auction = await prisma.auction.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        beat: {
          select: {
            title: true,
            description: true,
            coverImage: true,
            producer: {
              select: {
                displayName: true,
                name: true,
              },
            },
          },
        },
        currentBid: true,
      },
    })

    if (!auction) {
      return {
        title: 'Enchère non trouvée | 318 LEGAACY',
        description: 'Cette enchère n\'existe pas ou a été supprimée.',
      }
    }

    const beat = auction.beat
    const producer = beat.producer.displayName || beat.producer.name
    const title = `${beat.title} par ${producer} | Enchère | 318 LEGAACY`
    const description = beat.description
      ? beat.description.substring(0, 160)
      : `Participez à l'enchère "${beat.title}" de ${producer} sur 318 LEGAACY Marketplace. Enchère actuelle: ${auction.currentBid} EUR`

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: `/auction/${params.id}`,
        type: 'website',
        images: beat.coverImage
          ? [
              {
                url: beat.coverImage,
                width: 800,
                height: 800,
                alt: beat.title,
              },
            ]
          : undefined,
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: beat.coverImage ? [beat.coverImage] : undefined,
      },
    }
  } catch (error) {
    console.error('Error generating metadata for auction:', error)
    return {
      title: 'Enchère | 318 LEGAACY',
      description: 'Découvrez les enchères de beats sur 318 LEGAACY Marketplace',
    }
  }
}

export default function AuctionPage() {
  return <AuctionClient />
}
