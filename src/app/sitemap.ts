export const dynamic = 'force-dynamic'

import { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://318-legaacy-marketplace.vercel.app'

  // Static pages
  const staticPages = [
    { url: siteUrl, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 1.0 },
    { url: `${siteUrl}/marketplace`, lastModified: new Date(), changeFrequency: 'hourly' as const, priority: 0.9 },
    { url: `${siteUrl}/search`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.8 },
    { url: `${siteUrl}/producers`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.8 },
    { url: `${siteUrl}/playlists`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.6 },
    { url: `${siteUrl}/stats`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.5 },
    { url: `${siteUrl}/login`, lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.3 },
    { url: `${siteUrl}/register`, lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.4 },
  ]

  // Active auctions
  let auctionPages: MetadataRoute.Sitemap = []
  try {
    const auctions = await prisma.auction.findMany({
      where: { status: { in: ['ACTIVE', 'ENDING_SOON'] } },
      select: { id: true, updatedAt: true },
      take: 100,
    })
    auctionPages = auctions.map(a => ({
      url: `${siteUrl}/auction/${a.id}`,
      lastModified: a.updatedAt,
      changeFrequency: 'hourly' as const,
      priority: 0.9,
    }))
  } catch {}

  // Producers
  let producerPages: MetadataRoute.Sitemap = []
  try {
    const producers = await prisma.user.findMany({
      where: { role: 'PRODUCER', producerStatus: 'APPROVED' },
      select: { id: true, updatedAt: true },
      take: 100,
    })
    producerPages = producers.map(p => ({
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
      take: 100,
    })
    playlistPages = playlists.map(p => ({
      url: `${siteUrl}/playlists/${p.id}`,
      lastModified: p.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    }))
  } catch {}

  return [...staticPages, ...auctionPages, ...producerPages, ...playlistPages]
}
