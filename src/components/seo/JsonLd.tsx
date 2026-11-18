// JSON-LD Structured Data Components for SEO

// F5 FIX: Échapper les caractères dangereux dans le JSON-LD pour prévenir les injections XSS
// JSON.stringify n'échappe PAS </script> ce qui permet de sortir du bloc script
function safeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/'/g, '\\u0027')
}

interface WebsiteJsonLdProps {
  siteUrl?: string
}

export function WebsiteJsonLd({ siteUrl = 'https://www.318marketplace.com' }: WebsiteJsonLdProps) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: '318 LEGAACY Marketplace',
    url: siteUrl,
    description: 'Première plateforme d\'enchères de beats en France',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${siteUrl}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
    publisher: {
      '@type': 'Organization',
      name: '318 LEGAACY Studio',
      url: siteUrl,
      logo: {
        '@type': 'ImageObject',
        url: `${siteUrl}/logo-318-marketplace.png`,
      },
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
    />
  )
}

interface OrganizationJsonLdProps {
  siteUrl?: string
}

export function OrganizationJsonLd({ siteUrl = 'https://www.318marketplace.com' }: OrganizationJsonLdProps) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: '318 LEGAACY Studio',
    url: siteUrl,
    logo: `${siteUrl}/logo-318-marketplace.png`,
    description: 'Studio d\'enregistrement et marketplace de beats en France',
    foundingDate: '2025',
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'FR',
    },
    sameAs: [],
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
    />
  )
}

interface AuctionJsonLdProps {
  auction: {
    id: string
    currentBid: number
    startPrice: number
    endTime: string
    status: string
    licenseType: string
  }
  beat: {
    title: string
    genre: string
    bpm: number
    audioUrl?: string
    coverImage?: string | null
  }
  producer: {
    name: string
    displayName?: string | null
    id: string
  }
  siteUrl?: string
}

export function AuctionJsonLd({ auction, beat, producer, siteUrl = 'https://www.318marketplace.com' }: AuctionJsonLdProps) {
  const producerName = producer.displayName || producer.name

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: beat.title,
    description: `Beat "${beat.title}" par ${producerName}. Genre: ${beat.genre}, ${beat.bpm} BPM. Licence ${auction.licenseType}.`,
    url: `${siteUrl}/auction/${auction.id}`,
    image: beat.coverImage || `${siteUrl}/logo-318-marketplace.png`,
    category: `Musique > Instrumentales > ${beat.genre}`,
    brand: {
      '@type': 'Brand',
      name: producerName,
    },
    offers: {
      '@type': 'Offer',
      price: auction.currentBid,
      priceCurrency: 'EUR',
      availability: auction.status === 'ACTIVE' || auction.status === 'ENDING_SOON'
        ? 'https://schema.org/InStock'
        : 'https://schema.org/SoldOut',
      validFrom: new Date().toISOString(),
      priceValidUntil: auction.endTime,
      url: `${siteUrl}/auction/${auction.id}`,
      seller: {
        '@type': 'Person',
        name: producerName,
        url: `${siteUrl}/producer/${producer.id}`,
      },
    },
    additionalProperty: [
      { '@type': 'PropertyValue', name: 'Genre', value: beat.genre },
      { '@type': 'PropertyValue', name: 'BPM', value: String(beat.bpm) },
      { '@type': 'PropertyValue', name: 'Licence', value: auction.licenseType },
    ],
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
    />
  )
}

interface ProducerJsonLdProps {
  producer: {
    id: string
    name: string
    displayName?: string | null
    bio?: string | null
    avatar?: string | null
    rating: number
  }
  totalBeats: number
  totalFollowers: number
  siteUrl?: string
}

