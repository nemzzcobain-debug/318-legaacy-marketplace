import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import ProducerClient from './ProducerClient'

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const producer = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        name: true,
        displayName: true,
        avatar: true,
        producerBio: true,
        bio: true,
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
    const description = producer.producerBio || producer.bio
      ? (producer.producerBio || producer.bio).substring(0, 160)
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

export default function ProducerPage() {
  return <ProducerClient />
}
