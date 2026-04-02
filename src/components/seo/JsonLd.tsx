// JSON-LD Structured Data Components for SEO

interface WebsiteJsonLdProps {
  siteUrl?: string
}

export function WebsiteJsonLd({ siteUrl = 'https://www.318marketplace.com' }: WebsiteJsonLdProps) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: '318 LEGAACY Marketplace',
    url: siteUrl,
    description: 'Premiere plateforme d\'encheres de beats en France',
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
        url: `${siteUrl}/icons/icon-512x512.png`,
      },
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
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
    logo: `${siteUrl}/icons/icon-512x512.png`,
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
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
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
    image: beat.coverImage || `${siteUrl}/icons/icon-512x512.png`,
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
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
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
    totalSales: number
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
    image: producer.avatar || `${siteUrl}/icons/icon-512x512.png`,
    description: producer.bio || `Producteur verifie sur 318 LEGAACY Marketplace`,
    jobTitle: 'Beatmaker / Producteur musical',
    worksFor: {
      '@type': 'Organization',
      name: '318 LEGAACY Marketplace',
    },
    ...(producer.rating > 0 ? {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: producer.rating.toFixed(1),
        bestRating: '5',
        ratingCount: String(producer.totalSales || 1),
      },
    } : {}),
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
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
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
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}
