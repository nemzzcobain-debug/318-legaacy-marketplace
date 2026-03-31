import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'

interface Props {
  params: { id: string }
  children: React.ReactNode
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const producer = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        name: true,
        displayName: true,
        producerBio: true,
        bio: true,
        _count: { select: { beats: true } },
      },
    })

    if (!producer) {
      return { title: 'Producteur non trouve' }
    }

    const name = producer.displayName || producer.name
    const title = `${name} — Producteur verifie`
    const description = producer.producerBio || producer.bio || `Decouvre les beats de ${name} sur 318 LEGAACY Marketplace. ${producer._count.beats} beat${producer._count.beats > 1 ? 's' : ''} disponible${producer._count.beats > 1 ? 's' : ''}.`

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'profile',
      },
      twitter: {
        card: 'summary',
        title,
        description,
      },
    }
  } catch {
    return { title: '318 LEGAACY — Producteur' }
  }
}

export default function ProducerLayout({ children }: Props) {
  return children
}
