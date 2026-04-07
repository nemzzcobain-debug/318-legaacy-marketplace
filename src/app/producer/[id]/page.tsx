import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import ProducerClient from './ProducerClient'
import { ProducerJsonLd } from '@/components/seo/JsonLd'

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const producer = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        displayName: true,
        avatar: true,
        producerBio: true,
        bio: true,
        rating: true,
        totalSales: true,
        beats: {
          select: { id: true },
        },
        followers: {
          select: { id: true },
        },
      },
    })

    if (!producer) {
      return {
        title: 'Producteur non trouvé | 318 LEGAACY',
        description: 'Ce producteur n\'existe pas ou a été supprimé.',
      }
    }

    const displayName = producer.displayName || producer.name
    const title = `${displayName} - Producteur | 318 LEGAACY`
    const bio = producer.producerBio || producer.bio
    const description = bio
      ? bio.substring(0, 160)
      : `Découvrez les beats de ${displayName} sur 318 LEGAACY Marketplace. Un producteur de beats professionnel.`

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: `/producer/${params.id}`,
        type: 'profile',
        images: producer.avatar
          ? [
              {
                url: producer.avatar,
                width: 400,
                height: 400,
                alt: displayName,
              },
            ]
          : undefined,
      },
      twitter: {
        card: 'summary',
        title,
        description,
        images: producer.avatar ? [producer.avatar] : undefined,
      },
    }
  } catch (error) {
    console.error('Error generating metadata for producer:', error)
    return {
      title: 'Producteur | 318 LEGAACY',
      description: 'Découvrez les producteurs de beats sur 318 LEGAACY Marketplace',
    }
  }
}

interface ProducerPageProps {
  params: { id: string }
}

export default async function ProducerPage({ params }: ProducerPageProps) {
  let jsonLdData = null

  try {
    const producer = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        displayName: true,
        avatar: true,
        bio: true,
        producerBio: true,
        rating: true,
        totalSales: true,
        beats: {
          select: { id: true },
        },
        followers: {
          select: { id: true },
        },
      },
    })

    if (producer) {
      jsonLdData = {
        producer: {
          id: producer.id,
          name: producer.name,
          displayName: producer.displayName,
          avatar: producer.avatar,
          bio: producer.producerBio || producer.bio,
          rating: producer.rating,
          totalSales: producer.totalSales,
        },
        totalBeats: producer.beats.length,
        totalFollowers: producer.followers.length,
      }
    }
  } catch {}

  return (
    <>
      {jsonLdData && (
        <ProducerJsonLd
          producer={jsonLdData.producer}
          totalBeats={jsonLdData.totalBeats}
          totalFollowers={jsonLdData.totalFollowers}
        />
      )}
      <ProducerClient />
    </>
  )
}
