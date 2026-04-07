import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import AuctionClient from './AuctionClient'
import { AuctionJsonLd } from '@/components/seo/JsonLd'

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
            genre: true,
            bpm: true,
            producer: {
              select: {
                id: true,
                displayName: true,
                name: true,
              },
            },
          },
        },
        currentBid: true,
        startPrice: true,
        endTime: true,
        status: true,
        licenseType: true,
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

interface AuctionPageProps {
  params: { id: string }
}

export default async function AuctionPage({ params }: AuctionPageProps) {
  let jsonLdData = null

  try {
    const auction = await prisma.auction.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        currentBid: true,
        startPrice: true,
        endTime: true,
        status: true,
        licenseType: true,
        beat: {
          select: {
            title: true,
            genre: true,
            bpm: true,
            audioUrl: true,
            coverImage: true,
            producer: {
              select: {
                id: true,
                name: true,
                displayName: true,
              },
            },
          },
        },
      },
    })

    if (auction) {
      jsonLdData = {
        auction: {
          id: auction.id,
          currentBid: auction.currentBid,
          startPrice: auction.startPrice,
          endTime: auction.endTime,
          status: auction.status,
          licenseType: auction.licenseType,
        },
        beat: {
          title: auction.beat.title,
          genre: auction.beat.genre,
          bpm: auction.beat.bpm,
          audioUrl: auction.beat.audioUrl,
          coverImage: auction.beat.coverImage,
        },
        producer: {
          id: auction.beat.producer.id,
          name: auction.beat.producer.name,
          displayName: auction.beat.producer.displayName,
        },
      }
    }
  } catch {}

  return (
    <>
      {jsonLdData && (
        <AuctionJsonLd
          auction={jsonLdData.auction}
          beat={jsonLdData.beat}
          producer={jsonLdData.producer}
        />
      )}
      <AuctionClient />
    </>
  )
}
