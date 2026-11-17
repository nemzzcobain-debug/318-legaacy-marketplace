import type { Metadata } from 'next'
import { cache } from 'react'
import { notFound } from 'next/navigation'
import { getPublicBeat, buildBeatSeo, toIsoDuration } from '@/lib/public-beat'
import { LICENSE_DETAILS } from '@/lib/licenses'
import { BeatJsonLd, BreadcrumbJsonLd } from '@/components/seo/JsonLd'
import BeatClient from './BeatClient'

interface Props {
  params: Promise<{ id: string }>
}

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.318marketplace.com'

// Une seule requête par rendu, partagée entre les métadonnées et la page.
const loadBeat = cache((id: string) => getPublicBeat(id))

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  try {
    const beat = await loadBeat(id)
    if (!beat) {
      return { title: 'Beat introuvable', robots: { index: false, follow: true } }
    }

    const { title, description } = buildBeatSeo(beat)
    const path = `/beat/${beat.id}`
    const images = beat.coverImage
      ? [{ url: beat.coverImage, width: 800, height: 800, alt: beat.title }]
      : undefined

    return {
      title,
      description,
      keywords: [
        beat.title,
        `beat ${beat.genre}`,
        `instrumentale ${beat.genre}`,
        `${beat.genre} type beat`,
        `${beat.bpm} bpm`,
        beat.producer.name,
        ...beat.tags,
      ],
      alternates: { canonical: path },
      openGraph: {
        type: 'music.song',
        url: path,
        title,
        description,
        images,
      },
      twitter: {
        card: beat.coverImage ? 'summary_large_image' : 'summary',
        title,
        description,
        images: beat.coverImage ? [beat.coverImage] : undefined,
      },
    }
  } catch (error) {
    console.error('Erreur métadonnées beat:', error)
    return { title: 'Beat', description: 'Découvre les beats de 318 LEGAACY Marketplace.' }
  }
}

export default async function BeatPage({ params }: Props) {
  const { id } = await params
  const beat = await loadBeat(id)
  if (!beat) notFound()

  const { description } = buildBeatSeo(beat)

  return (
    <>
      <BeatJsonLd
        siteUrl={siteUrl}
        description={description}
        beat={{
          ...beat,
          duration: toIsoDuration(beat.duration),
          offers: beat.offers.map((offer) => ({
            ...offer,
            label: LICENSE_DETAILS[offer.type].label,
          })),
        }}
      />
      <BreadcrumbJsonLd
        items={[
          { name: 'Accueil', url: siteUrl },
          { name: 'Producteurs', url: `${siteUrl}/producers` },
          { name: beat.producer.name, url: `${siteUrl}/producer/${beat.producer.id}` },
          { name: beat.title, url: `${siteUrl}/beat/${beat.id}` },
        ]}
      />
      <BeatClient beat={beat} />
    </>
  )
}