export function ProducerJsonLd({ producer, totalBeats, totalFollowers, siteUrl = 'https://www.318marketplace.com' }: ProducerJsonLdProps) {
  const name = producer.displayName || producer.name

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name,
    url: `${siteUrl}/producer/${producer.id}`,
    image: producer.avatar || `${siteUrl}/logo-318-marketplace.png`,
    description: producer.bio || `Producteur vérifié sur 318 LEGAACY Marketplace`,
    jobTitle: 'Beatmaker / Producteur musical',
    worksFor: {
      '@type': 'Organization',
      name: '318 LEGAACY Marketplace',
    },
    interactionStatistic: [
      {
        '@type': 'InteractionCounter',
        interactionType: 'https://schema.org/FollowAction',
        userInteractionCount: totalFollowers,
      },
    ],
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
    />
  )
}

interface BreadcrumbJsonLdProps {
  items: { name: string; url: string }[]
}

export function BreadcrumbJsonLd({ items }: BreadcrumbJsonLdProps) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
    />
  )
}

// ─── BEAT (page publique /beat/[id]) ───

interface BeatJsonLdProps {
  beat: {
    id: string
    title: string
    genre: string
    bpm: number
    key: string | null
    duration?: string
    coverImage: string | null
    previewUrl: string | null
    previewIsExcerpt?: boolean
    createdAt: string
    tags: string[]
    producer: { id: string; name: string }
    offers: Array<{ type: string; label: string; price: number }>
    liveAuction: { id: string; currentBid: number; endTime: string } | null
  }
  description: string
  siteUrl?: string
}

export function BeatJsonLd({
  beat,
  description,
  siteUrl = 'https://www.318marketplace.com',
}: BeatJsonLdProps) {
  const url = `${siteUrl}/beat/${beat.id}`
  const producerUrl = `${siteUrl}/producer/${beat.producer.id}`
  const image = beat.coverImage || undefined

  const recording: Record<string, unknown> = {
    '@type': 'MusicRecording',
    '@id': `${url}#recording`,
    name: beat.title,
    url,
    genre: beat.genre,
    byArtist: { '@type': 'Person', name: beat.producer.name, url: producerUrl },
    datePublished: beat.createdAt.slice(0, 10),
    ...(beat.duration && { duration: beat.duration }),
    ...(image && { image }),
    ...(beat.tags.length > 0 && { keywords: beat.tags.join(', ') }),
    ...(beat.previewUrl && {
      audio: {
        '@type': 'AudioObject',
        contentUrl: beat.previewUrl,
        encodingFormat: /\.wav(\?|$)/i.test(beat.previewUrl) ? 'audio/wav' : 'audio/mpeg',
        name: beat.previewIsExcerpt ? `${beat.title} (extrait)` : beat.title,
      },
    }),
  }

  const graph: Record<string, unknown>[] = [recording]

  const offers = beat.offers.map((offer) => ({
    '@type': 'Offer',
    name: `Licence ${offer.label}`,
    price: offer.price.toFixed(2),
    priceCurrency: 'EUR',
    availability: 'https://schema.org/InStock',
    url,
  }))

  let productOffers: Record<string, unknown> | null = null
  if (offers.length === 1) {
    productOffers = offers[0]
  } else if (offers.length > 1) {
    const prices = beat.offers.map((offer) => offer.price)
    productOffers = {
      '@type': 'AggregateOffer',
      lowPrice: Math.min(...prices).toFixed(2),
      highPrice: Math.max(...prices).toFixed(2),
      priceCurrency: 'EUR',
      offerCount: offers.length,
      offers,
    }
  } else if (beat.liveAuction) {
    productOffers = {
      '@type': 'Offer',
      price: beat.liveAuction.currentBid.toFixed(2),
      priceCurrency: 'EUR',
      availability: 'https://schema.org/InStock',
      priceValidUntil: beat.liveAuction.endTime.slice(0, 10),
      url: `${siteUrl}/auction/${beat.liveAuction.id}`,
    }
  }

  if (productOffers) {
    graph.push({
      '@type': 'Product',
      '@id': `${url}#product`,
      name: beat.title,
      description,
      url,
      category: 'Instrumentale',
      brand: { '@type': 'Brand', name: beat.producer.name },
      subjectOf: { '@id': `${url}#recording` },
      ...(image && { image }),
      offers: productOffers,
    })
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: safeJsonLd({ '@context': 'https://schema.org', '@graph': graph }),
      }}
    />
  )
}
