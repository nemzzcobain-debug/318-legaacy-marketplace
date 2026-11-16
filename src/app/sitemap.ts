export const dynamic = 'force-dynamic'
export const revalidate = 3600

import { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'
import { getPublicLiveAuctionWhere, PUBLIC_BEAT_WHERE } from '@/lib/public-catalog'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.318marketplace.com'

  // Static pages
  const staticPages = [
    { url: siteUrl, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 1.0 },
    {
      url: `${siteUrl}/marketplace`,
      lastModified: new Date(),
      changeFrequency: 'hourly' as const,
      priority: 0.9,
    },
    {
      url: `${siteUrl}/selection-semaine`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    },
    {
      url: `${siteUrl}/search`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    },
    {
      url: `${siteUrl}/producers`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    },
    {
      url: `${siteUrl}/playlists`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.6,
    },
    {
      url: `${siteUrl}/stats`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.5,
    },
    {
      url: `${siteUrl}/faq`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.4,
    },
    {
      url: `${siteUrl}/mentions-legales`,
      lastModified: new Date(),
      changeFrequency: 'yearly' as const,
      priority: 0.2,
    },
    {
      url: `${siteUrl}/cgv`,
      lastModified: new Date(),
      changeFrequency: 'yearly' as const,
      priority: 0.2,
    },
    {
      url: `${siteUrl}/confidentialite`,
      lastModified: new Date(),
      changeFrequency: 'yearly' as const,
      priority: 0.2,
    },
  ]

  // Active auctions
  let auctionPages: MetadataRoute.Sitemap = []
  try {
    const auctions = await prisma.auction.findMany({
      where: getPublicLiveAuctionWhere(),
      select: { id: true, updatedAt: true },
      take: 5000,
    })
    auctionPages = auctions.map((a) => ({
      url: `${siteUrl}/auction/${a.id}`,
      lastModified: a.updatedAt,
      changeFrequency: 'hourly' as const,
      priority: 0.9,
    }))
  } catch {}

  // Public beats (leasing + enchères) : une page indexable par beat
  let beatPages: MetadataRoute.Sitemap = []
  try {
    const beats = await prisma.beat.findMany({
      where: PUBLIC_BEAT_WHERE,
      select: { id: true, updatedAt: true },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    })
    beatPages = beats.map((b) => ({
      url: `${siteUrl}/beat/${b.id}`,
      lastModified: b.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }))
  } catch {}

  // Producers
  let producerPages: MetadataRoute.Sitemap = []
  try {
    const producers = await prisma.user.findMany({
      where: { role: 'PRODUCER', producerStatus: 'APPROVED' },
      select: { id: true, updatedAt: true },
      take: 5000,
    })
    producerPages = producers.map((p) => ({
      url: `${siteUrl}/producer/${p.id}`,
      lastModified: p.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }))
  } catch {}

  // Public playlists
  let playlistPages: MetadataRoute.Sitemap = []
  try {
    const playlists = await prisma.playlist.findMany({
      where: { visibility: 'PUBLIC' },
      select: { id: true, updatedAt: true },
      take: 5000,
    })
    playlistPages = playlists.map((p) => ({
      url: `${siteUrl}/playlists/${p.id}`,
      lastModified: p.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    }))
  } catch {}

  return [...staticPages, ...auctionPages, ...beatPages, ...producerPages, ...playlistPages]
}
